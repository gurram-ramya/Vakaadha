# domain/cart/service.py
import sqlite3
from typing import Optional, List, Dict, Any
from db import get_db_connection


def get_or_create_cart(user_id: Optional[int] = None, guest_id: Optional[str] = None) -> int:
    """
    Ensure there is an active cart for user or guest. Return cart_id.
    Preference: user_id > guest_id
    """
    if not user_id and not guest_id:
        raise ValueError("Either user_id or guest_id must be provided")

    con = get_db_connection()
    cur = con.cursor()

    if user_id:
        cur.execute("""
            SELECT cart_id FROM carts
            WHERE status = 'active' AND user_id = ?
            LIMIT 1
        """, (user_id,))
        row = cur.fetchone()
        if row:
            return row["cart_id"]
        cur.execute("INSERT INTO carts (user_id) VALUES (?)", (user_id,))
        cart_id = cur.lastrowid
        con.commit()
        return cart_id

    if guest_id:
        cur.execute("""
            SELECT cart_id FROM carts
            WHERE status = 'active' AND guest_id = ?
            LIMIT 1
        """, (guest_id,))
        row = cur.fetchone()
        if row:
            return row["cart_id"]
        cur.execute("INSERT INTO carts (guest_id) VALUES (?)", (guest_id,))
        cart_id = cur.lastrowid
        con.commit()
        return cart_id


def hydrate_cart_items(cart_id: int) -> List[Dict[str, Any]]:
    """
    Return cart items with hydrated product + variant metadata.
    """
    con = get_db_connection()
    cur = con.cursor()

    cur.execute("""
        SELECT
            ci.cart_item_id,
            ci.variant_id,
            ci.quantity,
            ci.price_cents,
            v.size,
            v.color,
            v.sku,
            v.price_cents AS variant_price,
            p.name AS product_name,
            img.image_url,
            inv.quantity AS stock
        FROM cart_items ci
        JOIN product_variants v ON ci.variant_id = v.variant_id
        JOIN products p ON v.product_id = p.product_id
        LEFT JOIN product_images img ON img.product_id = p.product_id
        LEFT JOIN inventory inv ON v.variant_id = inv.variant_id
        WHERE ci.cart_id = ?
        GROUP BY ci.cart_item_id
    """, (cart_id,))
    rows = cur.fetchall()

    items = []
    for r in rows:
        price = r["price_cents"] / 100.0
        subtotal = (r["price_cents"] * r["quantity"]) / 100.0
        items.append({
            "cart_item_id": r["cart_item_id"],
            "variant_id": r["variant_id"],
            "product_name": r["product_name"],
            "variant": {
                "size": r["size"],
                "color": r["color"],
                "sku": r["sku"],
            },
            "image_url": r["image_url"],
            "price": price,
            "quantity": r["quantity"],
            "subtotal": subtotal,
            "stock": r["stock"] if r["stock"] is not None else 0
        })
    return items


def get_cart(user_id: Optional[int] = None, guest_id: Optional[str] = None) -> Dict[str, Any]:
    if user_id:
        cart_id = get_or_create_cart(user_id=user_id)
    else:
        cart_id = get_or_create_cart(guest_id=guest_id)
    items = hydrate_cart_items(cart_id)
    return {"cart_id": cart_id, "items": items}


def add_cart_item(user_id: Optional[int], guest_id: Optional[str],
                  variant_id: int, quantity: int) -> Dict[str, Any]:
    if quantity <= 0:
        raise ValueError("Quantity must be > 0")

    con = get_db_connection()
    cur = con.cursor()

    # Check variant existence and stock
    cur.execute("SELECT price_cents FROM product_variants WHERE variant_id=?", (variant_id,))
    pv = cur.fetchone()
    if not pv:
        raise ValueError("Variant not found")

    cur.execute("SELECT quantity FROM inventory WHERE variant_id=?", (variant_id,))
    stock_row = cur.fetchone()
    stock = stock_row["quantity"] if stock_row else 0
    if quantity > stock:
        raise ValueError("Quantity exceeds available stock")

    if user_id:
        cart_id = get_or_create_cart(user_id=user_id)
    else:
        cart_id = get_or_create_cart(guest_id=guest_id)

    # If already exists, update quantity
    cur.execute("SELECT cart_item_id, quantity FROM cart_items WHERE cart_id=? AND variant_id=?",
                (cart_id, variant_id))
    row = cur.fetchone()
    if row:
        new_qty = row["quantity"] + quantity
        if new_qty > stock:
            raise ValueError("Quantity exceeds available stock")
        cur.execute("UPDATE cart_items SET quantity=? WHERE cart_item_id=?",
                    (new_qty, row["cart_item_id"]))
    else:
        price_cents = pv["price_cents"]
        cur.execute("""
            INSERT INTO cart_items (cart_id, variant_id, quantity, price_cents)
            VALUES (?, ?, ?, ?)
        """, (cart_id, variant_id, quantity, price_cents))

    con.commit()
    return get_cart(user_id, guest_id)


