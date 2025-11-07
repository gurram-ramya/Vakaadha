# # domain/payments/repository.py
# import logging

# # ============================================================
# # Payments Repository — low-level DB operations
# # ============================================================

# def create_payment(conn, order_id, user_id, provider, amount_cents, method,
#                    razorpay_order_id=None, email=None, contact=None):
#     """
#     Insert a new payment transaction record into the DB.
#     Used when a Razorpay order is created or COD order initialized.
#     """
#     try:
#         cur = conn.cursor()
#         cur.execute("""
#             INSERT INTO payments (
#                 order_id, user_id, provider, razorpay_order_id,
#                 amount_cents, method, email, contact, status
#             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'created')
#         """, (order_id, user_id, provider, razorpay_order_id,
#               amount_cents, method, email, contact))
#         conn.commit()
#         payment_id = cur.lastrowid
#         logging.info(f"[payments.repo] Created payment_txn_id={payment_id} for order={order_id}")
#         return get_payment_by_id(conn, payment_id)
#     except Exception as e:
#         logging.exception("Failed to create payment record")
#         raise


# def update_payment_status(conn, razorpay_order_id, status,
#                           razorpay_payment_id=None, signature=None, raw_response=None):
#     """
#     Update payment transaction status (e.g. authorized, captured, failed).
#     """
#     try:
#         cur = conn.cursor()
#         cur.execute("""
#             UPDATE payments
#                SET status = ?, 
#                    razorpay_payment_id = COALESCE(?, razorpay_payment_id),
#                    razorpay_signature = COALESCE(?, razorpay_signature),
#                    raw_response = COALESCE(?, raw_response),
#                    updated_at = datetime('now')
#              WHERE razorpay_order_id = ?
#         """, (status, razorpay_payment_id, signature, raw_response, razorpay_order_id))
#         conn.commit()

#         if cur.rowcount == 0:
#             logging.warning(f"[payments.repo] No payment found for Razorpay order: {razorpay_order_id}")
#         else:
#             logging.info(f"[payments.repo] Updated status='{status}' for razorpay_order_id={razorpay_order_id}")

#         return get_payment_by_razorpay_order_id(conn, razorpay_order_id)
#     except Exception as e:
#         logging.exception("Failed to update payment status")
#         raise


# def get_payment_by_id(conn, payment_txn_id):
#     """Fetch a single payment transaction by its internal ID."""
#     cur = conn.cursor()
#     cur.execute("SELECT * FROM payments WHERE payment_txn_id = ?", (payment_txn_id,))
#     row = cur.fetchone()
#     return dict(row) if row else None


# def get_payment_by_order(conn, order_id):
#     """Fetch payment info linked to an order."""
#     cur = conn.cursor()
#     cur.execute("SELECT * FROM payments WHERE order_id = ?", (order_id,))
#     row = cur.fetchone()
#     return dict(row) if row else None


# def get_payment_by_razorpay_order_id(conn, razorpay_order_id):
#     """Fetch payment info using Razorpay order ID."""
#     cur = conn.cursor()
#     cur.execute("SELECT * FROM payments WHERE razorpay_order_id = ?", (razorpay_order_id,))
#     row = cur.fetchone()
#     return dict(row) if row else None


import logging

# ============================================================
# Payments Repository — low-level DB operations
# ============================================================

