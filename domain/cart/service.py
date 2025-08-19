# Minimal Code for the place holder

from db import get_db_connection

def get_active_cart(user_id: int):
    con = get_db_connection(); cur = con.cursor()
    cur.execute("SELECT cart_id FROM carts WHERE user_id=? AND status='active'", [user_id])
    row = cur.fetchone()
    if row: cart_id = row[0]
    else:
        cur.execute("INSERT INTO carts (user_id, status, created_at, updated_at) VALUES (?, 'active', datetime('now'), datetime('now'))", [user_id])
        cart_id = cur.lastrowid
        con.commit()
    return cart_id

def list_cart_items(user_id: int):
    con = get_db_connection(); cur = con.cursor()
    cart_id = get_active_cart(user_id)
    cur.execute("""
      SELECT ci.cart_item_id, ci.quantity, v.variant_id, p.name, v.sku, COALESCE(v.price_override, p.price_cents)
      FROM cart_items ci
      JOIN product_variants v ON v.variant_id = ci.variant_id
      JOIN products p ON p.product_id = v.product_id
      WHERE ci.cart_id = ?
    """, [cart_id])
    items = [{
        "cartItemId": r[0], "quantity": r[1], "variantId": r[2],
        "name": r[3], "sku": r[4], "unitPriceCents": r[5]
    } for r in cur.fetchall()]
    total = sum(i["quantity"] * (i["unitPriceCents"] or 0) for i in items)
    return {"cartId": cart_id, "items": items, "totalCents": total}

def add_item(user_id: int, variant_id: int, qty: int):
    if qty <= 0: raise ValueError("qty must be > 0")
    con = get_db_connection(); cur = con.cursor()
    cart_id = get_active_cart(user_id)
    # upsert
    cur.execute("SELECT cart_item_id, quantity FROM cart_items WHERE cart_id=? AND variant_id=?", [cart_id, variant_id])
    row = cur.fetchone()
    if row:
        new_q = row[1] + qty
        cur.execute("UPDATE cart_items SET quantity=?, updated_at=datetime('now') WHERE cart_item_id=?", [new_q, row[0]])
    else:
        cur.execute("INSERT INTO cart_items (cart_id, variant_id, quantity, created_at, updated_at) VALUES (?,?,?, datetime('now'), datetime('now'))", [cart_id, variant_id, qty])
    con.commit()
    return list_cart_items(user_id)