def update_cart_item(user_id: Optional[int], guest_id: Optional[str],
                     cart_item_id: int, quantity: int) -> Dict[str, Any]:
    if quantity <= 0:
        raise ValueError("Quantity must be > 0")

    con = get_db_connection()
    cur = con.cursor()

    cur.execute("""
        SELECT ci.variant_id, c.user_id, c.guest_id
        FROM cart_items ci
        JOIN carts c ON ci.cart_id = c.cart_id
        WHERE ci.cart_item_id = ?
    """, (cart_item_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError("Cart item not found")

    if user_id and row["user_id"] != user_id:
        raise ValueError("Unauthorized cart item")
    if guest_id and row["guest_id"] != guest_id:
        raise ValueError("Unauthorized cart item")

    variant_id = row["variant_id"]
    cur.execute("SELECT quantity FROM inventory WHERE variant_id=?", (variant_id,))
    stock_row = cur.fetchone()
    stock = stock_row["quantity"] if stock_row else 0
    if quantity > stock:
        raise ValueError("Quantity exceeds available stock")

    cur.execute("UPDATE cart_items SET quantity=? WHERE cart_item_id=?",
                (quantity, cart_item_id))
    con.commit()

    if user_id:
        return get_cart(user_id=user_id)
    else:
        return get_cart(guest_id=guest_id)


def remove_cart_item(user_id: Optional[int], guest_id: Optional[str],
                     cart_item_id: int) -> Dict[str, Any]:
    con = get_db_connection()
    cur = con.cursor()

    cur.execute("""
        SELECT c.user_id, c.guest_id
        FROM cart_items ci
        JOIN carts c ON ci.cart_id = c.cart_id
        WHERE ci.cart_item_id = ?
    """, (cart_item_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError("Cart item not found")

    if user_id and row["user_id"] != user_id:
        raise ValueError("Unauthorized cart item")
    if guest_id and row["guest_id"] != guest_id:
        raise ValueError("Unauthorized cart item")

    cur.execute("DELETE FROM cart_items WHERE cart_item_id=?", (cart_item_id,))
    con.commit()

    if user_id:
        return get_cart(user_id=user_id)
    else:
        return get_cart(guest_id=guest_id)


def merge_guest_cart(guest_id: str, user_id: int):
    """
    On login: merge guest cart into user cart with stock validation.
    """
    con = get_db_connection()
    cur = con.cursor()

    # Find guest cart
    cur.execute("SELECT cart_id FROM carts WHERE guest_id=? AND status='active'", (guest_id,))
    g = cur.fetchone()
    if not g:
        return
    guest_cart_id = g["cart_id"]

    # Ensure user cart exists
    user_cart_id = get_or_create_cart(user_id=user_id)

    # Pull guest items
    cur.execute("SELECT variant_id, quantity, price_cents FROM cart_items WHERE cart_id=?", (guest_cart_id,))
    guest_items = cur.fetchall()

    for gi in guest_items:
        variant_id = gi["variant_id"]
        qty_to_add = gi["quantity"]
        price_cents = gi["price_cents"]

        # Get available stock
        cur.execute("SELECT quantity FROM inventory WHERE variant_id=?", (variant_id,))
        stock_row = cur.fetchone()
        stock = stock_row["quantity"] if stock_row else 0
        if stock <= 0:
            continue  # nothing to add

        # Does user cart already have this variant?
        cur.execute("SELECT cart_item_id, quantity FROM cart_items WHERE cart_id=? AND variant_id=?",
                    (user_cart_id, variant_id))
        row = cur.fetchone()
        if row:
            new_qty = min(stock, row["quantity"] + qty_to_add)
            cur.execute("UPDATE cart_items SET quantity=? WHERE cart_item_id=?",
                        (new_qty, row["cart_item_id"]))
        else:
            final_qty = min(stock, qty_to_add)
            if final_qty > 0:
                cur.execute("""
                    INSERT INTO cart_items (cart_id, variant_id, quantity, price_cents)
                    VALUES (?, ?, ?, ?)
                """, (user_cart_id, variant_id, final_qty, price_cents))

    # Retire guest cart
    cur.execute("UPDATE carts SET status='converted' WHERE cart_id=?", (guest_cart_id,))
    con.commit()


# Alias for routes
get_cart_with_items = get_cart
