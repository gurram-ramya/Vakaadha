
from flask import Blueprint, request, jsonify
import sqlite3
from utils.auth import require_auth

order_bp = Blueprint('order_bp', __name__)

def get_db_connection():
    return sqlite3.connect('vakaadha.db')

# ✅ POST /orders
@order_bp.route('/orders', methods=['POST'])
@require_auth
def place_order():
    user_id = request.user['uid']
    data = request.get_json()
    address = data.get("address")
    payment_method = data.get("payment_method")

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get cart items
    cursor.execute('''
        SELECT cart.sku_id, cart.quantity, products.price
        FROM cart
        JOIN inventory ON cart.sku_id = inventory.sku_id
        JOIN products ON inventory.product_id = products.product_id
        WHERE cart.user_id = ?
    ''', (user_id,))
    cart_items = cursor.fetchall()

    if not cart_items:
        return jsonify({"error": "Cart is empty"}), 400

    total = sum(qty * price for _, qty, price in cart_items)

    # Insert into orders
    cursor.execute('''
        INSERT INTO orders (user_id, total_amount, status)
        VALUES (?, ?, ?)
    ''', (user_id, total, "PLACED"))
    order_id = cursor.lastrowid

    # Insert order items
    for sku_id, qty, price in cart_items:
        cursor.execute('''
            INSERT INTO order_items (order_id, sku_id, quantity, price)
            VALUES (?, ?, ?, ?)
        ''', (order_id, sku_id, qty, price))

    # Clear cart
    cursor.execute("DELETE FROM cart WHERE user_id=?", (user_id,))
    conn.commit()
    conn.close()

    return jsonify({
        "message": "Order placed",
        "order_id": order_id,
        "total_amount": total
    })


# ✅ GET /orders (list all orders for logged-in user)
@order_bp.route('/orders', methods=['GET'])
@require_auth
def get_user_orders():
    user_id = request.user['uid']

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT order_id, order_date, status, total_amount
        FROM orders
        WHERE user_id = ?
        ORDER BY order_date DESC
    ''', (user_id,))
    orders = cursor.fetchall()

    final_orders = []
    for order in orders:
        final_orders.append({
            "order_id": order[0],
            "order_date": order[1],
            "status": order[2],
            "total_amount": order[3]
        })

    conn.close()
    return jsonify(final_orders)


# ✅ GET /orders/<order_id> (view single order)
@order_bp.route('/orders/<int:order_id>', methods=['GET'])
@require_auth
def get_order_details(order_id):
    user_id = request.user['uid']
    conn = get_db_connection()
    cursor = conn.cursor()

    # Validate ownership
    cursor.execute('''
        SELECT order_id, user_id, total_amount, status, order_date
        FROM orders WHERE order_id = ? AND user_id = ?
    ''', (order_id, user_id))
    order = cursor.fetchone()

    if not order:
        conn.close()
        return jsonify({"error": "Order not found"}), 404

    # Get items
    cursor.execute('''
        SELECT p.name AS product_name, oi.quantity, oi.price
        FROM order_items oi
        JOIN inventory i ON oi.sku_id = i.sku_id
        JOIN products p ON i.product_id = p.product_id
        WHERE oi.order_id = ?
    ''', (order_id,))
    items = [dict(zip(["product_name", "quantity", "price"], row)) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        "order_id": order[0],
        "user_id": order[1],
        "total_amount": order[2],
        "status": order[3],
        "order_date": order[4],
        "items": items
    })
