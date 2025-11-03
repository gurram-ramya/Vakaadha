# domain/orders/service.py — Order Business Logic Layer

import uuid
from datetime import datetime
from db import get_db_connection
from domain.orders import repository as repo
from domain.cart import repository as cart_repo


# =============================================================
# ORDER CREATION
# =============================================================
def create_order_from_cart(user_id: int, cart_id: int, address_id: int, payment_method: str):
    conn = get_db_connection()
    with conn:
        # Fetch cart items and totals
        cart_items = cart_repo.get_cart_items(conn, cart_id)
        totals = cart_repo.compute_cart_totals(conn, cart_id)

        if not cart_items:
            raise ValueError("Cart is empty")

        subtotal_cents = totals["subtotal_cents"]
        shipping_cents = 0  # Placeholder; integrate shipping rules later
        discount_cents = 0
        total_cents = subtotal_cents + shipping_cents - discount_cents

        order_no = f"ORD-{uuid.uuid4().hex[:10].upper()}"

        order_id = repo.insert_order(
            conn,
            user_id=user_id,
            source_cart_id=cart_id,
            order_no=order_no,
            payment_method=payment_method,
            subtotal_cents=subtotal_cents,
            shipping_cents=shipping_cents,
            discount_cents=discount_cents,
            total_cents=total_cents,
            address_id=address_id,
        )

        for item in cart_items:
            repo.insert_order_item(
                conn,
                order_id=order_id,
                product_id=item["product_id"],
                variant_id=item["variant_id"],
                quantity=item["quantity"],
                price_cents=item["price_cents"],
            )

        cart_repo.mark_cart_converted(conn, cart_id)

        return {
            "order_id": order_id,
            "order_no": order_no,
            "user_id": user_id,
            "total_cents": total_cents,
            "payment_method": payment_method,
            "status": "pending",
        }


# =============================================================
# ORDER RETRIEVAL
# =============================================================
def list_user_orders(user_id: int):
    conn = get_db_connection()
    with conn:
        rows = repo.get_orders_by_user(conn, user_id)
        return [dict(r) for r in rows]


def get_order_details(order_id: int):
    conn = get_db_connection()
    with conn:
        data = repo.get_order_details(conn, order_id)
        if not data:
            return None

        order = dict(data["order"])
        items = [dict(i) for i in data["items"]]

        order["items"] = items
        return order


# =============================================================
# STATUS UPDATES
# =============================================================
def update_order_status(order_id: int, status: str):
    conn = get_db_connection()
    with conn:
        repo.update_order_status(conn, order_id, status)


def update_payment_status(order_id: int, payment_status: str):
    conn = get_db_connection()
    with conn:
        repo.update_payment_status(conn, order_id, payment_status)
