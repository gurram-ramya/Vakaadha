
# routes/catalog.py
from flask import Blueprint, jsonify, g
from db import get_db_connection
from utils.auth import require_auth
from domain.catalog import service as catalog_service
import logging

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

# routes/catalog.py
@catalog_bp.route("/products/<int:product_id>/variants", methods=["GET"])
def get_product_variants(product_id):
    con = get_db_connection()
    rows = con.execute("""
        SELECT variant_id, size_label, stock
        FROM product_variants
        WHERE product_id = ?
    """, (product_id,)).fetchall()
    return jsonify([dict(row) for row in rows])
