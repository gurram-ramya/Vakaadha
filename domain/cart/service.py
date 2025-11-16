# # domain/cart/service.py — Unified Cart Service (Revised Merge-Consistent)
# import logging
# import re
# from datetime import datetime
# from uuid import uuid4
# from db import get_db_connection, transaction
# from domain.cart import repository as repo

# # =============================================================
# # Exceptions
# # =============================================================
# class GuestCartExpired(Exception): pass
# class CartNotFoundError(Exception): pass
# class InvalidVariantError(Exception): pass
# class InvalidQuantityError(Exception): pass
# class InsufficientStockError(Exception): pass
# class MergeConflictError(Exception): pass


# # =============================================================
# # Helpers
# # =============================================================
# def _record_audit(conn, cart_id, user_id, guest_id, event_type, message):
#     try:
#         repo.insert_audit_event(conn, cart_id, user_id, guest_id, event_type, message)
#     except Exception as e:
#         logging.warning(f"[AUDIT_LOG_FAILED] {e}")


# # =============================================================
# # CART CREATION / ENSURERS
# # =============================================================
# def ensure_cart_for_guest(guest_id: str):
#     if not guest_id or not re.fullmatch(r"[0-9a-fA-F-]{20,64}", guest_id):
#         guest_id = str(uuid4())

#     conn = get_db_connection()
#     with conn:
#         cart = repo.get_cart_by_guest_id(conn, guest_id)
#         if cart:
#             if repo.check_cart_expired(cart):
#                 repo.mark_cart_expired(conn, cart["cart_id"])
#                 _record_audit(conn, cart["cart_id"], None, guest_id, "expire", "Guest cart expired")
#                 raise GuestCartExpired("GuestCartExpired")
#             return {"cart_id": cart["cart_id"], "guest_id": guest_id}

#         new_id = repo.create_guest_cart(conn, guest_id, ttl_days=7)
#         _record_audit(conn, new_id, None, guest_id, "create", "Guest cart created")
#         return {"cart_id": new_id, "guest_id": guest_id}


# def ensure_cart_for_user(user_id: int):
#     conn = get_db_connection()
#     with conn:
#         cart = repo.get_cart_by_user_id(conn, user_id)
#         if cart:
#             return {"cart_id": cart["cart_id"], "user_id": user_id}
#         new_id = repo.create_user_cart(conn, user_id)
#         _record_audit(conn, new_id, user_id, None, "create", "User cart created")
#         return {"cart_id": new_id, "user_id": user_id}


# # =============================================================
# # CART FETCH
# # =============================================================
# def fetch_cart(cart_id: int):
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
#                     "price_cents": i["price_cents"],
#                     "price": float(i["price_cents"]) / 100.0,
#                     "stock": i["stock"],
#                     "image_url": (
#                         f"Images/{i['image_url']}"
#                         if "image_url" in i.keys() and i["image_url"]
#                         else "Images/placeholder.png"
#                     ),
#                 }
#                 for i in items
#             ],
#             "totals": {
#                 "subtotal": float(totals["subtotal_cents"]) / 100.0,
#                 "total": float(totals["total_cents"]) / 100.0,
#             },
#         }


# # =============================================================
# # ITEM OPERATIONS
# # =============================================================
# def add_item(cart_id: int, variant_id: int, quantity: int):
#     if quantity <= 0:
#         raise InvalidQuantityError("Quantity must be positive")
#     conn = get_db_connection()
#     with conn:
#         variant = repo.get_variant_with_price_and_stock(conn, variant_id)
#         if not variant:
#             raise InvalidVariantError("Variant not found")
#         if variant["stock"] <= 0:
#             raise InsufficientStockError("Out of stock")

#         repo.add_or_update_cart_item(conn, cart_id, variant_id, min(quantity, variant["stock"]), variant["price_cents"])
#         _record_audit(conn, cart_id, None, None, "add", f"Added variant {variant_id} (qty={quantity})")
#         return fetch_cart(cart_id)


