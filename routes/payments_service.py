# # routes/payments_service.py

# from flask import Blueprint, request, jsonify
# from domain.payments import service as payment_service

# payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")


# # =============================================================
# # CREATE PAYMENT ORDER
# # =============================================================
# @payments_bp.route("/create", methods=["POST"])
# def create_payment():
#     data = request.get_json(force=True)
#     user_id = data.get("user_id")
#     order_id = data.get("order_id")
#     amount_cents = data.get("amount_cents")

#     if not all([user_id, order_id, amount_cents]):
#         return jsonify({"error": "Missing required fields"}), 400

#     try:
#         result = payment_service.create_payment_order(user_id, order_id, amount_cents)
#         return jsonify(result)
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500

# # =============================================================
# # VERIFY PAYMENT
# # =============================================================
# @payments_bp.route("/verify", methods=["POST"])
# def verify_payment():
#     data = request.get_json(force=True)
#     razorpay_order_id = data.get("razorpay_order_id")
#     razorpay_payment_id = data.get("razorpay_payment_id")
#     razorpay_signature = data.get("razorpay_signature")

#     if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
#         return jsonify({"error": "Missing verification data"}), 400

#     verified, order_id = payment_service.verify_payment_signature(
#         razorpay_order_id, razorpay_payment_id, razorpay_signature
#     )

#     if not verified:
#         return jsonify({"status": "failed", "reason": "invalid signature"}), 400

#     from domain.orders.service import update_payment_status
#     update_payment_status(order_id, "paid")

#     return jsonify({"status": "success", "order_id": order_id})


# # =============================================================
# # INITIATE REFUND
# # =============================================================
# @payments_bp.route("/refund", methods=["POST"])
# def refund_payment():
#     data = request.get_json(force=True)
#     razorpay_payment_id = data.get("razorpay_payment_id")
#     amount_cents = data.get("amount_cents")

#     if not all([razorpay_payment_id, amount_cents]):
#         return jsonify({"error": "Missing refund parameters"}), 400

#     try:
#         result = payment_service.initiate_refund(razorpay_payment_id, amount_cents)
#         return jsonify(result)
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500


# # =============================================================
# # USER PAYMENT HISTORY
# # =============================================================
# @payments_bp.route("/user/<int:user_id>", methods=["GET"])
# def list_user_payments(user_id):
#     try:
#         result = payment_service.list_user_payments(user_id)
#         return jsonify(result)
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500


# routes/payments_service.py
import logging
from flask import Blueprint, request, jsonify, g
from utils.auth import require_auth
from db import get_db_connection
from domain.payments import service as payment_service

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")


# ============================================================
# POST /api/payments/create-order
# ============================================================
@payments_bp.post("/create-order")
@require_auth(optional=False)
def create_order():
    """
    Create a Razorpay order or initialize a COD payment.
    Expected JSON:
    {
        "address_id": 12,
        "payment_method": "UPI" | "COD" | "Card" | "NetBanking"
    }
    """
    try:
        user = g.user
        if not user:
            return jsonify({"error": "unauthorized", "message": "Login required"}), 401

        data = request.get_json(silent=True) or {}
        address_id = data.get("address_id")
        payment_method = (data.get("payment_method") or "UPI").upper()

        if not address_id:
            return jsonify({"error": "validation_failed", "message": "Missing address_id"}), 400

        logging.info(f"[payments.route] Creating payment for user={user['user_id']} method={payment_method}")
        payment_info = payment_service.create_payment_order(
            user_id=user["user_id"],
            address_id=address_id,
            payment_method=payment_method,
        )
        return jsonify(payment_info), 200

    except Exception as e:
        logging.exception("Error creating payment order")
        return jsonify({"error": "server_error", "message": str(e)}), 500


# ============================================================
# POST /api/payments/verify
# ============================================================
@payments_bp.post("/verify")
@require_auth(optional=True)
def verify_payment():
    """
    Verify Razorpay payment after success on frontend.
    Expected JSON:
    {
        "razorpay_order_id": "...",
        "razorpay_payment_id": "...",
        "razorpay_signature": "..."
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        razorpay_order_id = data.get("razorpay_order_id")
        razorpay_payment_id = data.get("razorpay_payment_id")
        razorpay_signature = data.get("razorpay_signature")

        if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
            return jsonify({"error": "validation_failed", "message": "Missing Razorpay parameters"}), 400

        result = payment_service.verify_payment(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        )
        return jsonify(result), 200

    except Exception as e:
        logging.exception("Error verifying payment")
        return jsonify({"error": "server_error", "message": str(e)}), 500
