from flask import Blueprint, request, jsonify
import sqlite3

cart_bp = Blueprint('cart_bp', __name__)

def get_db_connection():
    return sqlite3.connect('vakaadha.db')

# GET /cart
@cart_bp.route('/cart', methods=['GET'])
def get_cart():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"error": "User ID required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT cart.cart_id, cart.quantity, inventory.size, inventory.color,
               inventory.sku_id, inventory.product_id,
               products.name, products.price, inventory.image_name
        FROM cart
        JOIN inventory ON cart.sku_id = inventory.sku_id
        JOIN products ON inventory.product_id = products.product_id
        WHERE cart.user_id = ?
    ''', (user_id,))
    items = cursor.fetchall()
    conn.close()

    cart_items = []
    for row in items:
        cart_items.append({
            "cart_id": row[0],
            "quantity": row[1],
            "size": row[2],
            "color": row[3],
            "sku_id": row[4],
            "product_id": row[5],
            "product_name": row[6],
            "price": row[7],
            "image_name": row[8]
        })
    return jsonify(cart_items)

# POST /cart
@cart_bp.route('/cart', methods=['POST'])
def add_to_cart():
    data = request.get_json()
    print("🛒 Incoming cart payload:", data)
    required = ['user_id', 'sku_id', 'quantity']
    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    # Check if item already exists
    cursor.execute("SELECT * FROM cart WHERE user_id=? AND sku_id=?", (data['user_id'], data['sku_id']))
    existing = cursor.fetchone()
    if existing:
        # Update quantity
        new_qty = existing[3] + data['quantity']
        cursor.execute("UPDATE cart SET quantity=? WHERE cart_id=?", (new_qty, existing[0]))
    else:
        cursor.execute("INSERT INTO cart (user_id, sku_id, quantity) VALUES (?, ?, ?)", 
                       (data['user_id'], data['sku_id'], data['quantity']))
    conn.commit()
    conn.close()

    return jsonify({"message": "Cart updated"})

# PUT /cart/<item_id>
@cart_bp.route('/cart/<int:item_id>', methods=['PUT'])
def update_cart_item(item_id):
    data = request.get_json()
    if 'quantity' not in data:
        return jsonify({"error": "Quantity required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE cart SET quantity=? WHERE cart_id=?", (data['quantity'], item_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Cart item updated"})

# DELETE /cart/<item_id>
@cart_bp.route('/cart/<int:item_id>', methods=['DELETE'])
def remove_cart_item(item_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cart WHERE cart_id=?", (item_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Cart item removed"})
