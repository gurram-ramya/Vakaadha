# domain/orders/service.py
from db import get_db_connection
from sqlite3 import Row

def dict_from_row(row: Row) -> dict:
    return dict(row) if row else None

def checkout(user_id: int, address_id: int, payment_method: str):
    con = get_db_connection(); cur = con.cursor()
    try:
        cur.execute("BEGIN")

        # 1. Find active cart
        cur.execute("SELECT cart_id FROM carts WHERE user_id=? AND status='active'", [user_id])
        row = cur.fetchone()
        if not row:
            raise ValueError("empty cart")
        cart_id = row[0]

        # 2. Load items with price + stock
        cur.execute("""
          SELECT ci.variant_id, ci.quantity,
                 pv.price_cents, inv.quantity as stock,
                 p.product_id, p.name, p.image_url, pv.sku, pv.size, pv.color
          FROM cart_items ci
          JOIN product_variants pv ON pv.variant_id=ci.variant_id
          JOIN products p ON p.product_id=pv.product_id
          JOIN inventory inv ON inv.variant_id = pv.variant_id
          WHERE ci.cart_id=?
        """, [cart_id])
        items = cur.fetchall()
        if not items:
            raise ValueError("empty cart")

        # 3. Stock check
        for variant_id, qty, price, stock, *_ in items:
            if stock is None or stock < qty:
                raise RuntimeError("insufficient_stock")

        # 4. Decrement stock
        for variant_id, qty, *_ in items:
            cur.execute(
                "UPDATE inventory SET quantity = quantity - ? WHERE variant_id=? AND quantity >= ?",
                [qty, variant_id, qty]
            )
            if cur.rowcount == 0:
                raise RuntimeError("insufficient_stock")

        # 5. Compute totals
        subtotal = sum((r[1] * (r[2] or 0)) for r in items)
        shipping_cents = 0  # future: dynamic logic
        discount_cents = 0  # future: vouchers
        final_total = subtotal + shipping_cents - discount_cents

        # 6. Create order
        cur.execute("""
          INSERT INTO orders (
            user_id, status, total_cents, created_at, updated_at,
            shipping_address_id, payment_method
          )
          VALUES (?, 'placed', ?, datetime('now'), datetime('now'), ?, ?)
        """, [user_id, final_total, address_id, payment_method])
        order_id = cur.lastrowid

        # 7. Copy items → order_items
        for variant_id, qty, price, *_ in items:
            cur.execute("""
              INSERT INTO order_items (order_id, variant_id, quantity, unit_price_cents)
              VALUES (?,?,?,?)
            """, [order_id, variant_id, qty, price or 0])

        # 8. Mark cart as converted
        cur.execute("UPDATE carts SET status='converted', updated_at=datetime('now') WHERE cart_id=?", [cart_id])

        con.commit()

        # 9. Build response
        order = {
            "order_id": order_id,
            "status": "placed",
            "subtotal_cents": subtotal,
            "shipping_cents": shipping_cents,
            "discount_cents": discount_cents,
            "total_cents": final_total,
            "payment_method": payment_method,
            "items": [
                {
                    "variant_id": variant_id,
                    "quantity": qty,
                    "unit_price_cents": price,
                    "sku": sku,
                    "size": size,
                    "color": color,
                    "product_id": product_id,
                    "name": name,
                    "image_url": image_url,
                }
                for variant_id, qty, price, stock, product_id, name, image_url, sku, size, color in items
            ]
        }
        return order
    except Exception:
        con.rollback()
        raise

def list_orders(user_id: int):
    con = get_db_connection(); cur = con.cursor()
    cur.execute("""
      SELECT o.order_id, o.status, o.total_cents, o.created_at, o.payment_method
      FROM orders o
      WHERE o.user_id=?
      ORDER BY o.created_at DESC
    """, [user_id])
    rows = cur.fetchall()
    return [
        {
            "order_id": r[0],
            "status": r[1],
            "total_amount": r[2] / 100.0,
            "order_date": r[3],
            "payment_method": r[4]
        }
        for r in rows
    ]
