# domain/cart/service.py — final production-safe version
import sqlite3
import logging
from uuid import uuid4
from datetime import datetime
from db import get_db_connection

# =============================================================
# Exception Classes
# =============================================================
class GuestCartNotFoundError(Exception):
    pass

class MergeConflictError(Exception):
    pass

class InvalidVariantError(Exception):
    pass

class InsufficientStockError(Exception):
    pass

class InvalidQuantityError(Exception):
    pass

class DBError(Exception):
    pass


# =============================================================
# Helpers
# =============================================================
def _get_variant_data(conn, variant_id: int):
    """Fetch product variant with stock and price."""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pv.variant_id,
               pv.product_id,
               pv.size,
               pv.color,
               pv.price_cents,
               p.name AS product_name,
               IFNULL(i.quantity, 0) AS stock
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN inventory i ON i.variant_id = pv.variant_id
        WHERE pv.variant_id = ?
    """, (variant_id,))
    row = cursor.fetchone()

    if not row:
        raise InvalidVariantError("Variant not found")

    return {
        "variant_id": row[0],
        "product_id": row[1],
        "size": row[2],
        "color": row[3],
        "price_cents": int(row[4]),
        "price": float(row[4]) / 100.0,
        "product_name": row[5],
        "stock": int(row[6]),
        "is_active": True,
    }


# =============================================================
# Core Cart Operations
# =============================================================
def get_or_create_guest_cart(guest_id: str):
    """Return or create a guest cart."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if not guest_id:
            guest_id = str(uuid4())

        cursor.execute("SELECT cart_id, status FROM carts WHERE guest_id = ?", (guest_id,))
        row = cursor.fetchone()

        if row:
            if row["status"] == "converted":
                raise GuestCartNotFoundError("Guest cart already merged")
            return {"cart_id": row["cart_id"], "guest_id": guest_id}

        conn.execute("BEGIN IMMEDIATE")
        cursor.execute("""
            INSERT INTO carts (guest_id, status, created_at)
            VALUES (?, 'active', datetime('now'))
        """, (guest_id,))
        cart_id = cursor.lastrowid
        conn.commit()

        logging.info({
            "event": "cart_create",
            "guest_id": guest_id,
            "cart_id": cart_id
        })
        return {"cart_id": cart_id, "guest_id": guest_id}
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))


def get_cart(cart_id: int):
    """Return the full contents of a cart."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ci.variant_id,
                   pv.product_id,
                   p.name AS product_name,
                   pv.size,
                   pv.color,
                   ci.quantity,
                   ci.price_cents,
                   IFNULL(i.quantity, 0) AS stock
            FROM cart_items ci
            JOIN product_variants pv ON ci.variant_id = pv.variant_id
            JOIN products p ON pv.product_id = p.product_id
            LEFT JOIN inventory i ON i.variant_id = pv.variant_id
            WHERE ci.cart_id = ?
        """, (cart_id,))
        items = [{
            "variant_id": r["variant_id"],
            "product_id": r["product_id"],
            "product_name": r["product_name"],
            "size": r["size"],
            "color": r["color"],
            "quantity": r["quantity"],
            "price": float(r["price_cents"]) / 100.0,
            "stock": r["stock"],
        } for r in cursor.fetchall()]
        return {"cart_id": cart_id, "items": items}
    except Exception as e:
        raise DBError(str(e))


def add_to_cart(cart_id: int, variant_id: int, quantity: int):
    """Add or increment an item in the cart."""
    if quantity <= 0:
        raise InvalidQuantityError("Quantity must be positive")

    conn = get_db_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()

        variant = _get_variant_data(conn, variant_id)
        if variant["stock"] <= 0:
            raise InsufficientStockError("Out of stock")

        price_cents = variant["price_cents"]

        cursor.execute("SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?", (cart_id, variant_id))
        existing = cursor.fetchone()

        if existing:
            new_qty = min(existing["quantity"] + quantity, variant["stock"])
            cursor.execute("""
                UPDATE cart_items
                SET quantity = ?, price_cents = ?, updated_at = datetime('now')
                WHERE cart_id = ? AND variant_id = ?
            """, (new_qty, price_cents, cart_id, variant_id))
            action = "update"
        else:
            new_qty = min(quantity, variant["stock"])
            cursor.execute("""
                INSERT INTO cart_items (cart_id, variant_id, quantity, price_cents)
                VALUES (?, ?, ?, ?)
            """, (cart_id, variant_id, new_qty, price_cents))
            action = "add"

        conn.commit()

        logging.info({
            "event": "cart_update",
            "action": action,
            "cart_id": cart_id,
            "variant_id": variant_id,
            "quantity": new_qty,
            "price_cents": price_cents,
            "timestamp": datetime.utcnow().isoformat(),
        })
        return get_cart(cart_id)
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))


