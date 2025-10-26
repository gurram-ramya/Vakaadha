# domain/wishlist/service.py — Vakaadha Wishlist Service v2
from datetime import datetime
from domain.wishlist import repository as repo
from domain.cart import service as cart_service


# ============================================================
# GET WISHLIST ITEMS
# ============================================================
def get_wishlist(user_id=None, guest_id=None):
    """
    Fetch all wishlist items for a given user or guest.
    Automatically creates a wishlist if none exists.
    Returns structured payload with count and items.
    """
    wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)
    items = repo.get_items(wishlist_id)
    return {
        "wishlist_id": wishlist_id,
        "count": len(items),
        "items": items
    }


# ============================================================
# GET WISHLIST COUNT
# ============================================================
def get_count(user_id=None, guest_id=None):
    """
    Returns the total number of items in a user's or guest's wishlist.
    """
    wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)
    return repo.get_count(wishlist_id)


# ============================================================
# ADD TO WISHLIST
# ============================================================
def add_to_wishlist(product_id, user_id=None, guest_id=None):
    """
    Adds a product to the wishlist (user or guest).
    Automatically creates a wishlist if needed.
    """
    wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)

    # Validate product existence
    if not repo.product_exists(product_id):
        return {"status": "error", "message": "Product not found"}

    repo.add_item(wishlist_id, product_id, user_id, guest_id)
    return {"status": "success", "message": "Product added to wishlist"}


# ============================================================
# REMOVE FROM WISHLIST
# ============================================================
def remove_from_wishlist(product_id, user_id=None, guest_id=None):
    """
    Removes a product from the wishlist (user or guest).
    """
    wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)
    repo.remove_item(wishlist_id, product_id, user_id, guest_id)
    return {"status": "success", "message": "Product removed from wishlist"}


# ============================================================
# CLEAR WISHLIST
# ============================================================
def clear_wishlist(user_id=None, guest_id=None):
    """
    Clears all wishlist items for a given user or guest.
    """
    wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)
    repo.clear_items(wishlist_id, user_id, guest_id)
    return {"status": "success", "message": "Wishlist cleared"}

# ============================================================
# MOVE TO CART (FINAL FIXED VERSION — CLEAN REPO LAYER)
# ============================================================
# # ============================================================
# # MOVE TO CART (FINAL & FIXED)
# # ============================================================
# def move_to_cart(product_id, variant_id, user_id=None, guest_id=None):
#     """
#     Moves a product from the wishlist to the cart.
#     - Validates product existence.
#     - Uses existing cart_service.add_item() for atomic add/update.
#     - Removes the product from wishlist after successful add.
#     - Logs valid audit entry.
#     """
#     from db import get_db_connection  # avoid circular import

#     wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)

#     # ✅ 1. Validate product existence
#     if not repo.product_exists(product_id):
#         return {"status": "error", "message": "Product not found"}

#     try:
#         # ✅ 2. Ensure cart exists
#         if user_id:
#             cart_info = cart_service.ensure_cart_for_user(user_id)
#         else:
#             cart_info = cart_service.ensure_cart_for_guest(guest_id)

#         cart_id = cart_info["cart_id"]

#         # ✅ 3. Add to cart (handles increment logic automatically)
#         cart_data = cart_service.add_item(cart_id, variant_id, 1)

#         # ✅ 4. Remove from wishlist
#         repo.remove_item(wishlist_id, product_id, user_id, guest_id)

#         # ✅ 5. Audit log (use valid action to satisfy DB constraint)
#         repo.log_audit(
#             "remove",  # <-- valid per CHECK constraint
#             wishlist_id,
#             user_id,
#             guest_id,
#             product_id,
#             variant_id=variant_id,
#             message=f"Product {product_id} (variant {variant_id}) moved to cart"
#         )

#         # ✅ 6. Return consistent dict to frontend
#         return {
#             "status": "success",
#             "message": "Item moved to cart successfully",
#             "cart": cart_data
#         }

#     except Exception as e:
#         return {"status": "error", "message": str(e)}

from db import get_db_connection

def move_to_cart(product_id, variant_id, user_id=None, guest_id=None):
    """
    Moves a product from the wishlist to the cart.
    - Validates product existence.
    - If variant already exists in cart, increments quantity.
    - Uses existing cart_service.add_item() for persistence.
    - Removes product from wishlist and logs audit.
    """
    wishlist_id = repo.get_or_create_wishlist(user_id, guest_id)

    # 1️⃣ Validate product
    if not repo.product_exists(product_id):
        return {"status": "error", "message": "Product not found"}

    try:
        # 2️⃣ Ensure cart
        if user_id:
            cart_info = cart_service.ensure_cart_for_user(user_id)
        else:
            cart_info = cart_service.ensure_cart_for_guest(guest_id)

        cart_id = cart_info["cart_id"]

        # 3️⃣ Determine correct quantity
        conn = get_db_connection()
        existing = conn.execute(
            "SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?",
            (cart_id, variant_id)
        ).fetchone()
        desired_qty = existing["quantity"] + 1 if existing else 1
        conn.close()

        # 4️⃣ Add/update cart item
        cart_data = cart_service.add_item(cart_id, variant_id, desired_qty)

        # 5️⃣ Remove from wishlist
        repo.remove_item(wishlist_id, product_id, user_id, guest_id)

        # 6️⃣ Log valid audit event
        repo.log_audit(
            "remove",  # valid per CHECK constraint
            wishlist_id,
            user_id,
            guest_id,
            product_id,
            variant_id=variant_id,
            message=f"Moved product {product_id} (variant {variant_id}) to cart (qty={desired_qty})"
        )

        return {
            "status": "success",
            "message": "Item moved to cart successfully",
            "cart": cart_data,
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

# ============================================================
# MERGE GUEST → USER WISHLIST
# ============================================================
def merge_guest_wishlist(user_id, guest_id):
    """
    Merge a guest's wishlist into a logged-in user's wishlist.
    - Transfers guest wishlist items to user's wishlist.
    - Marks guest wishlist as merged.
    - Logs merge actions.
    """
    if not user_id or not guest_id:
        return {"status": "error", "message": "Missing user_id or guest_id"}

    guest_wishlist = repo.get_wishlist_by_guest(guest_id)
    user_wishlist = repo.get_wishlist_by_user(user_id)

    if not guest_wishlist:
        return {"status": "success", "message": "No guest wishlist to merge"}

    if not user_wishlist:
        user_wishlist_id = repo.get_or_create_wishlist(user_id=user_id)
    else:
        user_wishlist_id = user_wishlist["wishlist_id"]

    added = repo.merge_wishlists(guest_wishlist["wishlist_id"], user_wishlist_id)
    repo.update_wishlist_status(guest_wishlist["wishlist_id"], "merged")
    repo.log_audit("merge", user_wishlist_id, user_id, guest_id, message=f"Merged {added} items")

    return {"status": "success", "message": f"Merged {added} items from guest wishlist"}


# ============================================================
# ARCHIVE WISHLIST
# ============================================================
def archive_wishlist(wishlist_id):
    """
    Archives a wishlist for long-term storage.
    Changes its status to 'archived' and logs the event.
    """
    repo.update_wishlist_status(wishlist_id, "archived")
    repo.log_audit("archive", wishlist_id, message="Wishlist archived")
    return {"status": "success", "message": "Wishlist archived"}
