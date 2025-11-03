# domain/payments/service.py

import razorpay
import json
import hmac
import hashlib
from db import get_db_connection
from domain.payments import repository as repo
from config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET


# =============================================================
# CLIENT INIT
# =============================================================
def _razorpay_client():
    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


# =============================================================
# ORDER CREATION
# =============================================================
def create_payment_order(user_id: int, order_id: int, amount_cents: int):
    """
    Creates a Razorpay order and stores it in the payments table.
    """
    conn = get_db_connection()
    client = _razorpay_client()
    amount_paise = amount_cents  # already in paise since DB uses cents as paise

    rp_order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "payment_capture": 1
    })

    with conn:
        payment_id = repo.insert_payment(
            conn,
            order_id=order_id,
            user_id=user_id,
            provider="razorpay",
            amount_cents=amount_cents,
            currency="INR",
            razorpay_order_id=rp_order["id"]
        )

    return {
        "payment_id": payment_id,
        "razorpay_order_id": rp_order["id"],
        "razorpay_key_id": RAZORPAY_KEY_ID,
        "amount": amount_paise,
        "currency": "INR"
    }


# =============================================================
# PAYMENT VERIFICATION
# =============================================================
def verify_payment_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str):
    """
    Verify Razorpay webhook or frontend signature to ensure payment authenticity.
    """
    generated = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
        hashlib.sha256
    ).hexdigest()

    if generated != razorpay_signature:
        return False

    conn = get_db_connection()
    with conn:
        repo.update_payment_status(
            conn,
            razorpay_order_id,
            status="paid",
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature,
            raw_response=json.dumps({"verified": True})
        )
    return True


# =============================================================
# REFUND
# =============================================================
def initiate_refund(razorpay_payment_id: str, amount_cents: int):
    client = _razorpay_client()
    refund = client.payment.refund(razorpay_payment_id, {"amount": amount_cents})

    conn = get_db_connection()
    with conn:
        repo.mark_refunded(conn, razorpay_payment_id, refund_id=refund["id"], raw_response=json.dumps(refund))
    return refund


# =============================================================
# FETCH PAYMENTS
# =============================================================
def list_user_payments(user_id: int):
    conn = get_db_connection()
    with conn:
        rows = repo.get_payments_by_user(conn, user_id)
        return [
            {
                "payment_txn_id": r["payment_txn_id"],
                "order_id": r["order_id"],
                "provider": r["provider"],
                "amount": r["amount_cents"] / 100.0,
                "currency": r["currency"],
                "status": r["status"],
                "razorpay_order_id": r["razorpay_order_id"],
                "razorpay_payment_id": r["razorpay_payment_id"],
                "refund_id": r["refund_id"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
            for r in rows
        ]
