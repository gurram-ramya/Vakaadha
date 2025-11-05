# # domain/wishlist/service.py — Vakaadha Wishlist Service v2
# from datetime import datetime
# from domain.wishlist import repository as repo
# from domain.cart import service as cart_service


# # ============================================================
# # WISHLIST ENSURE HELPERS (NEW — align with cart service)
# # ============================================================
# def ensure_wishlist_for_guest(guest_id: str):
#     wishlist_id = repo.get_or_create_wishlist(guest_id=guest_id)
#     return {"wishlist_id": wishlist_id, "guest_id": guest_id}


# def ensure_wishlist_for_user(user_id: int):
#     wishlist_id = repo.get_or_create_wishlist(user_id=user_id)
#     return {"wishlist_id": wishlist_id, "user_id": user_id}



# # ============================================================
# # GET WISHLIST ITEMS
# # ============================================================
# def get_wishlist(user_id=None, guest_id=None):
#     """
#     Fetch all wishlist items for a given user or guest.
#     Automatically creates a wishlist if none exists.
#     Returns structured payload with count and items.
#     """
#     wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)
#     items = repo.get_items(wishlist_id)
#     return {
#         "wishlist_id": wishlist_id,
#         "count": len(items),
#         "items": items
#     }


# # ============================================================
# # GET WISHLIST COUNT
# # ============================================================
# def get_count(user_id=None, guest_id=None):
#     """
#     Returns the total number of items in a user's or guest's wishlist.
#     """
#     wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)
#     return repo.get_count(wishlist_id)


# # ============================================================
# # ADD TO WISHLIST
# # ============================================================
# def add_to_wishlist(product_id, user_id=None, guest_id=None):
#     """
#     Adds a product to the wishlist (user or guest).
#     Automatically creates a wishlist if needed.
#     """
#     wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)

#     # Validate product existence
#     if not repo.product_exists(product_id):
#         return {"status": "error", "message": "Product not found"}

#     repo.add_item(wishlist_id, product_id, user_id, guest_id)
#     return {"status": "success", "message": "Product added to wishlist"}


# # ============================================================
# # REMOVE FROM WISHLIST
# # ============================================================
# def remove_from_wishlist(product_id, user_id=None, guest_id=None):
#     """
#     Removes a product from the wishlist (user or guest).
#     """
#     wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)
#     repo.remove_item(wishlist_id, product_id, user_id, guest_id)
#     return {"status": "success", "message": "Product removed from wishlist"}


# # ============================================================
# # CLEAR WISHLIST
# # ============================================================
# def clear_wishlist(user_id=None, guest_id=None):
#     """
#     Clears all wishlist items for a given user or guest.
#     """
#     wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)
#     repo.clear_items(wishlist_id, user_id, guest_id)
#     return {"status": "success", "message": "Wishlist cleared"}

# # ============================================================
# # MOVE TO CART (FINAL FIXED VERSION — CLEAN REPO LAYER)
# # ============================================================

# from db import get_db_connection

# def move_to_cart(product_id, variant_id, user_id=None, guest_id=None):
#     """
#     Moves a product from the wishlist to the cart.
#     - Validates product existence.
#     - If variant already exists in cart, increments quantity.
#     - Uses existing cart_service.add_item() for persistence.
#     - Removes product from wishlist and logs audit.
#     """
#     wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)

#     # 1️⃣ Validate product
#     if not repo.product_exists(product_id):
#         return {"status": "error", "message": "Product not found"}

#     try:
#         # 2️⃣ Ensure cart
#         if user_id:
#             cart_info = cart_service.ensure_cart_for_user(user_id)
#         else:
#             cart_info = cart_service.ensure_cart_for_guest(guest_id)

#         cart_id = cart_info["cart_id"]

#         # 3️⃣ Determine correct quantity
#         conn = get_db_connection()
#         existing = conn.execute(
#             "SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?",
#             (cart_id, variant_id)
#         ).fetchone()
#         desired_qty = existing["quantity"] + 1 if existing else 1
#         conn.close()

#         # 4️⃣ Add/update cart item
#         cart_data = cart_service.add_item(cart_id, variant_id, desired_qty)

#         # 5️⃣ Remove from wishlist
#         repo.remove_item(wishlist_id, product_id, user_id, guest_id)

