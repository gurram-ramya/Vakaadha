"""
routes/admin.py — integrated with existing service layer
"""
from flask import Blueprint, jsonify, request, g
from firebase_admin import auth as firebase_auth
from db import get_db_connection
from utils.auth import require_auth
from services import file_service
from domain.catalog import service as catalog_service
from domain.orders import service as order_service
from domain.payments import service as payment_service
from domain.users import service as user_service
import os

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

# --------------------------------------------------------------------
# 🔐 AUTH HELPERS
# --------------------------------------------------------------------

def require_admin(f):
    """Decorator that checks Firebase token and is_admin flag."""
    from functools import wraps

    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401

        token = auth_header.split("Bearer ")[1]
        try:
            decoded = firebase_auth.verify_id_token(token)
            email = decoded.get("email")

            conn = get_db_connection()
            user = user_service.get_user_by_email(conn, email)
            if not user or not user.get("is_admin"):
                return jsonify({"error": "Not an admin"}), 403

            g.admin_email = email
            g.admin_user_id = user["user_id"]
            return f(*args, **kwargs)
        except Exception as e:
            print("[require_admin]", e)
            return jsonify({"error": "Invalid token"}), 401

    return wrapper


# --------------------------------------------------------------------
# 🛍 PRODUCTS
# --------------------------------------------------------------------

@admin_bp.route("/products", methods=["GET"])
@require_admin
def admin_list_products():
    conn = get_db_connection()
    products = catalog_service.list_products(conn)
    return jsonify(products)


@admin_bp.route("/products", methods=["POST"])
@require_admin
def admin_create_product():
    data = request.get_json()
    conn = get_db_connection()
    new_product = catalog_service.create_product(
        conn,
        name=data.get("name"),
        description=data.get("description", ""),
        price_cents=data.get("price_cents"),
    )
    return jsonify({"status": "success", "product": new_product}), 201


@admin_bp.route("/products/<int:pid>", methods=["DELETE"])
@require_admin
def admin_delete_product(pid):
    conn = get_db_connection()
    catalog_service.delete_product(conn, pid)
    return jsonify({"status": "deleted"})


# --------------------------------------------------------------------
# 📦 ORDERS
# --------------------------------------------------------------------

@admin_bp.route("/orders", methods=["GET"])
@require_admin
def admin_list_orders():
    conn = get_db_connection()
    orders = order_service.list_orders_with_users(conn)
    return jsonify(orders)


@admin_bp.route("/orders/<int:oid>/status", methods=["PUT"])
@require_admin
def admin_update_order_status(oid):
    data = request.get_json()
    conn = get_db_connection()
    order_service.update_order_status(conn, oid, data.get("status"))
    return jsonify({"status": "updated"})


@admin_bp.route("/orders/<int:oid>/refund", methods=["POST"])
@require_admin
def admin_refund_order(oid):
    conn = get_db_connection()
    result = payment_service.issue_refund_for_order(conn, oid)
    return jsonify(result)


# --------------------------------------------------------------------
# 🎁 PROMOTIONS / VOUCHERS
# --------------------------------------------------------------------

@admin_bp.route("/vouchers", methods=["GET"])
@require_admin
def admin_list_vouchers():
    conn = get_db_connection()
    vouchers = catalog_service.list_vouchers(conn)
    return jsonify(vouchers)


@admin_bp.route("/vouchers", methods=["POST"])
@require_admin
def admin_create_voucher():
    data = request.get_json()
    conn = get_db_connection()
    voucher = catalog_service.create_voucher(conn, data)
    return jsonify(voucher), 201


@admin_bp.route("/vouchers/<int:vid>", methods=["DELETE"])
@require_admin
def admin_delete_voucher(vid):
    conn = get_db_connection()
    catalog_service.delete_voucher(conn, vid)
    return jsonify({"status": "deleted"})


# --------------------------------------------------------------------
# 🖼 MEDIA MANAGEMENT
# --------------------------------------------------------------------

UPLOAD_DIR = os.path.join(os.getcwd(), "media")

@admin_bp.route("/media", methods=["GET"])
@require_admin
def admin_list_media():
    files = file_service.list_media_files(UPLOAD_DIR)
    return jsonify(files)


@admin_bp.route("/media", methods=["POST"])
@require_admin
def admin_upload_media():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files["file"]
    result = file_service.save_media_file(file, UPLOAD_DIR)
    return jsonify(result), 201


@admin_bp.route("/media/<path:fname>", methods=["DELETE"])
@require_admin
def admin_delete_media(fname):
    result = file_service.delete_media_file(fname, UPLOAD_DIR)
    return jsonify(result)


# --------------------------------------------------------------------
# 📊 ANALYTICS
# --------------------------------------------------------------------

@admin_bp.route("/analytics/sales", methods=["GET"])
@require_admin
def admin_sales_analytics():
    conn = get_db_connection()
    data = order_service.get_sales_summary(conn)
    return jsonify(data)


@admin_bp.route("/analytics/top-products", methods=["GET"])
@require_admin
def admin_top_products():
    conn = get_db_connection()
    data = order_service.get_top_products(conn)
    return jsonify(data)
