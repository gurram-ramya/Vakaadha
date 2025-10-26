# domain/cart/service.py — Vakaadha Cart Service 2.0
import logging
from datetime import datetime, timedelta
from uuid import uuid4
from typing import Optional
from db import get_db_connection
from domain.cart import repository as repo

# =============================================================
# Exception Classes
# =============================================================
class GuestCartExpired(Exception):
    pass

class CartNotFoundError(Exception):
    pass

class InvalidVariantError(Exception):
    pass

class InvalidQuantityError(Exception):
    pass

class InsufficientStockError(Exception):
    pass

class MergeConflictError(Exception):
    pass

class DBError(Exception):
    pass


# =============================================================
# Utility Functions
# =============================================================
def _now():
    return datetime.utcnow()


def _safe_int(v):
    try:
        return int(v)
    except Exception:
        return None


def _record_audit(conn, cart_id, user_id, guest_id, event_type, message):
    try:
        repo.insert_audit_event(conn, cart_id, user_id, guest_id, event_type, message)
    except Exception as e:
        logging.warning(f"[AUDIT_LOG_FAILED] {e}")


# =============================================================
# Cart Ensurers
# =============================================================
def ensure_cart_for_guest(guest_id: str):
    """
    Ensures a guest cart exists and enforces TTL.
    Raises GuestCartExpired if TTL has passed.
    """
    if not guest_id:
        guest_id = str(uuid4())

    conn = get_db_connection()
    with conn:
        cart_row = repo.get_cart_by_guest_id(conn, guest_id)
        if cart_row:
            if repo.check_cart_expired(cart_row):
                repo.mark_cart_expired(conn, cart_row["cart_id"])
                _record_audit(conn, cart_row["cart_id"], None, guest_id, "expire", "Guest cart TTL expired")
                raise GuestCartExpired("GuestCartExpired")
            return {"cart_id": cart_row["cart_id"], "guest_id": guest_id}

        # Create new cart
        cart_id = repo.create_guest_cart(conn, guest_id, ttl_days=7)
        _record_audit(conn, cart_id, None, guest_id, "create", "Guest cart created")
        return {"cart_id": cart_id, "guest_id": guest_id}


def ensure_cart_for_user(user_id: int):
    """Ensures an active cart exists for user."""
    conn = get_db_connection()
    with conn:
        cart_row = repo.get_cart_by_user_id(conn, user_id)
        if cart_row:
            return {"cart_id": cart_row["cart_id"], "user_id": user_id}
        cart_id = repo.create_user_cart(conn, user_id)
        _record_audit(conn, cart_id, user_id, None, "create", "User cart created")
        return {"cart_id": cart_id, "user_id": user_id}


# =============================================================
# Core Cart Retrieval
# =============================================================
# def fetch_cart(cart_id: int):
#     """Return full cart with items + totals. Raises GuestCartExpired if expired."""
#     conn = get_db_connection()
#     with conn:
#         items = repo.get_cart_items(conn, cart_id)
#         totals = repo.compute_cart_totals(conn, cart_id)
#         return {
#             "cart_id": cart_id,
#             "items": [
#                 {
#                     "cart_item_id": i["cart_item_id"],
#                     "variant_id": i["variant_id"],
#                     "product_id": i["product_id"],
#                     "product_name": i["product_name"],
#                     "size": i["size"],
#                     "color": i["color"],
#                     "quantity": i["quantity"],
#                     "price": float(i["price_cents"]) / 100.0,
#                     "price_cents": i["price_cents"],
#                     "stock": i["stock"],
#                     "locked_price_until": i["locked_price_until"],
#                 }
#                 for i in items
#             ],
#             "totals": {
#                 "subtotal": float(totals["subtotal_cents"]) / 100.0,
#                 "total": float(totals["total_cents"]) / 100.0,
#             },
#         }

