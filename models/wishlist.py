from db import get_db_connection

def get_wishlist_by_user(user_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM wishlist WHERE user_id = ?", (user_id,))
        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        cur.close()
        conn.close()


def add_to_wishlist(user_id, product_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        # Check for duplicates
        cur.execute("SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?", (user_id, product_id))
        if cur.fetchone():
            return {"message": "Already in wishlist"}

        cur.execute("INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)", (user_id, product_id))
        conn.commit()
        return {"message": "Added to wishlist"}
    finally:
        cur.close()
        conn.close()


def remove_from_wishlist(user_id, product_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?", (user_id, product_id))
        conn.commit()
        return {"message": "Removed from wishlist"}
    finally:
        cur.close()
        conn.close()
