# domain/cart/service.py
from db import get_db
from sqlite3 import Row
from datetime import datetime

def dict_from_row(row: Row) -> dict:
    return dict(row) if row else None

# --- Core Cart Logic ---

def get_or_create_active_cart(user_id: int):
    """Ensure the user has one active cart, return its ID."""
    db = get_db()
    cur = db.execute(
        "SELECT * FROM carts WHERE user_id = ? AND status = 'active' LIMIT 1",
        (user_id,)
    )
    cart = cur.fetchone()
    if cart:
        return dict_from_row(cart)

    # create new cart
    cur = db.execute(
        "INSERT INTO carts (user_id, status, created_at, updated_at) VALUES (?, 'active', datetime('now'), datetime('now'))",
        (user_id,)
    )
    db.commit()
    cart_id = cur.lastrowid
    cur = db.execute("SELECT * FROM carts WHERE cart_id = ?", (cart_id,))
    return dict_from_row(cur.fetchone())

def get_cart_with_items(user_id: int):
    """Return the user's active cart with enriched items (product + variant)."""
    cart = get_or_create_active_cart(user_id)
    db = get_db()
    cur = db.execute(
        """
        SELECT ci.cart_item_id, ci.variant_id, ci.quantity,
               pv.sku, pv.price_cents, pv.size, pv.color,
               p.product_id, p.name, p.description, p.category, p.image_url
        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.variant_id
        JOIN products p ON pv.product_id = p.product_id
        WHERE ci.cart_id = ?
        """,
        (cart["cart_id"],)
    )
    items = [dict(row) for row in cur.fetchall()]
    subtotal = sum(item["price_cents"] * item["quantity"] for item in items)
    cart["items"] = items
    cart["subtotal_cents"] = subtotal
    return cart

def add_item(user_id: int, variant_id: int, quantity: int = 1):
    """Add an item to cart, increment if exists."""
    cart = get_or_create_active_cart(user_id)
    db = get_db()
    cur = db.execute(
        "SELECT * FROM cart_items WHERE cart_id = ? AND variant_id = ?",
        (cart["cart_id"], variant_id)
    )
    row = cur.fetchone()
    if row:
        new_qty = row["quantity"] + quantity
        db.execute(
            "UPDATE cart_items SET quantity = ? WHERE cart_item_id = ?",
            (new_qty, row["cart_item_id"])
        )
    else:
        db.execute(
            "INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)",
            (cart["cart_id"], variant_id, quantity)
        )
    db.commit()
    return get_cart_with_items(user_id)

def update_item(user_id: int, item_id: int, quantity: int):
    """Update quantity for a cart item, remove if zero."""
    cart = get_or_create_active_cart(user_id)
    db = get_db()
    if quantity <= 0:
        db.execute(
            "DELETE FROM cart_items WHERE cart_item_id = ? AND cart_id = ?",
            (item_id, cart["cart_id"])
        )
    else:
        db.execute(
            "UPDATE cart_items SET quantity = ? WHERE cart_item_id = ? AND cart_id = ?",
            (quantity, item_id, cart["cart_id"])
        )
    db.commit()
    return get_cart_with_items(user_id)

def remove_item(user_id: int, item_id: int):
    """Remove item from cart."""
    cart = get_or_create_active_cart(user_id)
    db = get_db()
    db.execute(
        "DELETE FROM cart_items WHERE cart_item_id = ? AND cart_id = ?",
        (item_id, cart["cart_id"])
    )
    db.commit()
    return get_cart_with_items(user_id)
