# # domain/cart/repository.py — Unified Cart Repository (Revised Merge-Safe)
# import sqlite3
# from datetime import datetime, timedelta
# from typing import Optional, Dict, Any
# from db import query_one, execute

# # =============================================================
# # Core Cart Data Access Layer
# # =============================================================

# # ----------------------------
# # CARTS
# # ----------------------------
# def get_cart_by_guest_id(conn, guest_id: str):
#     cur = conn.execute(
#         "SELECT * FROM carts WHERE guest_id = ? AND status = 'active';",
#         (guest_id,),
#     )
#     return cur.fetchone()


# def get_cart_by_user_id(conn, user_id: int):
#     cur = conn.execute(
#         "SELECT * FROM carts WHERE user_id = ? AND status = 'active';",
#         (user_id,),
#     )
#     return cur.fetchone()


# def create_guest_cart(conn, guest_id: str, ttl_days: int = 7):
#     ttl_expires_at = (datetime.utcnow() + timedelta(days=ttl_days)).isoformat()
#     cur = conn.execute(
#         """
#         INSERT INTO carts (guest_id, status, ttl_expires_at, created_at, updated_at)
#         VALUES (?, 'active', ?, datetime('now'), datetime('now'));
#         """,
#         (guest_id, ttl_expires_at),
#     )
#     return cur.lastrowid


# def create_user_cart(conn, user_id: int):
#     cur = conn.execute(
#         """
#         INSERT INTO carts (user_id, status, created_at, updated_at)
#         VALUES (?, 'active', datetime('now'), datetime('now'));
#         """,
#         (user_id,),
#     )
#     return cur.lastrowid


# def mark_cart_merged(conn, cart_id):
#     conn.execute(
#         "INSERT INTO cart_events (cart_id, event_type, event_time) VALUES (?, 'merge', datetime('now'));"
#     )



# def mark_cart_converted(conn, cart_id: int):
#     conn.execute(
#         """
#         UPDATE carts
#         SET status = 'converted', converted_at = datetime('now'), updated_at = datetime('now')
#         WHERE cart_id = ?;
#         """,
#         (cart_id,),
#     )


# def mark_cart_expired(conn, cart_id: int):
#     conn.execute(
#         """
#         UPDATE carts
#         SET status = 'expired', updated_at = datetime('now')
#         WHERE cart_id = ?;
#         """,
#         (cart_id,),
#     )


# # ----------------------------
# # CART ITEMS
# # ----------------------------
# def get_cart_items(conn, cart_id: int):
#     cur = conn.execute(
#         """
#         SELECT
#             ci.cart_item_id,
#             ci.variant_id,
#             ci.quantity,
#             ci.price_cents,
#             ci.locked_price_until,
#             ci.created_at,
#             ci.updated_at,
#             pv.size,
#             pv.color,
#             pv.product_id,
#             p.name AS product_name,
#             IFNULL(inv.quantity, 0) AS stock,
#             COALESCE(img.image_url, 'Images/placeholder.png') AS image_url
#         FROM cart_items ci
#         JOIN product_variants pv ON ci.variant_id = pv.variant_id
#         JOIN products p ON pv.product_id = p.product_id
#         LEFT JOIN inventory inv ON inv.variant_id = pv.variant_id
#         LEFT JOIN (
#             SELECT product_id, image_url
#             FROM product_images
#             WHERE sort_order = (
#                 SELECT MIN(sort_order)
#                 FROM product_images pi
#                 WHERE pi.product_id = product_images.product_id
#             )
#             GROUP BY product_id
#         ) AS img ON img.product_id = p.product_id
#         WHERE ci.cart_id = ?
#         ORDER BY ci.created_at DESC;
#         """,
#         (cart_id,),
#     )
#     return cur.fetchall()


# def add_or_update_cart_item(conn, cart_id: int, variant_id: int, quantity: int, price_cents: int):
#     cur = conn.execute(
#         "SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?;",
#         (cart_id, variant_id),
#     )
#     existing = cur.fetchone()
#     lock_until = (datetime.utcnow() + timedelta(hours=24)).isoformat()

#     if existing:
#         conn.execute(
#             """
#             UPDATE cart_items
#             SET quantity = quantity + ?, price_cents = ?, locked_price_until = ?, updated_at = datetime('now')
#             WHERE cart_id = ? AND variant_id = ?;
#             """,
#             (quantity, price_cents, lock_until, cart_id, variant_id),
#         )
#         return False