def create_payment(conn, order_id, user_id, provider, amount_cents, method,
                   razorpay_order_id=None, email=None, contact=None):
    """
    Insert a new payment transaction record into the DB.
    Used when a Razorpay order is created or COD order initialized.
    """
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO payments (
                order_id, user_id, provider, razorpay_order_id,
                amount_cents, method, email, contact, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'created')
        """, (
            order_id, user_id, provider, razorpay_order_id,
            amount_cents, method, email, contact
        ))
        conn.commit()

        payment_id = cur.lastrowid
        logging.info(f"[payments.repo] Created payment_txn_id={payment_id} for order={order_id}")

        return get_payment_by_id(conn, payment_id)

    except Exception as e:
        logging.exception("Failed to create payment record")
        raise


# ============================================================
# UPDATE PAYMENT STATUS (by Razorpay order ID)
# ============================================================

def update_payment_status(conn, razorpay_order_id, status,
                          razorpay_payment_id=None, signature=None, raw_response=None):
    """
    Update payment transaction using Razorpay order ID.
    Used during online payment flow only.
    """
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE payments
               SET status = ?, 
                   razorpay_payment_id = COALESCE(?, razorpay_payment_id),
                   razorpay_signature = COALESCE(?, razorpay_signature),
                   raw_response = COALESCE(?, raw_response),
                   updated_at = datetime('now')
             WHERE razorpay_order_id = ?
        """, (
            status,
            razorpay_payment_id,
            signature,
            raw_response,
            razorpay_order_id,
        ))
        conn.commit()

        if cur.rowcount == 0:
            logging.warning(f"[payments.repo] No payment found for Razorpay order: {razorpay_order_id}")
        else:
            logging.info(f"[payments.repo] Updated status='{status}' for razorpay_order_id={razorpay_order_id}")

        return get_payment_by_razorpay_order_id(conn, razorpay_order_id)

    except Exception as e:
        logging.exception("Failed to update payment status (razorpay)")
        raise


# ============================================================
# UPDATE PAYMENT STATUS (by internal order_id)
# ============================================================

def update_payment_status_by_order(conn, order_id, status):
    """
    Update payment status using internal ecommerce order_id.
    Required for:
    - COD flows
    - Failed signature flows
    - User cancelled flows
    - Abandoned checkout cleanup
    """
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE payments
               SET status = ?,
                   updated_at = datetime('now')
             WHERE order_id = ?
        """, (status, order_id))
        conn.commit()

        if cur.rowcount == 0:
            logging.warning(f"[payments.repo] No payment found for order_id={order_id}")
        else:
            logging.info(f"[payments.repo] Updated status='{status}' for order_id={order_id}")

        return get_payment_by_order(conn, order_id)

    except Exception as e:
        logging.exception("Failed to update payment status (order_id)")
        raise


# ============================================================
# DELETE PAYMENT (abandoned checkout)
# ============================================================

def delete_payment_by_order(conn, order_id):
    """
    Hard-delete a payment record.
    Used only when user cancels checkout BEFORE attempting payment.
    """
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM payments WHERE order_id = ?", (order_id,))
        conn.commit()

        logging.info(f"[payments.repo] Deleted payment record for abandoned order {order_id}")

    except Exception as e:
        logging.exception("Failed to delete payment record for abandoned checkout")
        raise


# ============================================================
# FETCHERS
# ============================================================

def get_payment_by_id(conn, payment_txn_id):
    cur = conn.cursor()
    cur.execute("SELECT * FROM payments WHERE payment_txn_id = ?", (payment_txn_id,))
    row = cur.fetchone()
    return dict(row) if row else None


def get_payment_by_order(conn, order_id):
    cur = conn.cursor()
    cur.execute("SELECT * FROM payments WHERE order_id = ?", (order_id,))
    row = cur.fetchone()
    return dict(row) if row else None


def get_payment_by_razorpay_order_id(conn, razorpay_order_id):
    cur = conn.cursor()
    cur.execute("SELECT * FROM payments WHERE razorpay_order_id = ?", (razorpay_order_id,))
    row = cur.fetchone()
    return dict(row) if row else None


def get_payment_by_razorpay_payment_id(conn, razorpay_payment_id):
    """
    Optional helper — useful for refunds or dispute handling.
    """
    cur = conn.cursor()
    cur.execute("SELECT * FROM payments WHERE razorpay_payment_id = ?", (razorpay_payment_id,))
    row = cur.fetchone()
    return dict(row) if row else None