def fetch_cart(cart_id: int):
    """Return full cart with enriched item data — includes image_url."""
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
                    "price": float(i["price_cents"]) / 100.0,
                    "price_cents": i["price_cents"],
                    "stock": i["stock"],
                    "locked_price_until": i["locked_price_until"],
                    # ✅ Fixed: sqlite3.Row does not support .get()
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
# Add / Update / Remove Items
# =============================================================
def add_item(cart_id: int, variant_id: int, quantity: int):
    """Add a product variant to the cart."""
    if quantity <= 0:
        raise InvalidQuantityError("Quantity must be positive")

    conn = get_db_connection()
    with conn:
        variant = repo.get_variant_with_price_and_stock(conn, variant_id)
        if not variant:
            raise InvalidVariantError("Variant not found")
        if variant["stock"] <= 0:
            raise InsufficientStockError("Out of stock")

        repo.add_or_update_cart_item(
            conn,
            cart_id,
            variant_id,
            min(quantity, variant["stock"]),
            variant["price_cents"],
        )
        _record_audit(conn, cart_id, None, None, "update", f"Added variant {variant_id} (qty={quantity})")

        return fetch_cart(cart_id)


def update_item_quantity(cart_id: int, cart_item_id: int, quantity: int):
    """Update existing cart item quantity (PATCH)."""
    if quantity <= 0:
        remove_item(cart_id, cart_item_id)
        return fetch_cart(cart_id)

    conn = get_db_connection()
    with conn:
        repo.update_cart_item_quantity(conn, cart_item_id, quantity)
        _record_audit(conn, cart_id, None, None, "update", f"Updated item {cart_item_id} quantity={quantity}")
        return fetch_cart(cart_id)


def remove_item(cart_id: int, cart_item_id: int):
    """Remove specific cart item."""
    conn = get_db_connection()
    with conn:
        repo.remove_cart_item(conn, cart_item_id)
        _record_audit(conn, cart_id, None, None, "delete", f"Removed cart item {cart_item_id}")
        return fetch_cart(cart_id)


def clear_cart(cart_id: int):
    """Clear all items from cart."""
    conn = get_db_connection()
    with conn:
        repo.clear_cart_items(conn, cart_id)
        _record_audit(conn, cart_id, None, None, "clear", "Cleared all items from cart")


# =============================================================
# Merge & Conversion
# =============================================================
def merge_guest_into_user(user_id: int, guest_id: str):
    """Merge guest cart items into user cart with quantity reconciliation."""
    conn = get_db_connection()
    with conn:
        guest_cart = repo.get_cart_by_guest_id(conn, guest_id)
        if not guest_cart:
            raise CartNotFoundError("Guest cart not found")
        if guest_cart["status"] in ("converted", "merged"):
            return {"status": "skipped", "reason": "already merged"}

        user_cart = repo.get_cart_by_user_id(conn, user_id)
        if not user_cart:
            user_cart_id = repo.create_user_cart(conn, user_id)
        else:
            user_cart_id = user_cart["cart_id"]

        guest_items = repo.get_cart_items(conn, guest_cart["cart_id"])
        added, updated = 0, 0

        for item in guest_items:
            variant = repo.get_variant_with_price_and_stock(conn, item["variant_id"])
            if not variant or variant["stock"] <= 0:
                continue
            try:
                existed = not repo.add_or_update_cart_item(
                    conn,
                    user_cart_id,
                    item["variant_id"],
                    min(item["quantity"], variant["stock"]),
                    variant["price_cents"],
                )
                updated += int(existed)
                added += int(not existed)
            except Exception:
                continue

        repo.mark_cart_merged(conn, guest_cart["cart_id"])
        _record_audit(conn, guest_cart["cart_id"], user_id, guest_id, "merge",
                      f"Merged {added} added, {updated} updated")
        return {"status": "merged", "added": added, "updated": updated}


def convert_cart_to_order(cart_id: int):
    """Marks a cart as converted and readies it for checkout cloning."""
    conn = get_db_connection()
    with conn:
        repo.mark_cart_converted(conn, cart_id)
        _record_audit(conn, cart_id, None, None, "convert", "Cart converted to order-ready state")


# =============================================================
# Audit Fetch
# =============================================================
def get_audit_log(cart_id: int):
    """Return last 20 audit entries for a given cart."""
    conn = get_db_connection()
    with conn:
        events = repo.get_recent_audit_events(conn, cart_id)
        return [
            {
                "audit_id": e["audit_id"],
                "event_type": e["event_type"],
                "message": e["message"],
                "created_at": e["created_at"],
            }
            for e in events
        ]