#     conn.execute(
#         """
#         INSERT INTO cart_items (cart_id, variant_id, quantity, price_cents, locked_price_until)
#         VALUES (?, ?, ?, ?, ?);
#         """,
#         (cart_id, variant_id, quantity, price_cents, lock_until),
#     )
#     return True


# def update_cart_item_quantity(conn, cart_item_id: int, quantity: int):
#     conn.execute(
#         """
#         UPDATE cart_items
#         SET quantity = ?, updated_at = datetime('now')
#         WHERE cart_item_id = ?;
#         """,
#         (quantity, cart_item_id),
#     )


# def remove_cart_item(conn, cart_item_id: int):
#     conn.execute("DELETE FROM cart_items WHERE cart_item_id = ?;", (cart_item_id,))


# def clear_cart_items(conn, cart_id: int):
#     conn.execute("DELETE FROM cart_items WHERE cart_id = ?;", (cart_id,))


# # ----------------------------
# # PRODUCT LOOKUPS
# # ----------------------------
# def get_variant_with_price_and_stock(conn, variant_id: int):
#     cur = conn.execute(
#         """
#         SELECT pv.variant_id, pv.product_id, pv.price_cents, pv.size, pv.color,
#                p.name AS product_name, IFNULL(i.quantity, 0) AS stock
#         FROM product_variants pv
#         JOIN products p ON pv.product_id = p.product_id
#         LEFT JOIN inventory i ON i.variant_id = pv.variant_id
#         WHERE pv.variant_id = ?;
#         """,
#         (variant_id,),
#     )
#     return cur.fetchone()


# # =============================================================
# # MERGE OPERATIONS (REVISED)
# # =============================================================

# def get_cart_item_by_variant(conn, cart_id: int, variant_id: int):
#     cur = conn.execute(
#         "SELECT cart_item_id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?;",
#         (cart_id, variant_id),
#     )
#     return cur.fetchone()


# def merge_cart_items_atomic(conn, guest_cart_id: int, user_cart_id: int, user_id: int):
#     """
#     Merge guest cart items into user's cart atomically.
#     Combine duplicate variants and update quantities safely.
#     """
#     added = 0
#     updated = 0

#     cur = conn.execute(
#         "SELECT variant_id, quantity, price_cents FROM cart_items WHERE cart_id = ?;",
#         (guest_cart_id,),
#     )
#     guest_items = cur.fetchall()

#     for item in guest_items:
#         variant_id = item["variant_id"]
#         qty = item["quantity"]
#         price = item["price_cents"]

#         existing = get_cart_item_by_variant(conn, user_cart_id, variant_id)
#         if existing:
#             conn.execute(
#                 """
#                 UPDATE cart_items
#                 SET quantity = quantity + ?, updated_at = datetime('now')
#                 WHERE cart_id = ? AND variant_id = ?;
#                 """,
#                 (qty, user_cart_id, variant_id),
#             )
#             updated += 1
#         else:
#             # Simply reassign the item to the new cart; no user_id column exists
#             conn.execute(
#                 """
#                 UPDATE cart_items
#                 SET cart_id = ?, updated_at = datetime('now')
#                 WHERE cart_id = ? AND variant_id = ?;
#                 """,
#                 (user_cart_id, guest_cart_id, variant_id),
#             )
#             added += 1

#     conn.execute("DELETE FROM cart_items WHERE cart_id = ?;", (guest_cart_id,))
#     return {"added": added, "updated": updated}



# def insert_cart_merge_audit(conn, user_cart_id: int, guest_cart_id: int,
#                             user_id: int, guest_id: str, added: int, updated: int):
#     message = f"Merged guest {guest_id} into user {user_id}: added={added}, updated={updated}"
#     conn.execute(
#         """
#         INSERT INTO cart_audit_log (cart_id, user_id, guest_id, event_type, message)
#         VALUES (?, ?, ?, 'merge', ?);
#         """,
#         (user_cart_id, user_id, guest_id, message),
#     )


# # ----------------------------
# # AUDIT LOG
# # ----------------------------
# def insert_audit_event(conn, cart_id: int, user_id: Optional[int], guest_id: Optional[str],
#                        event_type: str, message: str):
#     conn.execute(
#         """
#         INSERT INTO cart_audit_log (cart_id, user_id, guest_id, event_type, message)
#         VALUES (?, ?, ?, ?, ?);
#         """,
#         (cart_id, user_id, guest_id, event_type, message),
#     )


# def get_recent_audit_events(conn, cart_id: int, limit: int = 20):
#     cur = conn.execute(
#         """
#         SELECT audit_id, event_type, message, created_at
#         FROM cart_audit_log
#         WHERE cart_id = ?
#         ORDER BY audit_id DESC
#         LIMIT ?;
#         """,
#         (cart_id, limit),
#     )
#     return cur.fetchall()


