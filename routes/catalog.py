# routes/catalog.py

from flask import Blueprint, jsonify
import sqlite3

catalog_bp = Blueprint("catalog", __name__, url_prefix="/api")


def get_db():
    # Opens a connection to SQLite. Adjust path if needed.
    conn = sqlite3.connect("vakaadha.db")
    conn.row_factory = sqlite3.Row
    return conn


@catalog_bp.route("/products", methods=["GET"])
def get_products():
    """
    Fetch all products with their first image and variants.
    Use MIN(variant.price_cents) as base product price.
    """
    conn = get_db()
    cur = conn.cursor()

    # Base product info with image and min price from variants
    cur.execute("""
        SELECT p.product_id,
               p.name,
               p.description,
               MIN(v.price_cents) as price_cents,
               pi.image_url
        FROM products p
        LEFT JOIN product_variants v
               ON p.product_id = v.product_id
        LEFT JOIN product_images pi
               ON p.product_id = pi.product_id
        GROUP BY p.product_id
        ORDER BY p.product_id
    """)
    products = [dict(row) for row in cur.fetchall()]

    for prod in products:
        # Fetch variants for each product
        cur.execute("""
            SELECT variant_id,
                   size,
                   color,
                   price_cents,
                   sku
            FROM product_variants
            WHERE product_id = ?
            ORDER BY size
        """, (prod["product_id"],))
        variants = [dict(v) for v in cur.fetchall()]

        prod["variants"] = variants if variants else []

    conn.close()
    return jsonify(products)


@catalog_bp.route("/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    """
    Fetch a single product with images and variants.
    Use MIN(variant.price_cents) as base price.
    """
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT p.product_id,
               p.name,
               p.description,
               MIN(v.price_cents) as price_cents,
               pi.image_url
        FROM products p
        LEFT JOIN product_variants v
               ON p.product_id = v.product_id
        LEFT JOIN product_images pi
               ON p.product_id = pi.product_id
        WHERE p.product_id = ?
        GROUP BY p.product_id
    """, (product_id,))
    row = cur.fetchone()

    if not row:
        conn.close()
        return jsonify({"error": "Product not found"}), 404

    product = dict(row)

    # Fetch all images
    cur.execute("""
        SELECT image_url
        FROM product_images
        WHERE product_id = ?
        ORDER BY sort_order
    """, (product_id,))
    product["images"] = [r["image_url"] for r in cur.fetchall()]

    # Fetch variants
    cur.execute("""
        SELECT variant_id,
               size,
               color,
               price_cents,
               sku
        FROM product_variants
        WHERE product_id = ?
        ORDER BY size
    """, (product_id,))
    variants = [dict(v) for v in cur.fetchall()]
    product["variants"] = variants if variants else []

    conn.close()
    return jsonify(product)
