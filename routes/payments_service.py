# routes/payments_service.py — Minimal Payment API Layer (Phase 4 starter)
# ------------------------------------------------------------------------
# This connects checkout orders to payment processing.
# In your current setup, it logs payments and updates order status.
# Later, you can integrate real gateways (Razorpay, Stripe, etc.).

import logging
from flask import Blueprint, request, jsonify
from db import get_db_connection
from datetime import datetime

payments_bp = Blueprint("payments", __name__)

# ==============================================================
# Create a Payment Record (fake gateway for now)
# ==============================================================
@payments_bp.route("/api/payment/initiate", methods=["POST"])
def initiate_payment():
    """
    Initialize payment for an order.
    Expected JSON:
      {
        "order_id": 123,
        "user_id": 45,
        "amount_cents": 25000,
        "method": "razorpay" | "stripe" | "cod"
      }

    For now, this only simulates the creation and marks payment_status='processing'.
    """
    data = request.get_json(silent=True) or {}
    order_id = data.get("order_id")
    user_id = data.get("user_id")
    amount = data.get("amount_cents")
    method = data.get("method", "manual")

    if not order_id or not user_id or not amount:
        return jsonify({"error": "BadRequest", "message": "order_id, user_id, amount_cents required"}), 400

    conn = get_db_connection()
    try:
        with conn:
            # Update order with pending payment status
            conn.execute("""
                UPDATE orders
                SET payment_status = 'processing',
                    payment_method = ?,
                    updated_at = datetime('now')
                WHERE order_id = ? AND user_id = ?
            """, (method, order_id, user_id))
            
            # Insert a fake payment record for traceability
            conn.execute("""
                INSERT INTO user_payment_methods (user_id, provider, token, last4, is_default)
                VALUES (?, ?, ?, ?, 0)
            """, (user_id, method, f"FAKE-{datetime.utcnow().timestamp()}", "0000"))
            
            conn.commit()
            logging.info(f"[Payment Initiated] order_id={order_id}, user_id={user_id}, method={method}")
        
        return jsonify({
            "status": "processing",
            "message": "Payment initiated successfully",
            "gateway": method,
            "order_id": order_id
        }), 200

    except Exception as e:
        conn.rollback()
        logging.exception("Payment initiation failed")
        return jsonify({"error": "PaymentInitError", "message": str(e)}), 500


# ==============================================================
# Confirm Payment (manual simulation)
# ==============================================================
@payments_bp.route("/api/payment/confirm", methods=["POST"])
def confirm_payment():
    """
    Confirm payment manually (simulation).
    Expected JSON:
      {
        "order_id": 123,
        "status": "paid" | "failed"
      }
    """
    data = request.get_json(silent=True) or {}
    order_id = data.get("order_id")
    status = data.get("status", "failed")

    if not order_id:
        return jsonify({"error": "BadRequest", "message": "order_id required"}), 400

    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                UPDATE orders
                SET payment_status = ?, status = ?
                WHERE order_id = ?
            """, (status, "paid" if status == "paid" else "cancelled", order_id))
            
            conn.commit()
            logging.info(f"[Payment {status.upper()}] order_id={order_id}")
        
        return jsonify({
            "status": status,
            "message": f"Payment {status} for order {order_id}"
        }), 200
    except Exception as e:
        conn.rollback()
        logging.exception("Payment confirmation failed")
        return jsonify({"error": "PaymentConfirmError", "message": str(e)}), 500