# # ----------------------------
# # TTL / EXPIRY
# # ----------------------------
# def check_cart_expired(cart_row: Dict[str, Any]) -> bool:
#     if not cart_row:
#         return True
#     ttl = None
#     if isinstance(cart_row, sqlite3.Row):
#         ttl = cart_row["ttl_expires_at"] if "ttl_expires_at" in cart_row.keys() else None
#     else:
#         ttl = cart_row.get("ttl_expires_at")
#     if not ttl:
#         return False
#     try:
#         exp = datetime.fromisoformat(ttl)
#         return datetime.utcnow() > exp
#     except Exception:
#         return False


# # ----------------------------
# # TOTALS
# # ----------------------------
# def compute_cart_totals(conn, cart_id: int):
#     cur = conn.execute(
#         """
#         SELECT SUM(ci.price_cents * ci.quantity) AS subtotal_cents
#         FROM cart_items ci
#         WHERE ci.cart_id = ?;
#         """,
#         (cart_id,),
#     )
#     row = cur.fetchone()
#     subtotal = row["subtotal_cents"] or 0
#     return {"subtotal_cents": subtotal, "total_cents": subtotal}
# def is_cart_already_merged(cart_id: int) -> bool:
#     """
#     Return True if the cart has been marked as merged.
#     Must not close the shared Flask connection during a transaction.
#     """
#     # Use local cursor from current transaction-safe connection.
#     from flask import g
#     con = g.get("db")
#     if con is None:
#         # Fallback for non-Flask test contexts
#         from db import get_db_connection
#         con = get_db_connection()

#     cur = con.execute("SELECT merged_at FROM carts WHERE cart_id = ?;", (cart_id,))
#     row = cur.fetchone()

#     # Access using key, not .get()
#     merged = bool(row and row["merged_at"])
#     return merged

# ------------ pgsql -------------------------

from datetime import datetime, timedelta
from db import query_one, query_all, execute


# ------------------------------------------------------------
# Cart lookup helpers
# ------------------------------------------------------------

def get_cart_by_guest_id(guest_id):
    return query_one(
        """
        SELECT *
        FROM carts
        WHERE guest_id = %s
          AND status = 'active'
        LIMIT 1
        """,
        (guest_id,)
    )


def get_cart_by_user_id(user_id):
    return query_one(
        """
        SELECT *
        FROM carts
        WHERE user_id = %s
          AND status = 'active'
        LIMIT 1
        """,
        (user_id,)
    )


# ------------------------------------------------------------
# Cart creation
# ------------------------------------------------------------

def create_guest_cart(guest_id, ttl_days=7):
    row = query_one(
        """
        INSERT INTO carts (guest_id, status, ttl_expires_at, created_at, updated_at)
        VALUES (%s, 'active', NOW() + INTERVAL '%s days', NOW(), NOW())
        RETURNING cart_id
        """,
        (guest_id, ttl_days)
    )
    return row["cart_id"]


def create_user_cart(user_id):
    row = query_one(
        """
        INSERT INTO carts (user_id, status, created_at, updated_at)
        VALUES (%s, 'active', NOW(), NOW())
        RETURNING cart_id
        """,
        (user_id,)
    )
    return row["cart_id"]


# ------------------------------------------------------------
# Status updates
# ------------------------------------------------------------

def mark_cart_converted(cart_id):
    execute(
        """
        UPDATE carts
        SET status = 'converted',
            converted_at = NOW(),
            updated_at = NOW()
        WHERE cart_id = %s
        """,
        (cart_id,)
    )


def mark_cart_expired(cart_id):
    execute(
        """
        UPDATE carts
        SET status = 'expired',
            updated_at = NOW()
        WHERE cart_id = %s
        """,
        (cart_id,)
    )


# ------------------------------------------------------------
# Cart items
# ------------------------------------------------------------

def get_cart_items(cart_id):
    return query_all(
        """
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

            COALESCE(inv.quantity, 0) AS stock,


            COALESCE(CONCAT('Images/', img.image_url), 'Images/placeholder.png') AS image_url


        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN inventory inv ON inv.variant_id = pv.variant_id

        LEFT JOIN (
            SELECT pi.product_id, pi.image_url
            FROM product_images pi
            JOIN (
                SELECT product_id, MIN(sort_order) AS min_sort
                FROM product_images
                GROUP BY product_id
            ) x ON x.product_id = pi.product_id AND x.min_sort = pi.sort_order
        ) img ON img.product_id = p.product_id

        WHERE ci.cart_id = %s
        ORDER BY ci.created_at DESC
        """,
        (cart_id,)
    )


