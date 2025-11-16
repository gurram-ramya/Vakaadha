# # domain/wishlist/repository.py — Unified Wishlist Repository (Revised Merge-Consistent)
# import sqlite3
# from datetime import datetime
# from db import get_db_connection

# # ============================================================
# # CREATE OR FETCH WISHLIST
# # ============================================================
# def get_or_create_wishlist(user_id=None, guest_id=None):
#     """
#     Returns an active wishlist_id for the given user or guest.
#     Creates one if none exists.
#     """
#     con = get_db_connection()
#     con.row_factory = sqlite3.Row
#     cur = con.cursor()

#     if not user_id and not guest_id:
#         raise ValueError("Either user_id or guest_id must be provided")

#     # Find active wishlist
#     if user_id:
#         row = cur.execute("""
#             SELECT wishlist_id
#             FROM wishlists
#             WHERE user_id = ? AND status = 'active'
#         """, (user_id,)).fetchone()
#     else:
#         row = cur.execute("""
#             SELECT wishlist_id
#             FROM wishlists
#             WHERE guest_id = ? AND status = 'active'
#         """, (guest_id,)).fetchone()

#     if row:
#         con.close()
#         return row["wishlist_id"]

#     # Create new wishlist
#     cur.execute("""
#         INSERT INTO wishlists (user_id, guest_id, status, created_at, updated_at)
#         VALUES (?, ?, 'active', datetime('now'), datetime('now'))
#     """, (user_id, guest_id))
#     wishlist_id = cur.lastrowid
#     con.commit()
#     con.close()
#     return wishlist_id


# # ============================================================
# # PRODUCT VALIDATION
# # ============================================================
# def product_exists(product_id):
#     """Check whether a product exists in the catalog."""
#     con = get_db_connection()
#     con.row_factory = sqlite3.Row
#     cur = con.cursor()
#     row = cur.execute("""
#         SELECT product_id FROM products WHERE product_id = ? LIMIT 1;
#     """, (product_id,)).fetchone()
#     con.close()
#     return bool(row)


# # ============================================================
# # ADD ITEM
# # ============================================================
# def add_item(wishlist_id, product_id, user_id=None, guest_id=None):
#     """Insert or update a product in the wishlist."""
#     with get_db_connection() as con:
#         con.execute("""
#             INSERT INTO wishlist_items (wishlist_id, product_id, created_at, updated_at)
#             VALUES (?, ?, datetime('now'), datetime('now'))
#             ON CONFLICT(wishlist_id, product_id)
#             DO UPDATE SET updated_at = datetime('now');
#         """, (wishlist_id, product_id))
#         log_audit("add", wishlist_id, user_id, guest_id, product_id, con=con)


# # ============================================================
# # REMOVE ITEM
# # ============================================================
# def remove_item(wishlist_id, product_id, user_id=None, guest_id=None):
#     """Delete a product from a wishlist."""
#     with get_db_connection() as con:
#         con.execute("""
#             DELETE FROM wishlist_items
#             WHERE wishlist_id = ? AND product_id = ?;
#         """, (wishlist_id, product_id))
#         log_audit("remove", wishlist_id, user_id, guest_id, product_id, con=con)


# # ============================================================
# # CLEAR WISHLIST
# # ============================================================
# def clear_items(wishlist_id, user_id=None, guest_id=None):
#     """Remove all products from a wishlist."""
#     with get_db_connection() as con:
#         con.execute("DELETE FROM wishlist_items WHERE wishlist_id = ?;", (wishlist_id,))
#         log_audit("clear", wishlist_id, user_id, guest_id, con=con)


# # ============================================================
# # FETCH WISHLIST ITEMS — ENRICHED PRODUCT DATA
# # ============================================================
# def get_items(wishlist_id):
#     """
#     Returns all wishlist products with full details:
#     - product_id, name, image, lowest price_cents, availability
#     """
#     con = get_db_connection()
#     con.row_factory = sqlite3.Row
#     cur = con.cursor()

