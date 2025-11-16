# # routes/orders.py — Order API Routes

# from flask import Blueprint, request, jsonify
# from domain.orders import service as order_service

# orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")


# # =============================================================
# # CREATE ORDER FROM CART
# # =============================================================
# @orders_bp.route("", methods=["POST"])
# def create_order():
#     data = request.get_json(force=True)
#     user_id = data.get("user_id")
#     cart_id = data.get("cart_id")
#     address_id = data.get("address_id")
#     payment_method = data.get("payment_method", "COD")

#     if not all([user_id, cart_id, address_id]):
#         return jsonify({"error": "Missing required fields"}), 400

#     try:
#         order = order_service.create_order_from_cart(
#             user_id=user_id,
#             cart_id=cart_id,
#             address_id=address_id,
#             payment_method=payment_method,
#         )
#         return jsonify(order), 201
#     except ValueError as e:
#         return jsonify({"error": str(e)}), 400
#     except Exception as e:
#         return jsonify({"error": f"Failed to create order: {e}"}), 500


# # =============================================================
# # LIST ORDERS FOR USER
# # =============================================================
# @orders_bp.route("/user/<int:user_id>", methods=["GET"])
# def list_orders(user_id):
#     try:
#         orders = order_service.list_user_orders(user_id)
#         return jsonify(orders), 200
#     except Exception as e:
#         return jsonify({"error": f"Failed to fetch orders: {e}"}), 500


# # =============================================================
# # GET ORDER DETAILS
# # =============================================================
# @orders_bp.route("/<int:order_id>", methods=["GET"])
# def get_order(order_id):
#     try:
#         order = order_service.get_order_details(order_id)
#         if not order:
#             return jsonify({"error": "Order not found"}), 404
#         return jsonify(order), 200
#     except Exception as e:
#         return jsonify({"error": f"Failed to fetch order details: {e}"}), 500


# # =============================================================
# # UPDATE ORDER STATUS
# # =============================================================
# @orders_bp.route("/<int:order_id>/status", methods=["PUT"])
# def update_order_status(order_id):
#     data = request.get_json(force=True)
#     status = data.get("status")
#     if not status:
#         return jsonify({"error": "Missing status"}), 400

#     try:
#         order_service.update_order_status(order_id, status)
#         return jsonify({"message": "Order status updated"}), 200
#     except Exception as e:
#         return jsonify({"error": f"Failed to update status: {e}"}), 500


# # =============================================================
# # UPDATE PAYMENT STATUS
# # =============================================================
# @orders_bp.route("/<int:order_id>/payment", methods=["PUT"])
# def update_payment_status(order_id):
#     data = request.get_json(force=True)
#     payment_status = data.get("payment_status")
#     if not payment_status:
#         return jsonify({"error": "Missing payment_status"}), 400

#     try:
#         order_service.update_payment_status(order_id, payment_status)
#         return jsonify({"message": "Payment status updated"}), 200
#     except Exception as e:
#         return jsonify({"error": f"Failed to update payment status: {e}"}), 500

# @orders_bp.route("/confirmation/<int:order_id>", methods=["GET"])
# def get_order_confirmation(order_id):
#     conn = get_db()
#     order = orders_service.get_order_confirmation_details(order_id, conn)
#     if not order:
#         return jsonify({"error": "Order not found"}), 404
#     return jsonify(order), 200



# -------------- pgsql ---------------

# routes/orders.py

from flask import Blueprint, request, jsonify
from domain.orders import service as order_service

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")


@orders_bp.post("")
def create_order():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    cart_id = data.get("cart_id")
    address_id = data.get("address_id")
    payment_method = data.get("payment_method", "COD")

    if not all([user_id, cart_id, address_id]):
        return jsonify({"error": "missing_fields"}), 400

    try:
        result = order_service.create_order_from_cart(
            user_id=user_id,
            cart_id=cart_id,
            address_id=address_id,
            payment_method=payment_method,
        )
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@orders_bp.get("/user/<int:user_id>")
def list_orders(user_id):
    try:
        rows = order_service.list_user_orders(user_id)
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@orders_bp.get("/<int:order_id>")
def get_order(order_id):
    try:
        row = order_service.get_order_details(order_id)
        if not row:
            return jsonify({"error": "not_found"}), 404
        return jsonify(row), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@orders_bp.put("/<int:order_id>/status")
def update_order_status(order_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if not status:
        return jsonify({"error": "missing_status"}), 400

    try:
        order_service.update_order_status(order_id, status)
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@orders_bp.put("/<int:order_id>/payment")
def update_payment_status(order_id):
    data = request.get_json(silent=True) or {}
    payment_status = data.get("payment_status")
    if not payment_status:
        return jsonify({"error": "missing_payment_status"}), 400

    try:
        order_service.update_payment_status(order_id, payment_status)
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@orders_bp.get("/confirmation/<int:order_id>")
def order_confirmation(order_id):
    try:
        data = order_service.get_order_confirmation_details(order_id)
        if not data:
            return jsonify({"error": "not_found"}), 404
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
