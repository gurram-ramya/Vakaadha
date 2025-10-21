# domain/order/service.py — checkout transition (Phase 3)
# --------------------------------------------------------
# This module performs the critical Cart → Order transition.
# It validates pricing, refreshes stock/price snapshots, and
# creates immutable order records while marking the original cart
# as 'converted' for audit traceability.

import logging
from datetime import datetime
from db import get_db_connection
from utils import pricing
from domain.cart import service as cart_service


def convert_cart_to_order(cart_id: int, user_id: int):
    """
    Convert an active cart into an order atomically.

    Steps:
    1. Fetch full cart contents using cart_service.fetch_cart()
    2. Validate the cart isn't empty
    3. Refresh and lock prices (via utils.pricing.refresh_price_if_needed)
    4. Compute subtotal & total (via utils.pricing.compute_totals)
    5. Insert order header (orders table)
    6. Clone each cart item into order_items
    7. Mark original cart status='converted'
    8. Commit the transaction and return the new order_id
    """
    conn = get_db_connection()
    with conn:
        # 1️⃣ Fetch active cart
        cart = cart_service.fetch_cart(cart_id)
        items = cart["items"]
        if not items:
            raise ValueError("Cart is empty — cannot create order")

        # 2️⃣ Refresh or validate price lock for every item
        for item in items:
            # Refresh if expired or catalog price decreased
            item["price_cents"] = pricing.refresh_price_if_needed(conn, item)

        # 3️⃣ Compute totals for checkout display
        totals = pricing.compute_totals(items)
        subtotal = totals["subtotal_cents"]
        total = totals["total_cents"]

        # 4️⃣ Insert order header
        cur = conn.execute("""
            INSERT INTO orders (user_id, source_cart_id, status, subtotal_cents, total_cents, created_at)
            VALUES (?, ?, 'pending', ?, ?, datetime('now'))
        """, (user_id, cart_id, subtotal, total))


        order_id = cur.lastrowid

        # 5️⃣ Clone cart items → order_items table
        for item in items:
            conn.execute("""
                INSERT INTO order_items (order_id, product_id, variant_id, quantity, price_cents)
                VALUES (?, ?, ?, ?, ?)
            """, (order_id, item["product_id"], item["variant_id"], item["quantity"], item["price_cents"]))

        # 6️⃣ Mark cart as 'converted' (so it can’t be reused)
        cart_service.convert_cart_to_order(cart_id)

        # 7️⃣ Finalize transaction
        conn.commit()
        logging.info(f"[Order Created] cart={cart_id} → order={order_id}")

        # 8️⃣ Return minimal data for frontend redirect
        return {"order_id": order_id, "total_cents": total}

# temporary safe

def reduce_inventory(conn, order_id):
    conn.execute("""
        UPDATE inventory
        SET quantity = quantity - (
            SELECT quantity FROM order_items WHERE order_items.variant_id = inventory.variant_id AND order_items.order_id = ?
        )
        WHERE variant_id IN (SELECT variant_id FROM order_items WHERE order_id = ?)
    """, (order_id, order_id))