#     query = """
#         SELECT
#             p.product_id,
#             p.name AS name,
#             COALESCE(MIN(v.price_cents), 0) AS price_cents,
#             (
#                 SELECT image_url
#                 FROM product_images i
#                 WHERE i.product_id = p.product_id
#                 ORDER BY sort_order ASC
#                 LIMIT 1
#             ) AS image_url,
#             CASE
#                 WHEN EXISTS (
#                     SELECT 1
#                     FROM product_variants pv
#                     JOIN inventory inv ON pv.variant_id = inv.variant_id
#                     WHERE pv.product_id = p.product_id
#                       AND inv.quantity > 0
#                 )
#                 THEN 1 ELSE 0
#             END AS available,
#             wi.created_at,
#             wi.updated_at
#         FROM wishlist_items wi
#         JOIN products p ON wi.product_id = p.product_id
#         LEFT JOIN product_variants v ON v.product_id = p.product_id
#         WHERE wi.wishlist_id = ?
#         GROUP BY p.product_id, p.name
#         ORDER BY wi.created_at DESC;
#     """

#     rows = cur.execute(query, (wishlist_id,)).fetchall()
#     con.close()
#     return [dict(row) for row in rows]


# # ============================================================
# # COUNT ITEMS
# # ============================================================
# def get_count(wishlist_id):
#     """Return the number of items in a wishlist."""
#     con = get_db_connection()
#     con.row_factory = sqlite3.Row
#     cur = con.cursor()
#     row = cur.execute(
#         "SELECT COUNT(*) AS count FROM wishlist_items WHERE wishlist_id = ?;",
#         (wishlist_id,),
#     ).fetchone()
#     con.close()
#     return row["count"] if row else 0


# # ============================================================
# # AUDIT LOG
# # ============================================================

# # def log_audit(action, wishlist_id, user_id=None, guest_id=None,
# #               product_id=None, variant_id=None, con=None, message=None):
# #     event_type = action if action in ('merge','convert','expire','archive','delete','update') else 'update'
# #     connection = con or get_db_connection()
# #     connection.execute("""
# #         INSERT INTO wishlist_audit (wishlist_id, user_id, guest_id, product_id, event_type, message, created_at)
# #         VALUES (?, ?, ?, ?, ?, ?, datetime('now'));
# #     """, (wishlist_id, user_id, guest_id, product_id, event_type, message))
# #     if con is None:
# #         connection.commit()
# #         connection.close()
# def log_audit(*args, **kwargs):
#     return  # audit disabled




# # ============================================================
# # WISHLIST MERGE OPERATIONS (REVISED)
# # ============================================================
# def get_wishlist_by_guest_id(conn, guest_id):
#     cur = conn.execute(
#         "SELECT * FROM wishlists WHERE guest_id = ? AND status = 'active';",
#         (guest_id,),
#     )
#     return cur.fetchone()


# def get_wishlist_by_user_id(conn, user_id):
#     cur = conn.execute(
#         "SELECT * FROM wishlists WHERE user_id = ? AND status = 'active';",
#         (user_id,),
#     )
#     return cur.fetchone()


# def create_user_wishlist(conn, user_id):
#     cur = conn.execute(
#         "INSERT INTO wishlists (user_id, status, created_at, updated_at) VALUES (?, 'active', datetime('now'), datetime('now'));",
#         (user_id,),
#     )
#     return cur.lastrowid


# def merge_wishlist_items_atomic(conn, guest_wishlist_id, user_wishlist_id, user_id):
#     """
#     Merge guest wishlist items into user's wishlist atomically.
#     Skip duplicate product_ids, update timestamps, and remove guest items.
#     """
#     added = 0
#     skipped = 0

#     cur = conn.execute(
#         "SELECT product_id FROM wishlist_items WHERE wishlist_id = ?;",
#         (guest_wishlist_id,),
#     )
#     guest_items = cur.fetchall()

#     for row in guest_items:
#         product_id = row["product_id"]
#         existing = conn.execute(
#             "SELECT 1 FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?;",
#             (user_wishlist_id, product_id),
#         ).fetchone()

#         if existing:
#             skipped += 1
#         else:
#             conn.execute(
#                 """
#                 UPDATE wishlist_items
#                 SET wishlist_id = ?, updated_at = datetime('now')
#                 WHERE wishlist_id = ? AND product_id = ?;
#                 """,
#                 (user_wishlist_id, guest_wishlist_id, product_id),
#             )
#             added += 1

