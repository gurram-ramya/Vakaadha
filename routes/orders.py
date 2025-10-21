# routes/order.py — Checkout API Endpoint (Phase 3)
# -------------------------------------------------
# This file exposes the public /api/order/checkout endpoint.
# The frontend calls this when a user clicks "Proceed to Checkout".
#
# It consumes the current cart, calls domain/order/service.py to
# create a new order, and returns the order_id for the next payment step.

from flask import Blueprint, request, jsonify
from domain.order import service as order_service
from domain.users import service as user_service

order_bp = Blueprint("order", __name__)

@order_bp.route("/api/order/checkout", methods=["POST"])
def checkout_order():
    """
    POST /api/order/checkout
    Expected JSON body:
    {
        "cart_id": 123,
        "user_id": 45
    }

    Steps:
    1. Validate the input JSON
    2. Call order_service.convert_cart_to_order(cart_id, user_id)
    3. Return success with the new order_id and total_cents
    4. Handle any errors with consistent structured JSON responses
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    cart_id = data.get("cart_id")

    # 1️⃣ Validate input
    if not (user_id and cart_id):
        return jsonify({"error": "BadRequest", "message": "cart_id and user_id required"}), 400

    try:
        # 2️⃣ Perform checkout transition
        order = order_service.convert_cart_to_order(int(cart_id), int(user_id))

        # 3️⃣ Return structured success response
        return jsonify({
            "status": "success",
            "order": order
        }), 200

    except Exception as e:
        # 4️⃣ Safe structured failure (no stacktrace leaks)
        return jsonify({
            "error": "CheckoutFailed",
            "message": str(e)
        }), 400
