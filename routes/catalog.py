# routes/catalog.py
from flask import Blueprint, jsonify, request
import sqlite3

catalog_bp = Blueprint("catalog", __name__, url_prefix="/api")

DB_PATH = "vakaadha.db"


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@catalog_bp.route("/products", methods=["GET"])
def list_products():
    """
    Returns all products with their first image, base price, and variant sizes.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    # Base product info
    cur.execute("""
        SELECT 
            p.product_id AS id,
            p.name,
            p.category,
            MIN(v.price_cents) AS price_cents,
            (SELECT image_url 
             FROM product_images 
             WHERE product_id = p.product_id 
             ORDER BY sort_order ASC 
             LIMIT 1) AS image_url
        FROM products p
        LEFT JOIN product_variants v ON p.product_id = v.product_id
        GROUP BY p.product_id
        ORDER BY p.created_at DESC;
    """)
    products = [dict(row) for row in cur.fetchall()]

    # Attach variant sizes per product
    for prod in products:
        cur.execute("""
            SELECT size, color, price_cents 
            FROM product_variants 
            WHERE product_id = ?
            ORDER BY size
        """, (prod["id"],))
        prod["variants"] = [dict(v) for v in cur.fetchall()]

    conn.close()
    return jsonify(products)



@catalog_bp.route("/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    """
    Returns a single product with details, variants, and images.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    # Base product
    cur.execute("SELECT * FROM products WHERE product_id = ?", (product_id,))
    product = cur.fetchone()
    if not product:
        conn.close()
        return jsonify({"error": "Product not found"}), 404

    # Variants
    cur.execute("""
        SELECT variant_id, size, color, sku, price_cents
        FROM product_variants
        WHERE product_id = ?
        ORDER BY created_at
    """, (product_id,))
    variants = [dict(v) for v in cur.fetchall()]

    # Images
    cur.execute("""
        SELECT image_url, sort_order
        FROM product_images
        WHERE product_id = ?
        ORDER BY sort_order
    """, (product_id,))
    images = [dict(img) for img in cur.fetchall()]

    # Details (optional)
    cur.execute("""
        SELECT long_description, specifications, care_instructions
        FROM product_details
        WHERE product_id = ?
    """, (product_id,))
    details = cur.fetchone()
    details = dict(details) if details else {}

    conn.close()

    result = dict(product)
    result["variants"] = variants
    result["images"] = images
    result["details"] = details

    return jsonify(result)