#     conn.execute("DELETE FROM wishlist_items WHERE wishlist_id = ?;", (guest_wishlist_id,))
#     return {"added": added, "skipped": skipped}


# def mark_wishlist_merged(conn, guest_id):
#     conn.execute("""
#         UPDATE wishlists
#         SET status = 'merged', updated_at = datetime('now')
#         WHERE guest_id = ?;
#     """, (guest_id,))


# def insert_wishlist_merge_audit(conn, user_wishlist_id, guest_wishlist_id,
#                                 user_id, guest_id, added, skipped):
#     message = f"Merged guest {guest_id} into user {user_id}: added={added}, skipped={skipped}"
#     conn.execute("""
#         INSERT INTO wishlist_audit (wishlist_id, user_id, guest_id, product_id, action, message, created_at)
#         VALUES (?, ?, ?, NULL, 'merge', ?, datetime('now'));
#     """, (user_wishlist_id, user_id, guest_id, message))


# -------------- pgsql --------------

# domain/wishlist/repository.py

from db import query_one, query_all, execute

# ============================================================
# CREATE OR FETCH WISHLIST
# ============================================================
def get_or_create_wishlist(user_id=None, guest_id=None):
    if not user_id and not guest_id:
        raise ValueError("Either user_id or guest_id must be provided")

    if user_id:
        row = query_one(
            """
            SELECT wishlist_id
            FROM wishlists
            WHERE user_id = %s AND status = 'active'
            LIMIT 1
            """,
            (user_id,),
        )
    else:
        row = query_one(
            """
            SELECT wishlist_id
            FROM wishlists
            WHERE guest_id = %s AND status = 'active'
            LIMIT 1
            """,
            (guest_id,),
        )

    if row:
        return row["wishlist_id"]

    new_row = query_one(
        """
        INSERT INTO wishlists (user_id, guest_id, status, created_at, updated_at)
        VALUES (%s, %s, 'active', NOW(), NOW())
        RETURNING wishlist_id
        """,
        (user_id, guest_id),
    )
    return new_row["wishlist_id"]

# ============================================================
# PRODUCT VALIDATION / ITEM CRUD
# ============================================================
def product_exists(product_id):
    row = query_one(
        "SELECT 1 FROM products WHERE product_id = %s LIMIT 1",
        (product_id,),
    )
    return bool(row)

def add_item(wishlist_id, product_id, user_id=None, guest_id=None):
    execute(
        """
        INSERT INTO wishlist_items (wishlist_id, product_id, created_at, updated_at)
        VALUES (%s, %s, NOW(), NOW())
        ON CONFLICT (wishlist_id, product_id)
        DO UPDATE SET updated_at = NOW()
        """,
        (wishlist_id, product_id),
    )

def remove_item(wishlist_id, product_id, user_id=None, guest_id=None):
    execute(
        """
        DELETE FROM wishlist_items
        WHERE wishlist_id = %s AND product_id = %s
        """,
        (wishlist_id, product_id),
    )

def clear_items(wishlist_id, user_id=None, guest_id=None):
    execute(
        "DELETE FROM wishlist_items WHERE wishlist_id = %s",
        (wishlist_id,),
    )

def get_items(wishlist_id):
    return query_all(
        """
        SELECT
            p.product_id,
            p.name,
            COALESCE(MIN(v.price_cents), 0) AS price_cents,
            (
                SELECT image_url
                FROM product_images i
                WHERE i.product_id = p.product_id
                ORDER BY sort_order ASC
                LIMIT 1
            ) AS image_url,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM product_variants pv
                    JOIN inventory inv ON pv.variant_id = inv.variant_id
                    WHERE pv.product_id = p.product_id
                      AND inv.quantity > 0
                ) THEN TRUE
                ELSE FALSE
            END AS available,
            wi.created_at,
            wi.updated_at
        FROM wishlist_items wi
        JOIN products p ON wi.product_id = p.product_id
        LEFT JOIN product_variants v ON v.product_id = p.product_id
        WHERE wi.wishlist_id = %s
        GROUP BY p.product_id, p.name, wi.created_at, wi.updated_at
        ORDER BY wi.created_at DESC
        """,
        (wishlist_id,),
    )

