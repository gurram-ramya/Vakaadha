
# routes/catalog.py
from flask import Blueprint, jsonify, g
from db import get_db_connection
from utils.auth import require_auth
from domain.catalog import service as catalog_service
import logging
import sqlite3

catalog_bp = Blueprint("catalog", __name__, url_prefix="/api")

@catalog_bp.route("/products", methods=["GET"])
def get_products():
    try:
        conn = get_db_connection()
        products = catalog_service.get_all_products(conn)
        return jsonify(products), 200
    except Exception as e:
        logging.exception("Error fetching products")
        return jsonify({"error": "internal_error", "message": str(e)}), 500

@catalog_bp.route("/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    try:
        conn = get_db_connection()
        product = catalog_service.get_product_detail(conn, product_id)
        if not product:
            return jsonify({"error": "not_found"}), 404
        return jsonify(product), 200
    except Exception as e:
        logging.exception("Error fetching product detail")
        return jsonify({"error": "internal_error", "message": str(e)}), 500

# ============================================================
# GET PRODUCT VARIANTS (for Wishlist "Move to Bag" popup)
# ============================================================
@catalog_bp.route("/products/<int:product_id>/variants", methods=["GET"])
def get_product_variants(product_id):
    """
    Returns all variants for a given product (size, color, price, stock).
    Uses the global g.db connection (already created in app factory).
    Compatible with wishlist.js popup for size selection.
    """
    import logging
    from flask import jsonify, g

    try:
        cur = g.db.cursor()
        g.db.row_factory = sqlite3.Row

        rows = cur.execute("""
            SELECT
                v.variant_id,
                v.size,
                v.color,
                v.price_cents,
                COALESCE(inv.quantity, 0) AS stock
            FROM product_variants v
            LEFT JOIN inventory inv ON inv.variant_id = v.variant_id
            WHERE v.product_id = ?
            ORDER BY
                CASE v.size
                    WHEN 'XS' THEN 1
                    WHEN 'S' THEN 2
                    WHEN 'M' THEN 3
                    WHEN 'L' THEN 4
                    WHEN 'XL' THEN 5
                    WHEN 'XXL' THEN 6
                    ELSE 99
                END;
        """, (product_id,)).fetchall()

        if not rows:
            return jsonify([]), 200

        variants = [
            {
                "variant_id": row["variant_id"],
                "size": row["size"],
                "size_label": row["size"],  # frontend expects this
                "color": row["color"],
                "price_cents": row["price_cents"],
                "stock": row["stock"],
            }
            for row in rows
        ]

        return jsonify(variants), 200

    except Exception as e:
        logging.exception("Error fetching product variants")
        return jsonify({
            "error": "database_error",
            "details": str(e)
        }), 500
