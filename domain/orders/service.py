# domain/orders/service.py

import logging
from datetime import datetime

# -------------------------------------------------------------
# Create a new order from user's cart
# -------------------------------------------------------------
def create_order(conn, user_id, address_id, payment_method="cod"):
    cur = conn.cursor()

    # 1️⃣ Fetch user's cart
    cur.execute("""
        SELECT ci.variant_id, ci.quantity, pv.price_cents, pv.product_id, 
               p.name AS product_name, pv.name AS variant_name
        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        JOIN carts c ON ci.cart_id = c.cart_id
        WHERE c.user_id = ?
    """, (user_id,))
    items = cur.fetchall()
    if not items:
        raise ValueError("Cart is empty")

    # 2️⃣ Calculate totals
    subtotal = sum([(i["price_cents"] / 100.0) * i["quantity"] for i in items])
    shipping = 0 if subtotal > 1000 else 50
    total = subtotal + shipping

    # 3️⃣ Insert order
    cur.execute("""
        INSERT INTO orders (user_id, address_id, subtotal, shipping, total, status, payment_status)
        VALUES (?, ?, ?, ?, ?, 'created', ?)
    """, (user_id, address_id, subtotal, shipping, total, 
          "pending" if payment_method != "cod" else "paid"))
    order_id = cur.lastrowid

    # 4️⃣ Insert order items
    for i in items:
        cur.execute("""
            INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, quantity, price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            order_id,
            i["product_id"],
            i["variant_id"],
            i["product_name"],
            i["variant_name"],
            i["quantity"],
            i["price_cents"] / 100.0
        ))

    logging.info({
        "event": "order_created",
        "user_id": user_id,
        "order_id": order_id,
        "item_count": len(items),
        "total": total
    })

    return {
        "order_id": order_id,
        "status": "created",
        "subtotal": subtotal,
        "shipping": shipping,
        "total": total,
        "payment_required": payment_method != "cod"
    }

# -------------------------------------------------------------
# Fetch a specific order with details
# -------------------------------------------------------------
def get_order(conn, user_id, order_id):
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM orders WHERE order_id = ? AND user_id = ?
    """, (order_id, user_id))
    order = cur.fetchone()
    if not order:
        return None

    cur.execute("""
        SELECT product_name, variant_name, quantity, price
        FROM order_items
        WHERE order_id = ?
    """, (order_id,))
    items = cur.fetchall()

    cur.execute("""
        SELECT name, line1, line2, city, state, pincode, phone
        FROM user_addresses
        WHERE address_id = ?
    """, (order["address_id"],))
    addr = cur.fetchone()

    return {
        **dict(order),
        "items": [dict(i) for i in items],
        "shipping_address": dict(addr) if addr else None
    }

# -------------------------------------------------------------
# List user’s orders
# -------------------------------------------------------------
def list_orders(conn, user_id):
    cur = conn.cursor()
    cur.execute("""
        SELECT order_id, status, total, created_at
        FROM orders
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (user_id,))
    return [dict(r) for r in cur.fetchall()]
