# routes/orders.py

import logging
from flask import Blueprint, jsonify, request, g
from utils.auth import require_auth
from db import get_db_connection
from domain.orders import service as order_service

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")

# -------------------------------------------------------------
# GET /api/orders
# List all orders for current user
# -------------------------------------------------------------
@orders_bp.route("", methods=["GET"])
@require_auth()
def list_orders():
    conn = get_db_connection()
    try:
        user_id = g.user["user_id"]
        orders = order_service.list_orders(conn, user_id)
        return jsonify(orders), 200
    except Exception as e:
        logging.exception("Error fetching order list")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()

# -------------------------------------------------------------
# POST /api/orders
# Create a new order from cart
# -------------------------------------------------------------
@orders_bp.route("", methods=["POST"])
@require_auth()
def create_order():
    conn = get_db_connection()
    try:
        user_id = g.user["user_id"]
        data = request.get_json(silent=True) or {}
        address_id = data.get("address_id")
        payment_method = data.get("payment_method", "cod")

        if not address_id:
            return jsonify({"error": "missing_address_id"}), 400

        order = order_service.create_order(conn, user_id, address_id, payment_method)
        conn.commit()
        return jsonify(order), 201

    except ValueError as e:
        conn.rollback()
        return jsonify({"error": "cart_empty", "message": str(e)}), 400
    except Exception as e:
        conn.rollback()
        logging.exception("Error creating order")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()

# -------------------------------------------------------------
# GET /api/orders/<id>
# Get single order details
# -------------------------------------------------------------
@orders_bp.route("/<int:order_id>", methods=["GET"])
@require_auth()
def get_order(order_id):
    conn = get_db_connection()
    try:
        user_id = g.user["user_id"]
        order = order_service.get_order(conn, user_id, order_id)
        if not order:
            return jsonify({"error": "not_found"}), 404
        return jsonify(order), 200
    except Exception as e:
        logging.exception("Error fetching order details")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()
