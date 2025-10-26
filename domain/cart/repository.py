# domain/cart/repository.py — Vakaadha Cart Repository (Phase 1)
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from db import get_db_connection

# =============================================================
# Repository: Core Cart Data Access Layer
# =============================================================

# ----------------------------
# CARTS
# ----------------------------
def get_cart_by_guest_id(conn, guest_id: str):
    cur = conn.execute("SELECT * FROM carts WHERE guest_id = ?", (guest_id,))
    return cur.fetchone()


def get_cart_by_user_id(conn, user_id: int):
    cur = conn.execute("SELECT * FROM carts WHERE user_id = ?", (user_id,))
    return cur.fetchone()


def create_guest_cart(conn, guest_id: str, ttl_days: int = 7):
    ttl_expires_at = (datetime.utcnow() + timedelta(days=ttl_days)).isoformat()
    cur = conn.execute("""
        INSERT INTO carts (guest_id, status, ttl_expires_at, created_at)
        VALUES (?, 'active', ?, datetime('now'))
    """, (guest_id, ttl_expires_at))
    return cur.lastrowid


def create_user_cart(conn, user_id: int):
    cur = conn.execute("""
        INSERT INTO carts (user_id, status, created_at)
        VALUES (?, 'active', datetime('now'))
    """, (user_id,))
    return cur.lastrowid


def update_cart_status(conn, cart_id: int, new_status: str):
    conn.execute(
        "UPDATE carts SET status = ?, updated_at = datetime('now') WHERE cart_id = ?",
        (new_status, cart_id),
    )


def mark_cart_converted(conn, cart_id: int):
    conn.execute("""
        UPDATE carts
        SET status = 'converted',
            converted_at = datetime('now'),
            updated_at = datetime('now')
        WHERE cart_id = ?
    """, (cart_id,))


def mark_cart_merged(conn, cart_id: int):
    conn.execute("""
        UPDATE carts
        SET status = 'merged',
            merged_at = datetime('now'),
            updated_at = datetime('now')
        WHERE cart_id = ?
    """, (cart_id,))


def mark_cart_expired(conn, cart_id: int):
    conn.execute("""
        UPDATE carts
        SET status = 'expired',
            updated_at = datetime('now')
        WHERE cart_id = ?
    """, (cart_id,))


# ----------------------------
# CART ITEMS
# ----------------------------
# def get_cart_items(conn, cart_id: int):
#     cur = conn.execute("""
#         SELECT ci.cart_item_id, ci.variant_id, ci.quantity, ci.price_cents,
#                ci.locked_price_until, ci.created_at, ci.updated_at,
#                pv.size, pv.color, pv.product_id, p.name AS product_name,
#                IFNULL(i.quantity, 0) AS stock
#         FROM cart_items ci
#         JOIN product_variants pv ON ci.variant_id = pv.variant_id
#         JOIN products p ON pv.product_id = p.product_id
#         LEFT JOIN inventory i ON i.variant_id = pv.variant_id
#         WHERE ci.cart_id = ?
#     """, (cart_id,))
#     return cur.fetchall()

def get_cart_items(conn, cart_id: int):
    """
    Returns all items in a cart with product, variant, stock, and image.
    Mirrors the wishlist image logic for consistency.
    """
    cur = conn.execute("""
        SELECT
            ci.cart_item_id,
            ci.variant_id,
            ci.quantity,
            ci.price_cents,
            ci.locked_price_until,
            ci.created_at,
            ci.updated_at,
            pv.size,
            pv.color,
            pv.product_id,
            p.name AS product_name,
            IFNULL(inv.quantity, 0) AS stock,
            COALESCE(img.image_url, 'Images/placeholder.png') AS image_url
        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN inventory inv ON inv.variant_id = pv.variant_id
        LEFT JOIN (
            SELECT product_id, image_url
            FROM product_images
            WHERE sort_order = (
                SELECT MIN(sort_order)
                FROM product_images pi
                WHERE pi.product_id = product_images.product_id
            )
            GROUP BY product_id
        ) AS img ON img.product_id = p.product_id
        WHERE ci.cart_id = ?
        ORDER BY ci.created_at DESC
    """, (cart_id,))
    return cur.fetchall()




