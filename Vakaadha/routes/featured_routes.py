from flask import Blueprint, jsonify
import sqlite3
import os

featured_bp = Blueprint('featured_bp', __name__)

# ✅ Set absolute DB path relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'vakaadha.db')

def get_db_connection():
    print("🗂️  Using DB:", DB_PATH)  # Debug log
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@featured_bp.route('/featured-products', methods=['GET'])
def get_featured_products():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # ✅ Get one SKU per product (lowest sku_id)
        cur.execute('''
            SELECT 
                i.sku_id,
                p.name,
                p.price,
                i.image_name
            FROM products p
            JOIN inventory i ON i.product_id = p.product_id
            WHERE i.sku_id IN (
                SELECT MIN(sku_id)
                FROM inventory
                GROUP BY product_id
            )
            LIMIT 6;
        ''')
        
        rows = cur.fetchall()
        conn.close()

        featured = [{
            "sku_id": row["sku_id"],
            "name": row["name"],
            "price": row["price"],
            "image_name": row["image_name"]
        } for row in rows]

        print("✅ Featured Products:", featured)
        return jsonify(featured)
    
    except Exception as e:
        print("🔥 ERROR in /featured-products:", str(e))
        return jsonify({"error": "Server error fetching products"}), 500