# def update_item_quantity(cart_id: int, cart_item_id: int, quantity: int):
#     if quantity <= 0:
#         remove_item(cart_id, cart_item_id)
#         return fetch_cart(cart_id)
#     conn = get_db_connection()
#     with conn:
#         repo.update_cart_item_quantity(conn, cart_item_id, quantity)
#         _record_audit(conn, cart_id, None, None, "update", f"Set item {cart_item_id} quantity={quantity}")
#         return fetch_cart(cart_id)


# def remove_item(cart_id: int, cart_item_id: int):
#     conn = get_db_connection()
#     with conn:
#         repo.remove_cart_item(conn, cart_item_id)
#         _record_audit(conn, cart_id, None, None, "delete", f"Removed item {cart_item_id}")
#         return fetch_cart(cart_id)


# def clear_cart(cart_id: int):
#     conn = get_db_connection()
#     with conn:
#         repo.clear_cart_items(conn, cart_id)
#         _record_audit(conn, cart_id, None, None, "clear", "Cleared all cart items")


# # =============================================================
# # MERGE LOGIC (REVISED)
# # =============================================================
# def merge_guest_cart_into_user(conn, user_id, guest_id):
#     """
#     Simple guest→user cart transfer. No conflict resolution.
#     Runs inside an existing transaction.
#     """
#     guest_cart = repo.get_cart_by_guest(conn, guest_id)
#     if not guest_cart:
#         return {"transferred": 0, "status": "none"}

#     user_cart = repo.get_cart_by_user(conn, user_id)
#     transferred = 0

#     # If no existing user cart, reassign guest cart directly
#     if not user_cart:
#         conn.execute(
#             "UPDATE carts SET user_id = ?, guest_id = NULL, updated_at = datetime('now') WHERE cart_id = ?;",
#             (user_id, guest_cart["cart_id"]),
#         )
#         conn.execute(
#             "UPDATE cart_items SET user_id = ? WHERE cart_id = ?;",
#             (user_id, guest_cart["cart_id"]),
#         )
#         repo.log_addition_event(conn, user_id, None, "cart", f"Cart reassigned from guest {guest_id}")
#         return {"transferred": 0, "status": "attached"}

#     # If both exist, move unique items from guest cart to user cart
#     guest_items = repo.get_cart_items_by_cart(conn, guest_cart["cart_id"])
#     for item in guest_items:
#         existing = repo.get_cart_item(conn, user_cart["cart_id"], item["product_id"])
#         if not existing:
#             conn.execute(
#                 """
#                 INSERT INTO cart_items (cart_id, user_id, product_id, quantity, created_at, updated_at)
#                 VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
#                 """,
#                 (user_cart["cart_id"], user_id, item["product_id"], item["quantity"]),
#             )
#             transferred += 1

#     # Remove guest cart and its items
#     conn.execute("DELETE FROM cart_items WHERE cart_id = ?;", (guest_cart["cart_id"],))
#     conn.execute("DELETE FROM carts WHERE cart_id = ?;", (guest_cart["cart_id"],))

#     repo.log_addition_event(conn, user_id, None, "cart", f"{transferred} items transferred from guest {guest_id}")
#     return {"transferred": transferred, "status": "attached"}



# # =============================================================
# # CONVERSION / AUDIT FETCH
# # =============================================================
# def convert_cart_to_order(cart_id: int):
#     conn = get_db_connection()
#     with conn:
#         repo.mark_cart_converted(conn, cart_id)
#         _record_audit(conn, cart_id, None, None, "convert", "Cart converted for checkout")


# def get_audit_log(cart_id: int):
#     conn = get_db_connection()
#     with conn:
#         rows = repo.get_recent_audit_events(conn, cart_id)
#         return [
#             {
#                 "audit_id": r["audit_id"],
#                 "event_type": r["event_type"],
#                 "message": r["message"],
#                 "created_at": r["created_at"],
#             }
#             for r in rows
#         ]


