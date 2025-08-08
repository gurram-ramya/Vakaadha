from db import get_db_connection

def get_cart_by_user(user_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
              c.cart_id,
              c.user_id, 
              c.sku_id,
              c.size,
              c.quantity,
              i.image_name,
              p.name AS product_name,
              p.price
            FROM cart c
            JOIN inventory i ON c.sku_id = i.sku_id
            JOIN products p ON i.product_id = p.product_id
            WHERE c.user_id = ?
        """, (user_id,))
        
        rows = cur.fetchall()
        return [dict(row) for row in rows]
    finally:
        cur.close()
        conn.close()


def add_to_cart(user_id, sku_id, size, quantity=1):
    conn = get_db_connection()
    try:
        print(f"[add_to_cart] user_id: {user_id}, sku_id: {sku_id}, size: {size}, quantity: {quantity}")
        cur = conn.cursor()

        # Check if product already in cart with same size
        cur.execute("""
            SELECT * FROM cart WHERE user_id = ? AND sku_id = ? AND size = ?
        """, (user_id, sku_id, size))

        
        existing_item = cur.fetchone()
        if existing_item:
            # If already exists, update quantity
            cur.execute(
                "UPDATE cart SET quantity = quantity + ? WHERE user_id = ? AND sku_id = ? AND size = ?",
                (quantity, user_id, sku_id, size)
            )
        else:
            # Else insert new row
            cur.execute(
                "INSERT INTO cart (user_id, sku_id, size, quantity) VALUES (?, ?, ?, ?)",
                (user_id, sku_id, size, quantity)
            )

        conn.commit()
        return {"message": "Added to cart"}
    except Exception as e:
        print(f"[add_to_cart ERROR] {e}")
        return {"error": str(e)}
    finally:
        cur.close()
        conn.close()


def update_cart_quantity(user_id, sku_id, quantity):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE cart SET quantity = ? WHERE user_id = ? AND sku_id = ?",
            (quantity, user_id, sku_id)
        )
        conn.commit()
        return {"message": "Quantity updated"}
    finally:
        cur.close()
        conn.close()

def remove_from_cart(user_id, sku_id):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM cart WHERE user_id = ? AND sku_id = ?",
            (user_id, sku_id)
        )
        conn.commit()
        return {"message": "Removed from cart"}
    finally:
        cur.close()
        conn.close()
