# domain/cart/service.py

import sqlite3
import logging
from uuid import uuid4
from datetime import datetime
from ...db import get_db_connection  # corrected import path

# -------------------------------------------------------------
# Exception Classes
# -------------------------------------------------------------
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


# -------------------------------------------------------------
# Helper: Stock and Variant Validation
# -------------------------------------------------------------
def _get_variant_data(conn, variant_id):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pv.variant_id, pv.product_id, pv.name, pv.price, pv.stock, pv.is_active, p.name
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.product_id
        WHERE pv.variant_id = ?
    """, (variant_id,))
    row = cursor.fetchone()
    if not row:
        raise InvalidVariantError("Variant not found")
    variant = {
        "variant_id": row[0],
        "product_id": row[1],
        "variant_name": row[2],
        "price": float(row[3]),
        "stock": int(row[4]),
        "is_active": bool(row[5]),
        "product_name": row[6]
    }
    return variant


# -------------------------------------------------------------
# Core Cart Functions
# -------------------------------------------------------------
def get_or_create_guest_cart(guest_id):
    conn = get_db_connection()
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        cursor = conn.cursor()
        if not guest_id:
            guest_id = str(uuid4())

        cursor.execute("SELECT cart_id, converted FROM carts WHERE guest_id = ?", (guest_id,))
        row = cursor.fetchone()

        if row:
            if row[1] == 1:
                raise GuestCartNotFoundError("Guest cart already merged")
            return {"cart_id": row[0], "guest_id": guest_id}

        conn.execute("BEGIN IMMEDIATE")
        cursor.execute(
            "INSERT INTO carts (guest_id, created_at, converted) VALUES (?, ?, ?)",
            (guest_id, datetime.utcnow().isoformat(), 0)
        )
        cart_id = cursor.lastrowid
        conn.commit()
        logging.info({"event": "cart_create", "guest_id": guest_id, "cart_id": cart_id})
        return {"cart_id": cart_id, "guest_id": guest_id}
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))
    finally:
        conn.close()


def get_cart(cart_id):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ci.variant_id, pv.product_id, p.name, pv.name, ci.quantity, ci.price, pv.stock
            FROM cart_items ci
            JOIN product_variants pv ON ci.variant_id = pv.variant_id
            JOIN products p ON pv.product_id = p.product_id
            WHERE ci.cart_id = ?
        """, (cart_id,))
        items = [{
            "variant_id": row[0],
            "product_id": row[1],
            "product_name": row[2],
            "variant_name": row[3],
            "quantity": row[4],
            "price": float(row[5]),
            "stock": row[6]
        } for row in cursor.fetchall()]
        return {"cart_id": cart_id, "items": items}
    except Exception as e:
        raise DBError(str(e))
    finally:
        conn.close()


def add_to_cart(cart_id, variant_id, quantity):
    if quantity <= 0:
        raise InvalidQuantityError("Quantity must be positive")
    conn = get_db_connection()
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()

        variant = _get_variant_data(conn, variant_id)
        if not variant["is_active"]:
            raise InvalidVariantError("Variant is inactive")
        if variant["stock"] <= 0:
            raise InsufficientStockError("Out of stock")

        cursor.execute("SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?", (cart_id, variant_id))
        existing = cursor.fetchone()
        if existing:
            new_qty = min(existing[0] + quantity, variant["stock"])
            cursor.execute("UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND variant_id = ?",
                           (new_qty, cart_id, variant_id))
            action = "update"
        else:
            new_qty = min(quantity, variant["stock"])
            cursor.execute(
                "INSERT INTO cart_items (cart_id, variant_id, quantity, price) VALUES (?, ?, ?, ?)",
                (cart_id, variant_id, new_qty, variant["price"])
            )
            action = "add"

        conn.commit()
        logging.info({
            "event": "cart_update",
            "action": action,
            "cart_id": cart_id,
            "variant_id": variant_id,
            "quantity": new_qty,
            "price": variant["price"],
            "timestamp": datetime.utcnow().isoformat()
        })
        return get_cart(cart_id)
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))
    finally:
        conn.close()


