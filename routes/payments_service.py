# # routes/payments_service.py
# import logging
# from flask import Blueprint, request, jsonify, g
# from utils.auth import require_auth
# from db import get_db_connection
# from domain.payments import service as payment_service

# payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")


# # ============================================================
# # POST /api/payments/create-order
# # ============================================================
# @payments_bp.post("/create-order")
# @require_auth(optional=False)
# def create_order():
#     """
#     Create a Razorpay order or initialize a COD payment.
#     Expected JSON:
#     {
#         "address_id": 12,
#         "payment_method": "UPI" | "COD" | "Card" | "NetBanking"
#     }
#     """
#     try:
#         user = g.user
#         if not user:
#             return jsonify({"error": "unauthorized", "message": "Login required"}), 401

#         data = request.get_json(silent=True) or {}
#         address_id = data.get("address_id")
#         payment_method = (data.get("payment_method") or "UPI").upper()

#         if not address_id:
#             return jsonify({"error": "validation_failed", "message": "Missing address_id"}), 400

#         logging.info(f"[payments.route] Creating payment for user={user['user_id']} method={payment_method}")
#         payment_info = payment_service.create_payment_order(
#             user_id=user["user_id"],
#             address_id=address_id,
#             payment_method=payment_method,
#         )
#         return jsonify(payment_info), 200

#     except Exception as e:
#         logging.exception("Error creating payment order")
#         return jsonify({"error": "server_error", "message": str(e)}), 500


# # ============================================================
# # POST /api/payments/verify
# # ============================================================
# @payments_bp.post("/verify")
# @require_auth(optional=True)
# def verify_payment():
#     """
#     Verify Razorpay payment after success on frontend.
#     Expected JSON:
#     {
#         "razorpay_order_id": "...",
#         "razorpay_payment_id": "...",
#         "razorpay_signature": "..."
#     }
#     """
#     try:
#         data = request.get_json(silent=True) or {}
#         razorpay_order_id = data.get("razorpay_order_id")
#         razorpay_payment_id = data.get("razorpay_payment_id")
#         razorpay_signature = data.get("razorpay_signature")

#         if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
#             return jsonify({"error": "validation_failed", "message": "Missing Razorpay parameters"}), 400

#         result = payment_service.verify_payment(
#             razorpay_order_id,
#             razorpay_payment_id,
#             razorpay_signature
#         )
#         return jsonify(result), 200

#     except Exception as e:
#         logging.exception("Error verifying payment")
#         return jsonify({"error": "server_error", "message": str(e)}), 500


import logging
from flask import Blueprint, request, jsonify, g
from utils.auth import require_auth
from domain.payments import service as payment_service
from domain.orders import service as orders_service

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

        logging.info(
            f"[payments.route] Creating payment for user={user['user_id']} method={payment_method}"
        )

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
    Verify Razorpay payment after frontend callback.
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
            return jsonify({
                "error": "validation_failed",
                "message": "Missing Razorpay parameters"
            }), 400

        result = payment_service.verify_payment(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        )

        return jsonify(result), 200

    except Exception as e:
        logging.exception("Error verifying payment")
        return jsonify({
            "error": "server_error",
            "message": str(e)
        }), 500


# ============================================================
# POST /api/payments/abandon
# FOR CASE 3 — Abandoned checkout BEFORE payment attempted
# ============================================================
@payments_bp.post("/abandon")
@require_auth(optional=False)
def abandon_payment():
    """
    Frontend calls this when user closes/cancels checkout BEFORE making payment.
    Expected JSON:
    {
        "order_id": 123
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        order_id = data.get("order_id")

        if not order_id:
            return jsonify({
                "error": "validation_failed",
                "message": "order_id missing"
            }), 400

        # Delete payment record
        payment_service.delete_payment_for_order(order_id)

        # Delete order as well
        orders_service.delete_order(order_id)

        logging.info(f"[payments.route] Abandoned checkout cleanup for order_id={order_id}")

        return jsonify({"status": "deleted", "order_id": order_id}), 200

    except Exception as e:
        logging.exception("Error abandoning payment/order")
        return jsonify({"error": "server_error", "message": str(e)}), 500


# ============================================================
# POST /api/payments/cancel
# FOR CASE 4 — User cancels after payment failure or retry
# ============================================================
@payments_bp.post("/cancel")
@require_auth(optional=False)
def cancel_payment():
    """
    Frontend calls this when user chooses to CANCEL checkout
    AFTER a failed payment or after returning to payment page.
    Expected JSON:
    {
        "order_id": 123
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        order_id = data.get("order_id")

        if not order_id:
            return jsonify({
                "error": "validation_failed",
                "message": "order_id missing"
            }), 400

        success = payment_service.cancel_payment(order_id)

        if not success:
            return jsonify({
                "error": "update_failed",
                "message": "Could not cancel payment"
            }), 500

        logging.info(f"[payments.route] Cancelled payment/order order_id={order_id}")

        return jsonify({
            "status": "cancelled",
            "order_id": order_id
        }), 200

    except Exception as e:
        logging.exception("Error cancelling payment/order")
        return jsonify({"error": "server_error", "message": str(e)}), 500