def add_or_update_cart_item(cart_id, variant_id, quantity, price_cents):
    existing = query_one(
        """
        SELECT quantity
        FROM cart_items
        WHERE cart_id = %s AND variant_id = %s
        """,
        (cart_id, variant_id)
    )

    lock_until = (datetime.utcnow() + timedelta(hours=24)).isoformat()

    if existing:
        execute(
            """
            UPDATE cart_items
            SET quantity = quantity + %s,
                price_cents = %s,
                locked_price_until = %s,
                updated_at = NOW()
            WHERE cart_id = %s AND variant_id = %s
            """,
            (quantity, price_cents, lock_until, cart_id, variant_id)
        )
        return False

    execute(
        """
        INSERT INTO cart_items (cart_id, variant_id, quantity, price_cents, locked_price_until)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (cart_id, variant_id, quantity, price_cents, lock_until)
    )
    return True


def update_cart_item_quantity(cart_item_id, quantity):
    execute(
        """
        UPDATE cart_items
        SET quantity = %s,
            updated_at = NOW()
        WHERE cart_item_id = %s
        """,
        (quantity, cart_item_id)
    )


def remove_cart_item(cart_item_id):
    execute(
        """
        DELETE FROM cart_items
        WHERE cart_item_id = %s
        """,
        (cart_item_id,)
    )


def clear_cart_items(cart_id):
    execute(
        """
        DELETE FROM cart_items
        WHERE cart_id = %s
        """,
        (cart_id,)
    )


# ------------------------------------------------------------
# Variant lookup
# ------------------------------------------------------------

def get_variant_with_price_and_stock(variant_id):
    return query_one(
        """
        SELECT
            pv.variant_id,
            pv.product_id,
            pv.price_cents,
            pv.size,
            pv.color,
            p.name AS product_name,
            COALESCE(i.quantity, 0) AS stock
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.product_id
        LEFT JOIN inventory i ON i.variant_id = pv.variant_id
        WHERE pv.variant_id = %s
        """,
        (variant_id,)
    )


def get_cart_item_by_variant(cart_id, variant_id):
    return query_one(
        """
        SELECT cart_item_id, quantity
        FROM cart_items
        WHERE cart_id = %s AND variant_id = %s
        """,
        (cart_id, variant_id)
    )


# ------------------------------------------------------------
# MERGE LOGIC
# ------------------------------------------------------------

def merge_cart_items_atomic(guest_cart_id, user_cart_id):
    guest_items = query_all(
        """
        SELECT variant_id, quantity, price_cents
        FROM cart_items
        WHERE cart_id = %s
        """,
        (guest_cart_id,)
    )

    added = 0
    updated = 0

    for item in guest_items:
        variant_id = item["variant_id"]
        qty = item["quantity"]

        existing = query_one(
            """
            SELECT cart_item_id, quantity
            FROM cart_items
            WHERE cart_id = %s AND variant_id = %s
            """,
            (user_cart_id, variant_id)
        )

        if existing:
            execute(
                """
                UPDATE cart_items
                SET quantity = quantity + %s,
                    updated_at = NOW()
                WHERE cart_id = %s AND variant_id = %s
                """,
                (qty, user_cart_id, variant_id)
            )
            updated += 1
        else:
            execute(
                """
                UPDATE cart_items
                SET cart_id = %s,
                    updated_at = NOW()
                WHERE cart_id = %s AND variant_id = %s
                """,
                (user_cart_id, guest_cart_id, variant_id)
            )
            added += 1

    execute(
        """
        DELETE FROM cart_items WHERE cart_id = %s
        """,
        (guest_cart_id,)
    )

    return {"added": added, "updated": updated}


# ------------------------------------------------------------
# Expiration + totals
# ------------------------------------------------------------

def check_cart_expired(cart_row):
    ttl = cart_row.get("ttl_expires_at")
    if not ttl:
        return False
    try:
        exp = datetime.fromisoformat(str(ttl))
        return datetime.utcnow() > exp
    except Exception:
        return False


def compute_cart_totals(cart_id):
    row = query_one(
        """
        SELECT SUM(price_cents * quantity) AS subtotal_cents
        FROM cart_items
        WHERE cart_id = %s
        """,
        (cart_id,)
    )
    subtotal = row["subtotal_cents"] or 0
    return {
        "subtotal_cents": subtotal,
        "total_cents": subtotal
    }