def add_or_update_cart_item(conn, cart_id: int, variant_id: int, quantity: int, price_cents: int):
    """Insert new or update existing item. Returns True if new, False if updated."""
    cur = conn.execute(
        "SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?",
        (cart_id, variant_id),
    )
    row = cur.fetchone()
    lock_until = (datetime.utcnow() + timedelta(hours=24)).isoformat()

    if row:
        new_qty = quantity
        conn.execute("""
            UPDATE cart_items
            SET quantity = ?, price_cents = ?, locked_price_until = ?, updated_at = datetime('now')
            WHERE cart_id = ? AND variant_id = ?
        """, (new_qty, price_cents, lock_until, cart_id, variant_id))
        return False
    else:
        conn.execute("""
            INSERT INTO cart_items (cart_id, variant_id, quantity, price_cents, locked_price_until)
            VALUES (?, ?, ?, ?, ?)
        """, (cart_id, variant_id, quantity, price_cents, lock_until))
        return True


def update_cart_item_quantity(conn, cart_item_id: int, quantity: int):
    conn.execute("""
        UPDATE cart_items
        SET quantity = ?, updated_at = datetime('now')
        WHERE cart_item_id = ?
    """, (quantity, cart_item_id))


def remove_cart_item(conn, cart_item_id: int):
    conn.execute("DELETE FROM cart_items WHERE cart_item_id = ?", (cart_item_id,))


def clear_cart_items(conn, cart_id: int):
    conn.execute("DELETE FROM cart_items WHERE cart_id = ?", (cart_id,))


# ----------------------------
# PRODUCT LOOKUPS
# ----------------------------
def get_variant_with_price_and_stock(conn, variant_id: int):
    cur = conn.execute("""
        SELECT pv.variant_id, pv.product_id, pv.price_cents, pv.size, pv.color,
               p.name AS product_name, IFNULL(i.quantity, 0) AS stock
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN inventory i ON i.variant_id = pv.variant_id
        WHERE pv.variant_id = ?
    """, (variant_id,))
    return cur.fetchone()


# ----------------------------
# AUDIT LOGS
# ----------------------------
def insert_audit_event(conn, cart_id: int, user_id: Optional[int], guest_id: Optional[str],
                       event_type: str, message: str):
    conn.execute("""
        INSERT INTO cart_audit_log (cart_id, user_id, guest_id, event_type, message)
        VALUES (?, ?, ?, ?, ?)
    """, (cart_id, user_id, guest_id, event_type, message))


def get_recent_audit_events(conn, cart_id: int, limit: int = 20):
    cur = conn.execute("""
        SELECT audit_id, event_type, message, created_at
        FROM cart_audit_log
        WHERE cart_id = ?
        ORDER BY audit_id DESC
        LIMIT ?
    """, (cart_id, limit))
    return cur.fetchall()


# ----------------------------
# TTL / Expiry Enforcement
# ----------------------------
def check_cart_expired(cart_row: Dict[str, Any]) -> bool:
    """Return True if guest cart TTL expired."""
    if not cart_row:
        return True

    # Fix: sqlite3.Row doesn’t have .get()
    ttl = None
    if isinstance(cart_row, sqlite3.Row):
        ttl = cart_row["ttl_expires_at"] if "ttl_expires_at" in cart_row.keys() else None
    else:
        ttl = cart_row.get("ttl_expires_at")

    if not ttl:
        return False

    try:
        exp = datetime.fromisoformat(ttl)
        return datetime.utcnow() > exp
    except Exception:
        return False



# ----------------------------
# Totals
# ----------------------------
def compute_cart_totals(conn, cart_id: int):
    cur = conn.execute("""
        SELECT SUM(ci.price_cents * ci.quantity) AS subtotal_cents
        FROM cart_items ci
        WHERE ci.cart_id = ?
    """, (cart_id,))
    row = cur.fetchone()
    subtotal = row["subtotal_cents"] or 0
    return {
        "subtotal_cents": subtotal,
        "total_cents": subtotal,  # shipping/discount placeholder
    }
