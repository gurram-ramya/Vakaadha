# routes/payments_service.py

from flask import Blueprint, request, jsonify
from domain.payments import service as payment_service

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")


# =============================================================
# CREATE PAYMENT ORDER
# =============================================================
@payments_bp.route("/create", methods=["POST"])
def create_payment():
    data = request.get_json(force=True)
    user_id = data.get("user_id")
    order_id = data.get("order_id")
    amount_cents = data.get("amount_cents")

    if not all([user_id, order_id, amount_cents]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        result = payment_service.create_payment_order(user_id, order_id, amount_cents)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================================
# VERIFY PAYMENT
# =============================================================
@payments_bp.route("/verify", methods=["POST"])
def verify_payment():
    data = request.get_json(force=True)
    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_signature = data.get("razorpay_signature")

    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        return jsonify({"error": "Missing verification data"}), 400

    verified = payment_service.verify_payment_signature(
        razorpay_order_id, razorpay_payment_id, razorpay_signature
    )
    if not verified:
        return jsonify({"status": "failed", "reason": "invalid signature"}), 400
    return jsonify({"status": "success"})


# =============================================================
# INITIATE REFUND
# =============================================================
@payments_bp.route("/refund", methods=["POST"])
def refund_payment():
    data = request.get_json(force=True)
    razorpay_payment_id = data.get("razorpay_payment_id")
    amount_cents = data.get("amount_cents")

    if not all([razorpay_payment_id, amount_cents]):
        return jsonify({"error": "Missing refund parameters"}), 400

    try:
        result = payment_service.initiate_refund(razorpay_payment_id, amount_cents)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =============================================================
# USER PAYMENT HISTORY
# =============================================================
@payments_bp.route("/user/<int:user_id>", methods=["GET"])
def list_user_payments(user_id):
    try:
        result = payment_service.list_user_payments(user_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
