# utils/pricing.py — centralized price consistency
from datetime import datetime, timedelta

def get_current_price(conn, variant_id: int):
    """Fetch the current catalog price for a variant."""
    cur = conn.execute("SELECT price_cents FROM product_variants WHERE variant_id=?", (variant_id,))
    row = cur.fetchone()
    return int(row["price_cents"]) if row else None

def is_price_lock_valid(cart_item):
    """Check if the locked price is still valid."""
    lock = cart_item.get("locked_price_until")
    if not lock:
        return False
    try:
        lock_dt = datetime.fromisoformat(lock)
        return lock_dt > datetime.utcnow()
    except Exception:
        return False

def refresh_price_if_needed(conn, cart_item):
    """Refresh item price if lock expired or catalog decreased."""
    now = datetime.utcnow()
    new_price = get_current_price(conn, cart_item["variant_id"])
    if not new_price:
        return cart_item["price_cents"]
    if not is_price_lock_valid(cart_item) or new_price < cart_item["price_cents"]:
        # Update in DB
        conn.execute("""
            UPDATE cart_items
               SET price_cents=?, locked_price_until=datetime('now', '+24 hour'),
                   last_price_refresh=datetime('now')
             WHERE cart_item_id=?""", (new_price, cart_item["cart_item_id"]))
        return new_price
    return cart_item["price_cents"]

def compute_totals(items):
    """Compute subtotal/total with basic discount placeholder."""
    subtotal_cents = sum(i["price_cents"] * i["quantity"] for i in items)
    total_cents = subtotal_cents  # apply vouchers later
    return {"subtotal_cents": subtotal_cents, "total_cents": total_cents}