#         # 6️⃣ Log valid audit event
#         repo.log_audit(
#             "remove",  # valid per CHECK constraint
#             wishlist_id,
#             user_id,
#             guest_id,
#             product_id,
#             variant_id=variant_id,
#             message=f"Moved product {product_id} (variant {variant_id}) to cart (qty={desired_qty})"
#         )

#         return {
#             "status": "success",
#             "message": "Item moved to cart successfully",
#             "cart": cart_data,
#         }

#     except Exception as e:
#         return {"status": "error", "message": str(e)}

# # ============================================================
# # MERGE GUEST → USER WISHLIST
# # ============================================================

# # def merge_guest_wishlist_into_user(user_id: int, guest_id: str):
# #     """Move all wishlist items from guest wishlist into the user's wishlist, deleting guest wishlist."""
# #     conn = get_db_connection()
# #     with conn:
# #         guest_wishlist = repo.get_wishlist_by_guest_id(conn, guest_id)
# #         if not guest_wishlist:
# #             return {"status": "skipped", "reason": "no active guest wishlist"}

# #         user_wishlist = repo.get_wishlist_by_user_id(conn, user_id)
# #         if not user_wishlist:
# #             user_wishlist_id = repo.create_user_wishlist(conn, user_id)
# #         else:
# #             user_wishlist_id = user_wishlist["wishlist_id"]

# #         repo.transfer_wishlist_items(conn, guest_wishlist["wishlist_id"], user_wishlist_id)
# #         repo.record_wishlist_merge_audit(conn, user_wishlist_id, user_id, guest_id)
# #         repo.delete_guest_wishlist(conn, guest_id)

# #         conn.commit()
# #         return {"status": "merged", "user_wishlist_id": user_wishlist_id}

# def merge_guest_wishlist_into_user(user_id: int, guest_id: str):
#     """Merge guest wishlist into user wishlist without deletion (auth.py-compatible)."""
#     conn = get_db_connection()
#     with conn:
#         guest_wishlist = repo.get_wishlist_by_guest_id(conn, guest_id)
#         if not guest_wishlist:
#             return {"status": "skipped", "reason": "no active guest wishlist"}

#         user_wishlist = repo.get_wishlist_by_user_id(conn, user_id)
#         if not user_wishlist:
#             user_wishlist_id = repo.create_user_wishlist(conn, user_id)
#         else:
#             user_wishlist_id = user_wishlist["wishlist_id"]

#         repo.transfer_wishlist_items(conn, guest_wishlist["wishlist_id"], user_wishlist_id)
#         repo.record_wishlist_merge_audit(conn, user_wishlist_id, user_id, guest_id)
#         repo.mark_wishlist_merged(conn, guest_id)

#         conn.commit()
#         return {"status": "merged", "user_wishlist_id": user_wishlist_id}


# # ============================================================
# # ARCHIVE WISHLIST
# # ============================================================
# def archive_wishlist(wishlist_id):
#     """
#     Archives a wishlist for long-term storage.
#     Changes its status to 'archived' and logs the event.
#     """
#     repo.update_wishlist_status(wishlist_id, "archived")
#     repo.log_audit("archive", wishlist_id, message="Wishlist archived")
#     return {"status": "success", "message": "Wishlist archived"}

# domain/wishlist/service.py — Unified Wishlist Service (Revised Merge-Consistent)
from datetime import datetime
from db import get_db_connection
from domain.wishlist import repository as repo
from domain.cart import service as cart_service


# ============================================================
# WISHLIST ENSURE HELPERS
# ============================================================
def ensure_wishlist_for_guest(guest_id: str):
    wishlist_id = repo.get_or_create_wishlist(guest_id=guest_id)
    return {"wishlist_id": wishlist_id, "guest_id": guest_id}


# def ensure_wishlist_for_user(user_id):
#     """Guarantee a wishlist exists for this user."""
#     with get_db_connection() as conn:
#         row = conn.execute(
#             "SELECT wishlist_id FROM wishlists WHERE user_id = ? AND status = 'active';",
#             (user_id,)
#         ).fetchone()
#         if row:
#             return row["wishlist_id"]
#         wishlist_id = repo.create_user_wishlist(conn, user_id)
#         # conn.commit()
#         return wishlist_id
    