def update_cart_item(cart_id, variant_id, quantity):
    conn = get_db_connection()
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()

        if quantity <= 0:
            cursor.execute("DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ?", (cart_id, variant_id))
            conn.commit()
            return get_cart(cart_id)

        variant = _get_variant_data(conn, variant_id)
        if not variant["is_active"]:
            raise InvalidVariantError("Variant is inactive")

        if variant["stock"] <= 0:
            raise InsufficientStockError("Out of stock")

        new_qty = min(quantity, variant["stock"])
        cursor.execute("""
            UPDATE cart_items
            SET quantity = ?, price = ?
            WHERE cart_id = ? AND variant_id = ?
        """, (new_qty, variant["price"], cart_id, variant_id))
        conn.commit()
        logging.info({
            "event": "cart_update",
            "action": "modify",
            "cart_id": cart_id,
            "variant_id": variant_id,
            "quantity": new_qty,
            "timestamp": datetime.utcnow().isoformat()
        })
        return get_cart(cart_id)
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))
    finally:
        conn.close()


def remove_cart_item(cart_id, variant_id):
    conn = get_db_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ?", (cart_id, variant_id))
        conn.commit()
        logging.info({"event": "cart_remove", "cart_id": cart_id, "variant_id": variant_id})
        return get_cart(cart_id)
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))
    finally:
        conn.close()


def clear_cart(cart_id):
    conn = get_db_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cart_items WHERE cart_id = ?", (cart_id,))
        conn.commit()
        logging.info({"event": "cart_clear", "cart_id": cart_id})
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))
    finally:
        conn.close()


# -------------------------------------------------------------
# Merge Logic
# -------------------------------------------------------------
def merge_guest_cart(user_id, guest_id):
    conn = get_db_connection()
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()

        cursor.execute("SELECT cart_id, converted FROM carts WHERE guest_id = ?", (guest_id,))
        guest_cart = cursor.fetchone()
        if not guest_cart:
            raise GuestCartNotFoundError("Guest cart not found")
        if guest_cart[1] == 1:
            raise GuestCartNotFoundError("Guest cart already merged")

        cursor.execute("SELECT cart_id FROM carts WHERE user_id = ?", (user_id,))
        user_cart = cursor.fetchone()
        if not user_cart:
            cursor.execute("INSERT INTO carts (user_id, created_at) VALUES (?, ?)", (user_id, datetime.utcnow().isoformat()))
            user_cart_id = cursor.lastrowid
        else:
            user_cart_id = user_cart[0]

        cursor.execute("SELECT variant_id, quantity FROM cart_items WHERE cart_id = ?", (guest_cart[0],))
        guest_items = cursor.fetchall()

        added, updated, clamped, skipped = 0, 0, 0, 0

        for variant_id, qty in guest_items:
            try:
                variant = _get_variant_data(conn, variant_id)
            except InvalidVariantError:
                skipped += 1
                continue
            if not variant["is_active"]:
                skipped += 1
                continue

            cursor.execute("SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?", (user_cart_id, variant_id))
            existing = cursor.fetchone()
            if existing:
                new_qty = existing[0] + qty
                if new_qty > variant["stock"]:
                    new_qty = variant["stock"]
                    clamped += 1
                cursor.execute("UPDATE cart_items SET quantity = ?, price = ? WHERE cart_id = ? AND variant_id = ?",
                               (new_qty, variant["price"], user_cart_id, variant_id))
                updated += 1
            else:
                final_qty = min(qty, variant["stock"])
                cursor.execute("INSERT INTO cart_items (cart_id, variant_id, quantity, price) VALUES (?, ?, ?, ?)",
                               (user_cart_id, variant_id, final_qty, variant["price"]))
                added += 1

        cursor.execute("UPDATE carts SET converted = 1 WHERE guest_id = ?", (guest_id,))
        conn.commit()

        merge_result = {
            "status": "success",
            "items_added": added,
            "items_updated": updated,
            "items_clamped": clamped,
            "items_skipped": skipped
        }

        logging.info({
            "event": "merge_guest_cart",
            "user_id": user_id,
            "guest_id": guest_id,
            "merge_result": merge_result,
            "timestamp": datetime.utcnow().isoformat()
        })

        return merge_result
    except GuestCartNotFoundError:
        raise
    except Exception as e:
        conn.rollback()
        raise MergeConflictError(str(e))
    finally:
        conn.close()
