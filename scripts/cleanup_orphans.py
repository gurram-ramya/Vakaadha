# scripts/cleanup_orphans.py
import sqlite3
from datetime import datetime

DB_PATH = "vakaadha.db"

def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Delete carts with no user, no active guest, and no items
    cur.execute("""
        DELETE FROM carts
        WHERE user_id IS NULL
          AND (guest_id IS NULL
               OR guest_id NOT IN (
                   SELECT guest_id FROM cookies_audit
                   WHERE created_at >= datetime('now','-30 days')
               ))
          AND cart_id NOT IN (
              SELECT DISTINCT cart_id FROM cart_items
          )
    """)

    # Delete wishlists with no user, no active guest, and no items
    cur.execute("""
        DELETE FROM wishlists
        WHERE user_id IS NULL
          AND (guest_id IS NULL
               OR guest_id NOT IN (
                   SELECT guest_id FROM cookies_audit
                   WHERE created_at >= datetime('now','-30 days')
               ))
          AND wishlist_id NOT IN (
              SELECT DISTINCT wishlist_id FROM wishlist_items
          )
    """)

    # Optional: delete cookie audit entries older than 90 days
    cur.execute("""
        DELETE FROM cookies_audit
        WHERE created_at < datetime('now','-90 days')
    """)

    conn.commit()
    deleted = conn.total_changes
    conn.close()
    print(f"[{datetime.now().isoformat()}] Cleanup complete. Rows deleted: {deleted}")

if __name__ == "__main__":
    run()
