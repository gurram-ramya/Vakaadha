# domain/users/payments_service.py
from db import query_all, query_one, execute

# ==============================================================
# USER PAYMENT METHODS SERVICE
# ==============================================================

def list_payment_methods(user_id):
    rows = query_all("""
        SELECT payment_id, provider, token, last4, expiry, is_default
        FROM user_payment_methods
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, (user_id,))
    return [dict(r) for r in rows]

def add_payment_method(user_id, provider, token, last4=None, expiry=None, is_default=False):
    execute("""
        INSERT INTO user_payment_methods (user_id, provider, token, last4, expiry, is_default, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    """, (user_id, provider, token, last4, expiry, int(is_default)))

def delete_payment_method(user_id, payment_id):
    execute("DELETE FROM user_payment_methods WHERE user_id = ? AND payment_id = ?", (user_id, payment_id))
