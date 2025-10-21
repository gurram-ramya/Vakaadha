# domain/wishlist/service.py

"""
Vakaadha — Wishlist Service Layer
=================================

Implements business logic for wishlist operations:
- CRUD orchestration
- Guest ↔ User identity handling
- Merge logic
- Move-to-Cart integration
- Error validation and audit handling
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
    if not (user_id or guest_id):
        raise ValueError("Either user_id or guest_id must be provided")
    return user_id, guest_id


# -------------------------------------------------------------
# CORE OPERATIONS
# -------------------------------------------------------------

def get_wishlist(user_id: Optional[int] = None, guest_id: Optional[str] = None) -> list[dict]:
    """Fetch full enriched wishlist with product info."""
    user_id, guest_id = _identity(user_id, guest_id)
    con = get_db_connection()
    rows = con.execute("""
        SELECT w.wishlist_id AS wishlist_item_id,
               w.product_id,
               w.variant_id,
               p.name,
               ROUND(v.price_cents / 100.0, 2) AS price,
               i.quantity AS stock,
               CASE WHEN i.quantity > 0 THEN 1 ELSE 0 END AS available,
               img.image_url
        FROM wishlist_items w
        LEFT JOIN product_variants v ON v.variant_id = w.variant_id
        LEFT JOIN products p ON p.product_id = w.product_id
        LEFT JOIN inventory i ON i.variant_id = w.variant_id
        LEFT JOIN product_images img ON img.product_id = w.product_id AND img.sort_order = 0
        WHERE (w.user_id = ? OR w.guest_id = ?)
        ORDER BY w.created_at DESC
    """, (user_id, guest_id)).fetchall()

    return [dict(r) for r in rows]


def get_count(user_id: Optional[int] = None, guest_id: Optional[str] = None) -> int:
    """Return total count for navbar refresh."""
    user_id, guest_id = _identity(user_id, guest_id)
    return repo.count_items(user_id=user_id, guest_id=guest_id)

def add_to_wishlist(product_id: int, variant_id: int,
                    user_id: Optional[int] = None,
                    guest_id: Optional[str] = None) -> dict:
    """Add item to wishlist with dedup and validation."""
    user_id, guest_id = _identity(user_id, guest_id)
    con = get_db_connection()

    # Validate variant existence
    row = con.execute("SELECT product_id FROM product_variants WHERE variant_id = ?", (variant_id,)).fetchone()
    if not row:
        raise ValueError("Variant not found")

    product_id = product_id or row["product_id"]

    with transaction():
        # UPSERT: avoid duplicates per (user/guest, variant)
        con.execute("""
            INSERT INTO wishlist_items (user_id, guest_id, product_id, variant_id, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(user_id, variant_id) DO UPDATE SET updated_at = datetime('now')
        """, (user_id, guest_id, product_id, variant_id))

        if ENABLE_WISHLIST_AUDIT:
            repo.log_audit("add", user_id, guest_id, product_id, variant_id, con)

    logging.info(f"[wishlist] add: variant={variant_id} user={user_id} guest={guest_id}")
    return {"status": "ok", "variant_id": variant_id}


def remove_from_wishlist(wishlist_item_id: int,
                         user_id: Optional[int] = None,
                         guest_id: Optional[str] = None) -> dict:
    """Remove a single wishlist item."""
    user_id, guest_id = _identity(user_id, guest_id)
    count = repo.remove_item(wishlist_item_id, user_id, guest_id)
    return {"removed": count}


def clear_wishlist(user_id: Optional[int] = None,
                   guest_id: Optional[str] = None) -> dict:
    """Clear all wishlist items for identity."""
    user_id, guest_id = _identity(user_id, guest_id)
    count = repo.clear(user_id, guest_id)
    logging.info(f"[wishlist] Cleared {count} items for user={user_id} guest={guest_id}")
    return {"cleared": count}


# -------------------------------------------------------------
# MOVE-TO-CART INTEGRATION
# -------------------------------------------------------------
def move_to_cart(variant_id: int,
                 user_id: Optional[int] = None,
                 guest_id: Optional[str] = None) -> dict:
    """
    Move a wishlist item to cart.
    - If variant already in cart → increment qty 1
    - If out of stock → 409 error
    - On success → remove from wishlist
    """
    user_id, guest_id = _identity(user_id, guest_id)

    # Check stock availability
    con = get_db_connection()
    stock_row = con.execute(
        "SELECT quantity FROM inventory WHERE variant_id = ?",
        (variant_id,)
    ).fetchone()
    if not stock_row:
        raise ValueError("Variant not found in inventory")
    if stock_row["quantity"] <= 0:
        return {"status": "error", "code": 409, "message": "StockConflict"}

    # Fetch product_id for logging
    prod_row = con.execute(
        "SELECT product_id FROM product_variants WHERE variant_id = ?",
        (variant_id,)
    ).fetchone()
    product_id = prod_row["product_id"] if prod_row else None

    # Add to cart and remove from wishlist
    try:
        with transaction():
            cart_service.add_item(
                product_id=product_id,
                variant_id=variant_id,
                quantity=1,
                user_id=user_id,
                guest_id=guest_id
            )
            # Remove from wishlist after success
            con.execute(
                "DELETE FROM wishlist_items WHERE variant_id = ? AND (user_id = ? OR guest_id = ?)",
                (variant_id, user_id, guest_id)
            )
            if repo.ENABLE_WISHLIST_AUDIT:
                repo.log_audit("move_to_cart", user_id, guest_id, product_id, variant_id, con)
        logging.info(f"[wishlist] Moved variant {variant_id} to cart for user={user_id} guest={guest_id}")
        return {"status": "ok"}
    except Exception as e:
        logging.exception(f"[wishlist] Move-to-cart failed: {e}")
        raise


# -------------------------------------------------------------
# MERGE LOGIC (Guest → User)
# -------------------------------------------------------------
def merge_guest_wishlist(user_id: int, guest_id: str) -> dict:
    """
    Merge guest wishlist items into user's wishlist.
    Runs after cart merge in login flow.
    """
    merged = repo.merge_guest_into_user(user_id, guest_id)
    logging.info(f"[wishlist] Merged {merged} items from guest={guest_id} → user={user_id}")
    return {"merged": merged}