def ensure_wishlist_for_user(user_id, conn=None):
    """
    Guarantee a wishlist exists for this user.
    Uses the provided connection if available; otherwise opens its own.
    Ensures the transaction is committed if created internally.
    """
    internal_conn = False
    if conn is None:
        conn = get_db_connection()
        internal_conn = True

    try:
        row = conn.execute(
            "SELECT wishlist_id FROM wishlists WHERE user_id = ? AND status = 'active';",
            (user_id,),
        ).fetchone()
        if row:
            if internal_conn:
                conn.close()
            return row["wishlist_id"]

        wishlist_id = repo.create_user_wishlist(conn, user_id)

        if internal_conn:
            conn.commit()
            conn.close()

        return wishlist_id

    except Exception as e:
        if internal_conn:
            conn.rollback()
            conn.close()
        raise e



# ============================================================
# GET WISHLIST ITEMS
# ============================================================
def get_wishlist(user_id=None, guest_id=None):
    if not user_id and not guest_id:
        return {"status": "error", "message": "No valid user or guest context"}

    wishlist_id = repo.get_or_create_wishlist(user_id=user_id, guest_id=guest_id)

    items = repo.get_items(wishlist_id)
    return {"wishlist_id": wishlist_id, "count": len(items), "items": items}


# ============================================================
# GET WISHLIST COUNT
# ============================================================
def get_count(user_id=None, guest_id=None):
    if not user_id and not guest_id:
        return {"status": "error", "message": "No valid user or guest context"}

    wishlist_id = repo.get_or_create_wishlist(user_id=user_id, guest_id=guest_id)
    return repo.get_count(wishlist_id)


# ============================================================
# ADD / REMOVE / CLEAR
# ============================================================
def add_to_wishlist(product_id, user_id=None, guest_id=None):
    if not user_id and not guest_id:
        return {"status": "error", "message": "No valid user or guest context"}
    wishlist_id = repo.get_or_create_wishlist(user_id=user_id, guest_id=guest_id)
    if not repo.product_exists(product_id):
        return {"status": "error", "message": "Product not found"}
    repo.add_item(wishlist_id, product_id, user_id, guest_id)
    return {"status": "success", "message": "Product added to wishlist"}


def remove_from_wishlist(product_id, user_id=None, guest_id=None):
    if not user_id and not guest_id:
        return {"status": "error", "message": "No valid user or guest context"}
    wishlist_id = repo.get_or_create_wishlist(user_id=user_id, guest_id=guest_id)
    repo.remove_item(wishlist_id, product_id, user_id, guest_id)
    return {"status": "success", "message": "Product removed from wishlist"}


def clear_wishlist(user_id=None, guest_id=None):
    if not user_id and not guest_id:
        return {"status": "error", "message": "No valid user or guest context"}
    wishlist_id = repo.get_or_create_wishlist(user_id=user_id, guest_id=guest_id)
    repo.clear_items(wishlist_id, user_id, guest_id)
    return {"status": "success", "message": "Wishlist cleared"}


