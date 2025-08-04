from flask import Blueprint, request, jsonify
import sqlite3

product_bp = Blueprint('product_bp', __name__)

def get_db_connection():
    return sqlite3.connect('vakaadha.db')  # Path matches current location

# GET /products
@product_bp.route('/products', methods=['GET'])
def get_all_products():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT p.product_id, p.name, p.description, p.category, p.price, i.image_name
        FROM products p
        JOIN inventory i ON p.product_id = i.product_id
        GROUP BY p.product_id
    ''')
    rows = cursor.fetchall()
    conn.close()

    products = []
    for row in rows:
        products.append({
            "product_id": row[0],
            "name": row[1],
            "description": row[2],
            "category": row[3],
            "price": row[4],
            "image_name": row[5]
        })
    return jsonify(products)


# GET /products/<id>
@product_bp.route('/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get product details
    cursor.execute('SELECT * FROM products WHERE product_id = ?', (product_id,))
    product_row = cursor.fetchone()

    if not product_row:
        conn.close()
        return jsonify({"error": "Product not found"}), 404

    product = {
        "product_id": product_row[0],
        "name": product_row[1],
        "description": product_row[2],
        "category": product_row[3],
        "price": product_row[4]
    }

    # Get inventory options
    cursor.execute('''
        SELECT sku_id, size, color, quantity, image_name
        FROM inventory
        WHERE product_id = ?
    ''', (product_id,))
    inventory = [dict(zip(["sku_id", "size", "color", "quantity", "image_name"], row)) for row in cursor.fetchall()]

    conn.close()

    product["inventory"] = inventory
    return jsonify(product)


# POST /products (admin only)
@product_bp.route('/products', methods=['POST'])
def add_product():
    data = request.get_json()
    required = ['name', 'description', 'category', 'price', 'image_url']
    if not all(k in data for k in required):
        return jsonify({"error": "Missing fields"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO products (name, description, category, price, image_url)
        VALUES (?, ?, ?, ?, ?)
    ''', (data['name'], data['description'], data['category'], data['price'], data['image_url']))
    conn.commit()
    conn.close()

    return jsonify({"message": "Product added successfully"}), 201
