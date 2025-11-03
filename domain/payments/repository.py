# domain/payments/repository.py

import sqlite3
from typing import Optional, Dict, Any
from db import get_db_connection


# =============================================================
# INSERT / UPDATE
# =============================================================
def insert_payment(conn, order_id: int, user_id: int, provider: str, amount_cents: int,
                   currency: str = "INR", razorpay_order_id: Optional[str] = None):
    cur = conn.execute(
        """
        INSERT INTO payments (
            order_id, user_id, provider, amount_cents, currency,
            razorpay_order_id, status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'created', datetime('now'), datetime('now'));
        """,
        (order_id, user_id, provider, amount_cents, currency, razorpay_order_id),
    )
    return cur.lastrowid


def update_payment_status(conn, razorpay_order_id: str, status: str,
                          razorpay_payment_id: Optional[str] = None,
                          razorpay_signature: Optional[str] = None,
                          raw_response: Optional[str] = None):
    conn.execute(
        """
        UPDATE payments
        SET status = ?, razorpay_payment_id = ?, razorpay_signature = ?,
            raw_response = ?, updated_at = datetime('now')
        WHERE razorpay_order_id = ?;
        """,
        (status, razorpay_payment_id, razorpay_signature, raw_response, razorpay_order_id),
    )


def mark_refunded(conn, razorpay_payment_id: str, refund_id: str, raw_response: Optional[str] = None):
    conn.execute(
        """
        UPDATE payments
        SET status = 'refunded', refund_id = ?, raw_response = ?, updated_at = datetime('now')
        WHERE razorpay_payment_id = ?;
        """,
        (refund_id, raw_response, razorpay_payment_id),
    )


# =============================================================
# FETCH
# =============================================================
def get_payment_by_order_id(conn, order_id: int) -> Optional[Dict[str, Any]]:
    cur = conn.execute("SELECT * FROM payments WHERE order_id = ?;", (order_id,))
    return cur.fetchone()


def get_payment_by_razorpay_order_id(conn, razorpay_order_id: str) -> Optional[Dict[str, Any]]:
    cur = conn.execute("SELECT * FROM payments WHERE razorpay_order_id = ?;", (razorpay_order_id,))
    return cur.fetchone()


def get_payments_by_user(conn, user_id: int):
    cur = conn.execute(
        """
        SELECT payment_txn_id, order_id, provider, amount_cents, currency,
               status, razorpay_order_id, razorpay_payment_id, refund_id,
               created_at, updated_at
        FROM payments
        WHERE user_id = ?
        ORDER BY created_at DESC;
        """,
        (user_id,),
    )
    return cur.fetchall()