# ============================================================
# MOVE TO CART
# ============================================================
def move_to_cart(product_id, variant_id, user_id=None, guest_id=None):
    wishlist_id = repo.get_or_create_wishlist(user_id=user_id, guest_id=guest_id)
    if not repo.product_exists(product_id):
        return {"status": "error", "message": "Product not found"}

    try:
        if user_id:
            cart_info = cart_service.ensure_cart_for_user(user_id)
        else:
            cart_info = cart_service.ensure_cart_for_guest(guest_id)
        cart_id = cart_info["cart_id"]

        conn = get_db_connection()
        # existing = conn.execute(
        #     "SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?;",
        #     (cart_id, variant_id),
        # ).fetchone()
        # desired_qty = (existing["quantity"] + 1) if existing else 1
        # conn.close()

        cart_data = cart_service.add_item(cart_id, variant_id, 1)
        repo.remove_item(wishlist_id, product_id, user_id, guest_id)
        repo.log_audit(
            "remove",
            wishlist_id,
            user_id,
            guest_id,
            product_id,
            variant_id=variant_id,
            message=f"Moved product {product_id} (variant {variant_id}) to cart (qty=+1)",
        )
        return {
            "status": "success",
            "message": "Item moved to cart successfully",
            "cart": cart_data,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ============================================================
# MERGE GUEST → USER WISHLIST (REVISED)
# ============================================================
# def merge_guest_wishlist_into_user(user_id: int, guest_id: str):
#     """
#     Merge guest wishlist into user wishlist safely.
#     No wishlist is created automatically — creation handled in user.py.
#     """
#     conn = get_db_connection()
#     with conn:
#         guest_wishlist = repo.get_wishlist_by_guest_id(conn, guest_id)
#         if not guest_wishlist:
#             return {"status": "skipped", "reason": "no active guest wishlist"}

#         user_wishlist = repo.get_wishlist_by_user_id(conn, user_id)
#         if not user_wishlist:
#             return {"status": "deferred", "reason": "no active user wishlist"}

#         guest_wishlist_id = guest_wishlist["wishlist_id"]
#         user_wishlist_id = user_wishlist["wishlist_id"]

#         merge_result = repo.merge_wishlist_items_atomic(conn, guest_wishlist_id, user_wishlist_id, user_id)
#         repo.mark_wishlist_merged(conn, guest_id)
#         repo.insert_wishlist_merge_audit(
#             conn,
#             user_wishlist_id,
#             guest_wishlist_id,
#             user_id,
#             guest_id,
#             merge_result["added"],
#             merge_result["skipped"],
#         )

#         conn.commit()
#         return {
#             "status": "merged",
#             "guest_wishlist_id": guest_wishlist_id,
#             "user_wishlist_id": user_wishlist_id,
#             **merge_result,
#         }
def merge_guest_wishlist_into_user(conn, user_id, guest_id):
    """
    Simple guest→user wishlist transfer. No conflict or merge audit.
    """
    guest_wishlist = repo.get_wishlist_by_guest(conn, guest_id)
    if not guest_wishlist:
        return {"transferred": 0, "status": "none"}

    user_wishlist = repo.get_wishlist_by_user(conn, user_id)
    transferred = 0

    if not user_wishlist:
        conn.execute(
            "UPDATE wishlists SET user_id = ?, guest_id = NULL, updated_at = datetime('now') WHERE wishlist_id = ?;",
            (user_id, guest_wishlist["wishlist_id"]),
        )
        conn.execute(
            "UPDATE wishlist_items SET user_id = ? WHERE wishlist_id = ?;",
            (user_id, guest_wishlist["wishlist_id"]),
        )
        repo.log_addition_event(conn, user_id, None, "wishlist", f"Wishlist reassigned from guest {guest_id}")
        return {"transferred": 0, "status": "attached"}

    # Move non-duplicate products
    guest_items = repo.get_wishlist_items(conn, guest_wishlist["wishlist_id"])
    for item in guest_items:
        exists = repo.wishlist_item_exists(conn, user_wishlist["wishlist_id"], item["product_id"])
        if not exists:
            conn.execute(
                """
                INSERT INTO wishlist_items (wishlist_id, user_id, product_id, created_at, updated_at)
                VALUES (?, ?, ?, datetime('now'), datetime('now'))
                """,
                (user_wishlist["wishlist_id"], user_id, item["product_id"]),
            )
            transferred += 1

    # Remove guest wishlist and its items
    conn.execute("DELETE FROM wishlist_items WHERE wishlist_id = ?;", (guest_wishlist["wishlist_id"],))
    conn.execute("DELETE FROM wishlists WHERE wishlist_id = ?;", (guest_wishlist["wishlist_id"],))

    repo.log_addition_event(conn, user_id, None, "wishlist", f"{transferred} products transferred from guest {guest_id}")
    return {"transferred": transferred, "status": "attached"}



# ============================================================
# ARCHIVE WISHLIST
# ============================================================
def archive_wishlist(wishlist_id):
    repo.update_wishlist_status(wishlist_id, "archived")
    repo.log_audit("archive", wishlist_id, message="Wishlist archived")
    return {"status": "success", "message": "Wishlist archived"}

def update_wishlist_status(wishlist_id, status):
    with get_db_connection() as con:
        con.execute(
            "UPDATE wishlists SET status = ?, updated_at = datetime('now') WHERE wishlist_id = ?;",
            (status, wishlist_id),
        )
        con.commit()