def get_count(wishlist_id):
    row = query_one(
        "SELECT COUNT(*) AS c FROM wishlist_items WHERE wishlist_id = %s",
        (wishlist_id,),
    )
    return row["c"] if row else 0

# ============================================================
# MERGE OPERATIONS (rewritten to avoid cursor arguments)
# ============================================================
def get_wishlist_by_guest_id(guest_id):
    return query_one(
        """
        SELECT *
        FROM wishlists
        WHERE guest_id = %s AND status = 'active'
        """,
        (guest_id,),
    )

def get_wishlist_by_user_id(user_id):
    return query_one(
        """
        SELECT *
        FROM wishlists
        WHERE user_id = %s AND status = 'active'
        """,
        (user_id,),
    )

def create_user_wishlist(user_id):
    row = query_one(
        """
        INSERT INTO wishlists (user_id, status, created_at, updated_at)
        VALUES (%s, 'active', NOW(), NOW())
        RETURNING wishlist_id
        """,
        (user_id,),
    )
    return row["wishlist_id"]

# def merge_wishlist_items_atomic(guest_wishlist_id, user_wishlist_id, user_id):
#     guest_rows = query_all(
#         "SELECT product_id FROM wishlist_items WHERE wishlist_id = %s",
#         (guest_wishlist_id,),
#     )
#     guest_items = [r["product_id"] for r in guest_rows]

#     added = 0
#     skipped = 0

#     for pid in guest_items:
#         exists = query_one(
#             "SELECT 1 FROM wishlist_items WHERE wishlist_id = %s AND product_id = %s",
#             (user_wishlist_id, pid),
#         )
#         if exists:
#             skipped += 1
#             continue

#         execute(
#             """
#             UPDATE wishlist_items
#             SET wishlist_id = %s, updated_at = NOW()
#             WHERE wishlist_id = %s AND product_id = %s
#             """,
#             (user_wishlist_id, guest_wishlist_id, pid),
#             commit=False,
#         )

#         check = query_one(
#             """
#             SELECT 1
#             FROM wishlist_items
#             WHERE wishlist_id = %s AND product_id = %s
#             """,
#             (user_wishlist_id, pid),
#         )
#         if not check:
#             execute(
#                 """
#                 INSERT INTO wishlist_items (wishlist_id, product_id, created_at, updated_at)
#                 VALUES (%s, %s, NOW(), NOW())
#                 """,
#                 (user_wishlist_id, pid),
#                 commit=False,
#             )
#         added += 1

#     execute(
#         "DELETE FROM wishlist_items WHERE wishlist_id = %s",
#         (guest_wishlist_id,),
#         commit=False,
#     )

#     return {"added": added, "skipped": skipped}
def merge_wishlist_items_atomic(guest_wishlist_id, user_wishlist_id, user_id):
    guest_rows = query_all(
        "SELECT product_id FROM wishlist_items WHERE wishlist_id = %s",
        (guest_wishlist_id,)
    )
    guest_items = [r["product_id"] for r in guest_rows]

    added = 0
    skipped = 0

    for pid in guest_items:
        exists = query_one(
            "SELECT 1 FROM wishlist_items WHERE wishlist_id = %s AND product_id = %s",
            (user_wishlist_id, pid),
        )
        if exists:
            skipped += 1
            continue

        updated = execute(
            """
            UPDATE wishlist_items
            SET wishlist_id = %s, updated_at = NOW()
            WHERE wishlist_id = %s AND product_id = %s
            """,
            (user_wishlist_id, guest_wishlist_id, pid),
            commit=False,
        )

        if updated and updated.rowcount > 0:
            added += 1
        else:
            skipped += 1

    execute(
        "DELETE FROM wishlist_items WHERE wishlist_id = %s",
        (guest_wishlist_id,),
        commit=False,
    )

    return {"added": added, "skipped": skipped}

def mark_wishlist_merged(guest_wishlist_id):
    execute(
        """
        UPDATE wishlists
        SET status = 'merged', updated_at = NOW()
        WHERE wishlist_id = %s
        """,
        (guest_wishlist_id,),
    )
