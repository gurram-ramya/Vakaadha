#Minimal code for the place holder

from db import get_db_connection

def place_order(user_id: int):
    con = get_db_connection(); cur = con.cursor()
    try:
        cur.execute("BEGIN")
        # find cart
        cur.execute("SELECT cart_id FROM carts WHERE user_id=? AND status='active'", [user_id])
        row = cur.fetchone()
        if not row: raise ValueError("empty cart")
        cart_id = row[0]

        # load items with current prices and inventory
        cur.execute("""
          SELECT ci.variant_id, ci.quantity, COALESCE(v.price_override, p.price_cents) as price, inv.quantity as stock
          FROM cart_items ci
          JOIN product_variants v ON v.variant_id=ci.variant_id
          JOIN products p ON p.product_id=v.product_id
          JOIN inventory inv ON inv.variant_id = v.variant_id
          WHERE ci.cart_id=?
        """, [cart_id])
        rows = cur.fetchall()
        if not rows: raise ValueError("empty cart")

        # stock check
        for variant_id, qty, price, stock in rows:
            if stock is None or stock < qty:
                raise RuntimeError("insufficient_stock")

        # decrement stock
        for variant_id, qty, price, stock in rows:
            cur.execute("UPDATE inventory SET quantity = quantity - ? WHERE variant_id=? AND quantity >= ?", [qty, variant_id, qty])
            if cur.rowcount == 0:
                raise RuntimeError("insufficient_stock")

        # create order + items
        total = sum((r[1] * (r[2] or 0)) for r in rows)
        cur.execute("INSERT INTO orders (user_id, status, total_cents, created_at, updated_at) VALUES (?, 'placed', ?, datetime('now'), datetime('now'))", [user_id, total])
        order_id = cur.lastrowid
        for variant_id, qty, price, stock in rows:
            cur.execute("""
              INSERT INTO order_items (order_id, variant_id, quantity, unit_price_cents)
              VALUES (?,?,?,?)
            """, [order_id, variant_id, qty, price or 0])

        # convert cart
        cur.execute("UPDATE carts SET status='converted', updated_at=datetime('now') WHERE cart_id=?", [cart_id])

        con.commit()
        return {"orderId": order_id, "status": "placed", "totalCents": total}
    except Exception:
        con.rollback()
        raise