import logging
import re
from uuid import uuid4
from db import transaction
from domain.cart import repository as repo


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


def ensure_cart_for_guest(guest_id: str):
    if not guest_id or not re.fullmatch(r"[0-9a-fA-F-]{20,64}", guest_id):
        guest_id = str(uuid4())

    cart = repo.get_cart_by_guest_id(guest_id)
    if cart:
        if repo.check_cart_expired(cart):
            with transaction() as cur:
                repo.mark_cart_expired(cart["cart_id"])
            return GuestCartExpired("GuestCartExpired")

        return {"cart_id": cart["cart_id"], "guest_id": guest_id}

    with transaction() as cur:
        cart_id = repo.create_guest_cart(guest_id, ttl_days=7)
        return {"cart_id": cart_id, "guest_id": guest_id}


def ensure_cart_for_user(user_id: int):
    cart = repo.get_cart_by_user_id(user_id)
    if cart:
        return {"cart_id": cart["cart_id"], "user_id": user_id}

    with transaction() as cur:
        cart_id = repo.create_user_cart(user_id)
        return {"cart_id": cart_id, "user_id": user_id}


def fetch_cart(cart_id: int):
    items = repo.get_cart_items(cart_id)
    totals = repo.compute_cart_totals(cart_id)

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
                "image_url": i["image_url"] or "Images/placeholder.png",
            }
            for i in items
        ],
        "totals": {
            "subtotal": float(totals["subtotal_cents"]) / 100.0,
            "total": float(totals["total_cents"]) / 100.0,
        },
    }


def add_item(cart_id: int, variant_id: int, quantity: int):
    if quantity <= 0:
        raise InvalidQuantityError("Quantity must be positive")

    variant = repo.get_variant_with_price_and_stock(variant_id)
    if not variant:
        raise InvalidVariantError("Variant not found")
    if variant["stock"] <= 0:
        raise InsufficientStockError("Out of stock")

    qty = min(quantity, variant["stock"])

    with transaction() as cur:
        repo.add_or_update_cart_item(cart_id, variant_id, qty, variant["price_cents"])

    return fetch_cart(cart_id)


def update_item_quantity(cart_id: int, cart_item_id: int, quantity: int):
    if quantity <= 0:
        with transaction() as cur:
            repo.remove_cart_item(cart_item_id)
        return fetch_cart(cart_id)

    with transaction() as cur:
        repo.update_cart_item_quantity(cart_item_id, quantity)

    return fetch_cart(cart_id)


def remove_item(cart_id: int, cart_item_id: int):
    with transaction() as cur:
        repo.remove_cart_item(cart_item_id)

    return fetch_cart(cart_id)


def clear_cart(cart_id: int):
    with transaction() as cur:
        repo.clear_cart_items(cart_id)


def merge_carts(user_id: int, guest_id: str):
    print("merge_carts invoked", user_id, guest_id)
    guest_cart = repo.get_cart_by_guest_id(guest_id)
    if not guest_cart:
        return {"added": 0, "updated": 0, "status": "none"}

    user_cart = repo.get_cart_by_user_id(user_id)
    if not user_cart:
        with transaction() as cur:
            cur.execute(
                """
                UPDATE carts
                SET user_id = %s,
                    guest_id = NULL,
                    updated_at = NOW()
                WHERE cart_id = %s
                """,
                (user_id, guest_cart["cart_id"]),
            )
        return {"added": 0, "updated": 0, "status": "attached"}

    with transaction() as cur:
        res = repo.merge_cart_items_atomic(
            guest_cart["cart_id"],
            user_cart["cart_id"]
        )

    return {
        "added": res.get("added", 0),
        "updated": res.get("updated", 0),
        "status": "merged",
    }


def convert_cart_to_order(cart_id: int):
    with transaction() as cur:
        repo.mark_cart_converted(cart_id)


def get_audit_log(cart_id: int):
    return []
