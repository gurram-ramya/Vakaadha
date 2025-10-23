# domain/wishlist/repository.py

"""
Vakaadha — Wishlist Repository Layer (Product-level Schema)
===========================================================

This module provides low-level SQL access for wishlist operations.

Updated for simplified schema:
- Wishlist uniqueness is now (user_id, product_id) or (guest_id, product_id)
- variant_id is optional (used only for enrichment and move-to-cart)
"""

import logging
from typing import Optional
from db import get_db_connection, transaction, query_all

ENABLE_WISHLIST_AUDIT = True


# -------------------------------------------------------------
# CRUD OPERATIONS
# -------------------------------------------------------------
def add_item(product_id: int,
             user_id: Optional[int] = None,
             guest_id: Optional[str] = None,
             variant_id: Optional[int] = None) -> None:
    """
    Insert or update a wishlist item atomically.
    Ensures uniqueness by (user_id OR guest_id, product_id).
    """
    if not (user_id or guest_id):
        raise ValueError("Either user_id or guest_id must be provided")

    with transaction() as con:
        if user_id:
            con.execute("""
                INSERT INTO wishlist_items (user_id, product_id, variant_id, created_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(user_id, product_id) DO UPDATE
                    SET updated_at = datetime('now');
            """, (user_id, product_id, variant_id))
        else:
            con.execute("""
                INSERT INTO wishlist_items (guest_id, product_id, variant_id, created_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(guest_id, product_id) DO UPDATE
                    SET updated_at = datetime('now');
            """, (guest_id, product_id, variant_id))

        if ENABLE_WISHLIST_AUDIT:
            log_audit("add", user_id, guest_id, product_id, variant_id, con=con)


def remove_item(product_id: int,
                user_id: Optional[int] = None,
                guest_id: Optional[str] = None) -> int:
    """
    Delete a wishlist item by product ID for a given user or guest.
    Returns the number of rows affected.
    """
    if not (user_id or guest_id):
        raise ValueError("Either user_id or guest_id must be provided")

    with transaction() as con:
        row = con.execute("""
            SELECT product_id, variant_id FROM wishlist_items
            WHERE product_id = ? AND (user_id = ? OR guest_id = ?)
        """, (product_id, user_id, guest_id)).fetchone()

        cur = con.execute("""
            DELETE FROM wishlist_items
            WHERE product_id = ? AND (user_id = ? OR guest_id = ?)
        """, (product_id, user_id, guest_id))
        count = cur.rowcount

        if ENABLE_WISHLIST_AUDIT and row:
            log_audit("remove", user_id, guest_id,
                      row["product_id"], row["variant_id"], con=con)
        return count


def clear(user_id: Optional[int] = None, guest_id: Optional[str] = None) -> int:
    """
    Remove all wishlist items for a given identity.
    """
    if not (user_id or guest_id):
        return 0

    with transaction() as con:
        if ENABLE_WISHLIST_AUDIT:
            con.execute("""
                INSERT INTO wishlist_audit (user_id, guest_id, product_id, variant_id, action)
                SELECT user_id, guest_id, product_id, variant_id, 'remove'
                FROM wishlist_items WHERE user_id = ? OR guest_id = ?
            """, (user_id, guest_id))

        cur = con.execute("""
            DELETE FROM wishlist_items WHERE user_id = ? OR guest_id = ?
        """, (user_id, guest_id))
        return cur.rowcount


# -------------------------------------------------------------
# RETRIEVAL & ENRICHMENT
# -------------------------------------------------------------
def get_items(user_id: Optional[int] = None,
              guest_id: Optional[str] = None) -> list[dict]:
    """
    Retrieve wishlist items with enrichment data.
    Supports both logged-in and guest users.
    """
    if not (user_id or guest_id):
        return []

    sql = """
        SELECT
            w.product_id,
            w.variant_id,
            p.name,
            ROUND(v.price_cents / 100.0, 2) AS price,
            COALESCE(i.quantity, 0) AS stock,
            CASE WHEN i.quantity > 0 THEN 1 ELSE 0 END AS available,
            img.image_url
        FROM wishlist_items w
        LEFT JOIN product_variants v ON v.variant_id = w.variant_id
        LEFT JOIN products p ON p.product_id = w.product_id
        LEFT JOIN inventory i ON i.variant_id = w.variant_id
        LEFT JOIN product_images img ON img.product_id = w.product_id AND img.sort_order = 0
        WHERE (w.user_id = ? OR w.guest_id = ?)
        ORDER BY w.created_at DESC;
    """
    rows = query_all(sql, (user_id, guest_id))
    return [dict(row) | {"available": bool(row["available"])} for row in rows]


def count_items(user_id: Optional[int] = None,
                guest_id: Optional[str] = None) -> int:
    """Return total wishlist count (for navbar refresh)."""
    con = get_db_connection()
    cur = con.execute("""
        SELECT COUNT(*) AS c FROM wishlist_items
        WHERE user_id = ? OR guest_id = ?
    """, (user_id, guest_id))
    row = cur.fetchone()
    return row["c"] if row else 0


# -------------------------------------------------------------
# MERGE OPERATIONS
# -------------------------------------------------------------
def merge_guest_into_user(user_id: int, guest_id: str) -> int:
    """
    Merge all guest wishlist items into the user's wishlist.
    Deduplicates on (user_id, product_id).
    """
    with transaction() as con:
        cur = con.execute("""
            INSERT OR IGNORE INTO wishlist_items (user_id, product_id, variant_id, created_at)
            SELECT ?, product_id, variant_id, datetime('now')
            FROM wishlist_items
            WHERE guest_id = ?;
        """, (user_id, guest_id))
        merged_count = cur.rowcount

        con.execute("DELETE FROM wishlist_items WHERE guest_id = ?", (guest_id,))

        if ENABLE_WISHLIST_AUDIT and merged_count > 0:
            con.execute("""
                INSERT INTO wishlist_audit (user_id, guest_id, product_id, variant_id, action)
                SELECT ?, ?, product_id, variant_id, 'merge'
                FROM wishlist_items WHERE user_id = ?;
            """, (user_id, guest_id, user_id))

        logging.info(f"[wishlist] merged {merged_count} guest→user (guest_id={guest_id}, user_id={user_id})")
        return merged_count


# -------------------------------------------------------------
# AUDIT LOGGING
# -------------------------------------------------------------
def log_audit(action: str, user_id: Optional[int], guest_id: Optional[str],
              product_id: Optional[int], variant_id: Optional[int],
              con=None) -> None:
    """Record an audit entry safely (non-fatal if fails)."""
    try:
        connection = con or get_db_connection()
        connection.execute("""
            INSERT INTO wishlist_audit (user_id, guest_id, product_id, variant_id, action)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, guest_id, product_id, variant_id, action))
        if con is None:
            connection.commit()
    except Exception as e:
        logging.warning(f"[wishlist_audit] failed: {e}")
