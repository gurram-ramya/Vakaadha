# domain/orders/repository.py — Order Persistence Layer

import uuid
from datetime import datetime

# ----------------------------
# ORDER INSERTION
# ----------------------------
def insert_order(conn, user_id, source_cart_id, order_no, payment_method,
                 subtotal_cents, shipping_cents, discount_cents, total_cents, address_id):
    cur = conn.execute(
        """
        INSERT INTO orders (
            user_id, source_cart_id, order_no, status, payment_method,
            subtotal_cents, shipping_cents, discount_cents, total_cents,
            shipping_address_id, created_at, updated_at
        )
        VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'));
        """,
        (
            user_id, source_cart_id, order_no, payment_method,
            subtotal_cents, shipping_cents, discount_cents, total_cents, address_id
        ),
    )
    return cur.lastrowid


def insert_order_item(conn, order_id, product_id, variant_id, quantity, price_cents):
    conn.execute(
        """
        INSERT INTO order_items (order_id, product_id, variant_id, quantity, price_cents)
        VALUES (?, ?, ?, ?, ?);
        """,
        (order_id, product_id, variant_id, quantity, price_cents),
    )


# ----------------------------
# ORDER RETRIEVAL
# ----------------------------
def get_orders_by_user(conn, user_id):
    cur = conn.execute(
        """
        SELECT * FROM orders
        WHERE user_id = ?
        ORDER BY created_at DESC;
        """,
        (user_id,),
    )
    return cur.fetchall()


def get_order_details(conn, order_id):
    cur_order = conn.execute("SELECT * FROM orders WHERE order_id = ?;", (order_id,))
    order = cur_order.fetchone()
    if not order:
        return None

    cur_items = conn.execute(
        """
        SELECT oi.*, p.name AS product_name, pv.size, pv.color
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        WHERE oi.order_id = ?;
        """,
        (order_id,),
    )
    items = cur_items.fetchall()
    return {"order": order, "items": items}


# ----------------------------
# STATUS UPDATES
# ----------------------------
def update_order_status(conn, order_id, status):
    conn.execute(
        """
        UPDATE orders
        SET status = ?, updated_at = datetime('now')
        WHERE order_id = ?;
        """,
        (status, order_id),
    )


def update_payment_status(conn, order_id, payment_status):
    conn.execute(
        """
        UPDATE orders
        SET payment_status = ?, updated_at = datetime('now')
        WHERE order_id = ?;
        """,
        (payment_status, order_id),
    )

def get_order_with_items_and_address(order_id: int, conn):
    order_sql = """
        SELECT o.*, p.razorpay_payment_id, p.payment_txn_id
        FROM orders o
        LEFT JOIN payments p ON o.order_id = p.order_id
        WHERE o.order_id = ?;
    """
    cur = conn.execute(order_sql, (order_id,))
    order = cur.fetchone()
    if not order:
        return None

    items_sql = """
        SELECT oi.*, pr.name AS product_name, pv.size
        FROM order_items oi
        JOIN products pr ON oi.product_id = pr.product_id
        JOIN product_variants pv ON oi.variant_id = pv.variant_id
        WHERE oi.order_id = ?;
    """
    cur = conn.execute(items_sql, (order_id,))
    items = cur.fetchall()

    addr_sql = """
        SELECT * FROM addresses
        WHERE address_id = (SELECT shipping_address_id FROM orders WHERE order_id = ?);
    """
    cur = conn.execute(addr_sql, (order_id,))
    address = cur.fetchone()

    return {
        "order": order,
        "items": items,
        "address": address
    }