def update_cart_item(cart_id: int, variant_id: int, quantity: int):
    """Change quantity for an existing item."""
    conn = get_db_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()

        if quantity <= 0:
            cursor.execute("DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ?", (cart_id, variant_id))
            conn.commit()
            return get_cart(cart_id)

        variant = _get_variant_data(conn, variant_id)
        if variant["stock"] <= 0:
            raise InsufficientStockError("Out of stock")

        new_qty = min(quantity, variant["stock"])
        cursor.execute("""
            UPDATE cart_items
            SET quantity = ?, price_cents = ?, updated_at = datetime('now')
            WHERE cart_id = ? AND variant_id = ?
        """, (new_qty, variant["price_cents"], cart_id, variant_id))

        conn.commit()
        logging.info({
            "event": "cart_update",
            "action": "modify",
            "cart_id": cart_id,
            "variant_id": variant_id,
            "quantity": new_qty,
            "timestamp": datetime.utcnow().isoformat(),
        })
        return get_cart(cart_id)
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))


def remove_cart_item(cart_id: int, variant_id: int):
    """Delete a variant from the cart."""
    conn = get_db_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ?", (cart_id, variant_id))
        conn.commit()
        logging.info({"event": "cart_remove", "cart_id": cart_id, "variant_id": variant_id})
        return get_cart(cart_id)
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))


def clear_cart(cart_id: int):
    """Empty the entire cart."""
    conn = get_db_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("DELETE FROM cart_items WHERE cart_id = ?", (cart_id,))
        conn.commit()
        logging.info({"event": "cart_clear", "cart_id": cart_id})
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))


# =============================================================
# Merge Logic
# =============================================================
def merge_guest_cart(user_id: int, guest_id: str):
    """Merge a guest cart into a user cart."""
    conn = get_db_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()

        cursor.execute("SELECT cart_id, status FROM carts WHERE guest_id = ?", (guest_id,))
        guest_cart = cursor.fetchone()
        if not guest_cart:
            raise GuestCartNotFoundError("Guest cart not found")
        if guest_cart["status"] == "converted":
            raise GuestCartNotFoundError("Guest cart already merged")

        cursor.execute("SELECT cart_id FROM carts WHERE user_id = ?", (user_id,))
        user_cart = cursor.fetchone()
        if not user_cart:
            cursor.execute("""
                INSERT INTO carts (user_id, status, created_at)
                VALUES (?, 'active', datetime('now'))
            """, (user_id,))
            user_cart_id = cursor.lastrowid
        else:
            user_cart_id = user_cart["cart_id"]

        cursor.execute("SELECT variant_id, quantity FROM cart_items WHERE cart_id = ?", (guest_cart["cart_id"],))
        guest_items = cursor.fetchall()

        added, updated, clamped, skipped = 0, 0, 0, 0
        for item in guest_items:
            variant_id, qty = item["variant_id"], item["quantity"]
            try:
                variant = _get_variant_data(conn, variant_id)
            except InvalidVariantError:
                skipped += 1
                continue

            if variant["stock"] <= 0:
                skipped += 1
                continue

            cursor.execute("SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?", (user_cart_id, variant_id))
            existing = cursor.fetchone()

            if existing:
                new_qty = min(existing["quantity"] + qty, variant["stock"])
                cursor.execute("""
                    UPDATE cart_items
                    SET quantity = ?, price_cents = ?
                    WHERE cart_id = ? AND variant_id = ?
                """, (new_qty, variant["price_cents"], user_cart_id, variant_id))
                updated += 1
            else:
                final_qty = min(qty, variant["stock"])
                cursor.execute("""
                    INSERT INTO cart_items (cart_id, variant_id, quantity, price_cents)
                    VALUES (?, ?, ?, ?)
                """, (user_cart_id, variant_id, final_qty, variant["price_cents"]))
                added += 1

        cursor.execute("UPDATE carts SET status = 'converted' WHERE guest_id = ?", (guest_id,))
        conn.commit()

        result = {
            "status": "success",
            "items_added": added,
            "items_updated": updated,
            "items_clamped": clamped,
            "items_skipped": skipped,
        }

        logging.info({
            "event": "merge_guest_cart",
            "user_id": user_id,
            "guest_id": guest_id,
            "result": result,
            "timestamp": datetime.utcnow().isoformat(),
        })
        return result
    except GuestCartNotFoundError:
        raise
    except Exception as e:
        conn.rollback()
        raise MergeConflictError(str(e))
