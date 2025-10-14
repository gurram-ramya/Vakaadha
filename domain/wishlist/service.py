# domain/wishlist/service.py

import logging
from sqlite3 import IntegrityError

# -------------------------------------------------------------
# Fetch wishlist items with product enrichment
# -------------------------------------------------------------
def get_user_wishlist(conn, user_id):
    cur = conn.cursor()
    query = """
        SELECT 
            uw.product_id,
            p.name,
            p.description,
            MIN(v.price_cents) / 100.0 AS price,
            (
                SELECT pi.image_url
                FROM product_images pi
                WHERE pi.product_id = p.product_id
                ORDER BY pi.sort_order ASC
                LIMIT 1
            ) AS image_url
        FROM user_wishlist uw
        JOIN products p ON uw.product_id = p.product_id
        LEFT JOIN product_variants v ON p.product_id = v.product_id
        WHERE uw.user_id = ?
        GROUP BY uw.product_id
        ORDER BY uw.created_at DESC
    """
    cur.execute(query, (user_id,))
    rows = cur.fetchall()
    return [dict(row) for row in rows]


# -------------------------------------------------------------
# Fetch wishlist item count
# -------------------------------------------------------------
def get_user_wishlist_count(conn, user_id):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS count FROM user_wishlist WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    return row["count"] if row else 0


# -------------------------------------------------------------
# Add product to wishlist
# -------------------------------------------------------------
def add_to_wishlist(conn, user_id, product_id):
    cur = conn.cursor()

    # Validate product exists
    cur.execute("SELECT COUNT(*) AS c FROM products WHERE product_id = ?", (product_id,))
    exists = cur.fetchone()["c"]
    if not exists:
        return {"status": "skipped", "reason": "invalid_product"}

    try:
        cur.execute(
            """
            INSERT OR IGNORE INTO user_wishlist (user_id, product_id)
            VALUES (?, ?)
            """,
            (user_id, product_id),
        )
        if cur.rowcount > 0:
            logging.info(f"Wishlist add success user={user_id} product={product_id}")
            return {"status": "added", "product_id": product_id}
        else:
            return {"status": "exists", "product_id": product_id}
    except IntegrityError as e:
        logging.error(f"Wishlist insert failed: {str(e)}")
        return {"status": "error", "message": str(e)}


# -------------------------------------------------------------
# Remove product from wishlist
# -------------------------------------------------------------
def remove_from_wishlist(conn, user_id, product_id):
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM user_wishlist WHERE user_id = ? AND product_id = ?",
        (user_id, product_id),
    )
    if cur.rowcount > 0:
        logging.info(f"Wishlist remove success user={user_id} product={product_id}")
        return {"status": "removed", "product_id": product_id}
    return {"status": "not_found", "product_id": product_id}


# -------------------------------------------------------------
# Merge guest wishlist into user's wishlist
# -------------------------------------------------------------
def merge_guest_wishlist(conn, user_id, items):
    cur = conn.cursor()
    added, skipped = 0, 0

    for item in items:
        product_id = item.get("product_id")
        if not product_id:
            skipped += 1
            continue

        # Validate product exists
        cur.execute("SELECT COUNT(*) AS c FROM products WHERE product_id = ?", (product_id,))
        exists = cur.fetchone()["c"]
        if not exists:
            skipped += 1
            continue

        try:
            cur.execute(
                """
                INSERT OR IGNORE INTO user_wishlist (user_id, product_id)
                VALUES (?, ?)
                """,
                (user_id, product_id),
            )
            if cur.rowcount > 0:
                added += 1
            else:
                skipped += 1
        except IntegrityError as e:
            logging.error(f"Wishlist merge insert failed user={user_id} product={product_id}: {str(e)}")
            skipped += 1

    logging.info(
        {
            "event": "wishlist_merge",
            "user_id": user_id,
            "items_added": added,
            "items_skipped": skipped,
        }
    )

    return {
        "status": "merged",
        "items_added": added,
        "items_skipped": skipped,
    }
