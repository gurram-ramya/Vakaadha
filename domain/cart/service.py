# domain/cart/service.py — Unified Cart Service 3.0
import logging
import re
from datetime import datetime
from uuid import uuid4
from db import get_db_connection
from domain.cart import repository as repo

# =============================================================
# Exceptions
# =============================================================
class GuestCartExpired(Exception): pass
class CartNotFoundError(Exception): pass
class InvalidVariantError(Exception): pass
class InvalidQuantityError(Exception): pass
class InsufficientStockError(Exception): pass
class MergeConflictError(Exception): pass


# =============================================================
# Helpers
# =============================================================
def _record_audit(conn, cart_id, user_id, guest_id, event_type, message):
    try:
        repo.insert_audit_event(conn, cart_id, user_id, guest_id, event_type, message)
    except Exception as e:
        logging.warning(f"[AUDIT_LOG_FAILED] {e}")


# =============================================================
# CART CREATION / ENSURERS
# =============================================================
def ensure_cart_for_guest(guest_id: str):
    if not guest_id or not re.fullmatch(r"[0-9a-fA-F-]{20,64}", guest_id):
        guest_id = str(uuid4())

    conn = get_db_connection()
    with conn:
        cart = repo.get_cart_by_guest_id(conn, guest_id)
        if cart:
            if repo.check_cart_expired(cart):
                repo.mark_cart_expired(conn, cart["cart_id"])
                _record_audit(conn, cart["cart_id"], None, guest_id, "expire", "Guest cart expired")
                raise GuestCartExpired("GuestCartExpired")
            return {"cart_id": cart["cart_id"], "guest_id": guest_id}

        new_id = repo.create_guest_cart(conn, guest_id, ttl_days=7)
        _record_audit(conn, new_id, None, guest_id, "create", "Guest cart created")
        return {"cart_id": new_id, "guest_id": guest_id}


def ensure_cart_for_user(user_id: int):
    conn = get_db_connection()
    with conn:
        cart = repo.get_cart_by_user_id(conn, user_id)
        if cart:
            return {"cart_id": cart["cart_id"], "user_id": user_id}
        new_id = repo.create_user_cart(conn, user_id)
        _record_audit(conn, new_id, user_id, None, "create", "User cart created")
        return {"cart_id": new_id, "user_id": user_id}


# =============================================================
# CART FETCH
# =============================================================
def fetch_cart(cart_id: int):
    conn = get_db_connection()
    with conn:
        items = repo.get_cart_items(conn, cart_id)
        totals = repo.compute_cart_totals(conn, cart_id)
        return {
            "cart_id": cart_id,
            "items": [
                {
                    "cart_item_id": i["cart_item_id"],
                    "variant_id": i["variant_id"],
                    "product_id": i["product_id"],
                    "product_name": i["product_name"],
                    "size": i["size"],
                    "color": i["color"],
                    "quantity": i["quantity"],
                    "price_cents": i["price_cents"],
                    "price": float(i["price_cents"]) / 100.0,
                    "stock": i["stock"],
                    "image_url": (
                        f"Images/{i['image_url']}"
                        if "image_url" in i.keys() and i["image_url"]
                        else "Images/placeholder.png"
                    ),
                }
                for i in items
            ],
            "totals": {
                "subtotal": float(totals["subtotal_cents"]) / 100.0,
                "total": float(totals["total_cents"]) / 100.0,
            },
        }


# =============================================================
# ITEM OPERATIONS
# =============================================================
def add_item(cart_id: int, variant_id: int, quantity: int):
    if quantity <= 0:
        raise InvalidQuantityError("Quantity must be positive")
    conn = get_db_connection()
    with conn:
        variant = repo.get_variant_with_price_and_stock(conn, variant_id)
        if not variant:
            raise InvalidVariantError("Variant not found")
        if variant["stock"] <= 0:
            raise InsufficientStockError("Out of stock")

        repo.add_or_update_cart_item(conn, cart_id, variant_id, min(quantity, variant["stock"]), variant["price_cents"])
        _record_audit(conn, cart_id, None, None, "add", f"Added variant {variant_id} (qty={quantity})")
        return fetch_cart(cart_id)


def update_item_quantity(cart_id: int, cart_item_id: int, quantity: int):
    if quantity <= 0:
        remove_item(cart_id, cart_item_id)
        return fetch_cart(cart_id)
    conn = get_db_connection()
    with conn:
        repo.update_cart_item_quantity(conn, cart_item_id, quantity)
        _record_audit(conn, cart_id, None, None, "update", f"Set item {cart_item_id} quantity={quantity}")
        return fetch_cart(cart_id)


def remove_item(cart_id: int, cart_item_id: int):
    conn = get_db_connection()
    with conn:
        repo.remove_cart_item(conn, cart_item_id)
        _record_audit(conn, cart_id, None, None, "delete", f"Removed item {cart_item_id}")
        return fetch_cart(cart_id)


def clear_cart(cart_id: int):
    conn = get_db_connection()
    with conn:
        repo.clear_cart_items(conn, cart_id)
        _record_audit(conn, cart_id, None, None, "clear", "Cleared all cart items")


# =============================================================
# MERGE LOGIC
# =============================================================
def merge_guest_into_user(user_id: int, guest_id: str):
    """Safely merge guest cart into user cart."""
    conn = get_db_connection()
    with conn:
        guest_cart = repo.get_cart_by_guest_id(conn, guest_id)
        if not guest_cart:
            return {"status": "skipped", "reason": "no active guest cart"}

        user_cart = repo.get_cart_by_user_id(conn, user_id)
        if not user_cart:
            user_cart_id = repo.create_user_cart(conn, user_id)
        else:
            user_cart_id = user_cart["cart_id"]

        repo.transfer_cart_items(conn, guest_cart["cart_id"], user_cart_id)
        repo.mark_cart_merged(conn, guest_cart["cart_id"])
        repo.record_cart_merge_audit(conn, user_cart_id, user_id, guest_id)
        _record_audit(conn, user_cart_id, user_id, guest_id, "merge", f"Merged guest {guest_id} into user {user_id}")
        return {"status": "merged", "user_cart_id": user_cart_id}


# =============================================================
# CONVERSION / AUDIT FETCH
# =============================================================
def convert_cart_to_order(cart_id: int):
    conn = get_db_connection()
    with conn:
        repo.mark_cart_converted(conn, cart_id)
        _record_audit(conn, cart_id, None, None, "convert", "Cart converted for checkout")


def get_audit_log(cart_id: int):
    conn = get_db_connection()
    with conn:
        rows = repo.get_recent_audit_events(conn, cart_id)
        return [
            {
                "audit_id": r["audit_id"],
                "event_type": r["event_type"],
                "message": r["message"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]
