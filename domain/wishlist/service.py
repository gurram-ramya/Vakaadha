# domain/wishlist/service.py

"""
Vakaadha — Wishlist Service Layer (Product-level Schema)
========================================================

Implements business logic for wishlist operations:
- CRUD orchestration
- Guest ↔ User identity handling
- Merge logic
- Move-to-Cart integration with size (variant) selection
"""

import logging
from typing import Optional

from domain.wishlist import repository as repo
from domain.cart import service as cart_service
from db import transaction, get_db_connection

ENABLE_WISHLIST_AUDIT = True


# -------------------------------------------------------------
# HELPERS
# -------------------------------------------------------------
def _identity(user_id: Optional[int], guest_id: Optional[str]) -> tuple[Optional[int], Optional[str]]:
    """Ensure at least one identity (user or guest) exists."""
    if not (user_id or guest_id):
        raise ValueError("Either user_id or guest_id must be provided")
    return user_id, guest_id


# -------------------------------------------------------------
# CORE OPERATIONS
# -------------------------------------------------------------
def get_wishlist(user_id: Optional[int] = None, guest_id: Optional[str] = None) -> list[dict]:
    """Fetch wishlist items (enriched with product info)."""
    user_id, guest_id = _identity(user_id, guest_id)
    items = repo.get_items(user_id=user_id, guest_id=guest_id)
    return items


def get_count(user_id: Optional[int] = None, guest_id: Optional[str] = None) -> int:
    """Return wishlist item count for navbar refresh."""
    user_id, guest_id = _identity(user_id, guest_id)
    return repo.count_items(user_id=user_id, guest_id=guest_id)


def add_to_wishlist(product_id: int,
                    user_id: Optional[int] = None,
                    guest_id: Optional[str] = None,
                    variant_id: Optional[int] = None) -> dict:
    """
    Add a product to wishlist.
    - Only product_id is required (variant optional)
    - Deduplicates per (user_id, product_id)
    """
    user_id, guest_id = _identity(user_id, guest_id)

    if not product_id:
        raise ValueError("Product ID is required")

    repo.add_item(product_id, user_id=user_id, guest_id=guest_id, variant_id=variant_id)
    logging.info(f"[wishlist] add: product={product_id}, user={user_id}, guest={guest_id}")
    return {"status": "ok", "product_id": product_id}


def remove_from_wishlist(product_id: int,
                         user_id: Optional[int] = None,
                         guest_id: Optional[str] = None) -> dict:
    """
    Remove a single wishlist item by product_id.
    """
    user_id, guest_id = _identity(user_id, guest_id)
    count = repo.remove_item(product_id, user_id, guest_id)
    logging.info(f"[wishlist] remove: product={product_id}, user={user_id}, guest={guest_id}")
    return {"removed": count}


def clear_wishlist(user_id: Optional[int] = None,
                   guest_id: Optional[str] = None) -> dict:
    """Clear all wishlist items for a given identity."""
    user_id, guest_id = _identity(user_id, guest_id)
    count = repo.clear(user_id, guest_id)
    logging.info(f"[wishlist] Cleared {count} items for user={user_id} guest={guest_id}")
    return {"cleared": count}


# -------------------------------------------------------------
# MOVE-TO-CART INTEGRATION (with size selection)
# -------------------------------------------------------------
def move_to_cart(product_id: int,
                 variant_id: int,
                 user_id: Optional[int] = None,
                 guest_id: Optional[str] = None) -> dict:
    """
    Move a wishlist product to cart.
    - Requires variant_id (user selected size)
    - If stock available → add to cart
    - Removes wishlist entry upon success
    """
    user_id, guest_id = _identity(user_id, guest_id)

    con = get_db_connection()

    # Validate variant exists and has stock
    stock_row = con.execute(
        "SELECT quantity FROM inventory WHERE variant_id = ?",
        (variant_id,)
    ).fetchone()
    if not stock_row:
        raise ValueError("Variant not found in inventory")
    if stock_row["quantity"] <= 0:
        return {"status": "error", "code": 409, "message": "OutOfStock"}

    # Add to cart & remove wishlist entry
    try:
        with transaction():
            cart_service.add_item(
                product_id=product_id,
                variant_id=variant_id,
                quantity=1,
                user_id=user_id,
                guest_id=guest_id
            )
            # Remove wishlist entry after successful cart add
            con.execute("""
                DELETE FROM wishlist_items
                WHERE product_id = ? AND (user_id = ? OR guest_id = ?)
            """, (product_id, user_id, guest_id))

            if ENABLE_WISHLIST_AUDIT:
                repo.log_audit("move_to_cart", user_id, guest_id, product_id, variant_id, con)
        logging.info(f"[wishlist] Moved product={product_id} variant={variant_id} to cart for user={user_id} guest={guest_id}")
        return {"status": "ok", "product_id": product_id, "variant_id": variant_id}
    except Exception as e:
        logging.exception(f"[wishlist] Move-to-cart failed: {e}")
        raise


# -------------------------------------------------------------
# MERGE LOGIC (Guest → User)
# -------------------------------------------------------------
def merge_guest_wishlist(user_id: int, guest_id: str) -> dict:
    """Merge guest wishlist items into user's wishlist."""
    merged = repo.merge_guest_into_user(user_id, guest_id)
    logging.info(f"[wishlist] Merged {merged} items from guest={guest_id} → user={user_id}")
    return {"merged": merged}
