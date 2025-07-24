from flask import Blueprint, request, jsonify
import sqlite3

inventory_bp = Blueprint('inventory_bp', __name__)

def get_db_connection():
    return sqlite3.connect('vakaadha.db')

# GET /inventory/<product_id>
@inventory_bp.route('/inventory/<int:product_id>', methods=['GET'])
def get_inventory_by_product(product_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM inventory WHERE product_id=?", (product_id,))
    rows = cursor.fetchall()
    conn.close()

    skus = []
    for row in rows:
        skus.append({
            "sku_id": row[0],
            "product_id": row[1],
            "size": row[2],
            "color": row[3],
            "quantity": row[4]
        })
    return jsonify(skus)

# POST /inventory
@inventory_bp.route('/inventory', methods=['POST'])
def add_sku():
    data = request.get_json()
    required = ['product_id', 'size', 'color', 'quantity']
    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO inventory (product_id, size, color, quantity)
        VALUES (?, ?, ?, ?)
    ''', (data['product_id'], data['size'], data['color'], data['quantity']))
    conn.commit()
    conn.close()

    return jsonify({"message": "SKU added successfully"}), 201

# PUT /inventory/<sku_id>
@inventory_bp.route('/inventory/<int:sku_id>', methods=['PUT'])
def update_quantity(sku_id):
    data = request.get_json()
    if 'quantity' not in data:
        return jsonify({"error": "Quantity required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE inventory SET quantity=? WHERE sku_id=?", (data['quantity'], sku_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Quantity updated"})
