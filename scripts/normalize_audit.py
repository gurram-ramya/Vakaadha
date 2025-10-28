# scripts/normalize_audit.py
import sqlite3
from datetime import datetime

DB_PATH = "vakaadha.db"

def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Normalize cart_audit_log guest rows → assign user_id from carts
    cur.execute("""
        UPDATE cart_audit_log
        SET user_id = (
            SELECT c.user_id FROM carts c WHERE c.cart_id = cart_audit_log.cart_id
        ),
            guest_id = NULL,
            note = COALESCE(note, 'guest reassigned')
        WHERE user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM carts c
            WHERE c.cart_id = cart_audit_log.cart_id
              AND c.user_id IS NOT NULL
          )
    """)

    # Normalize wishlist_audit guest rows → assign user_id from wishlists
    cur.execute("""
        UPDATE wishlist_audit
        SET user_id = (
            SELECT w.user_id FROM wishlists w WHERE w.wishlist_id = wishlist_audit.wishlist_id
        ),
            guest_id = NULL,
            note = COALESCE(note, 'guest reassigned')
        WHERE user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM wishlists w
            WHERE w.wishlist_id = wishlist_audit.wishlist_id
              AND w.user_id IS NOT NULL
          )
    """)

    conn.commit()
    changed = conn.total_changes
    conn.close()
    print(f"[{datetime.now().isoformat()}] Audit normalization complete. Rows updated: {changed}")

if __name__ == "__main__":
    run()
