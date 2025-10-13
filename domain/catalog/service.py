# domain/catalog/service.py
def get_all_products(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT p.product_id,
               p.name,
               p.description,
               MIN(v.price_cents) AS price_cents,
               pi.image_url
        FROM products p
        LEFT JOIN product_variants v ON p.product_id = v.product_id
        LEFT JOIN product_images pi ON p.product_id = pi.product_id
        GROUP BY p.product_id
        ORDER BY p.product_id
    """)
    products = [dict(row) for row in cur.fetchall()]

    for product in products:
        cur.execute("""
            SELECT variant_id, size, color, price_cents, sku
            FROM product_variants
            WHERE product_id = ?
            ORDER BY size
        """, (product["product_id"],))
        product["variants"] = [dict(v) for v in cur.fetchall()]
    return products

def get_product_detail(conn, product_id):
    cur = conn.cursor()
    cur.execute("""
        SELECT p.product_id,
               p.name,
               p.description,
               MIN(v.price_cents) AS price_cents,
               pi.image_url
        FROM products p
        LEFT JOIN product_variants v ON p.product_id = v.product_id
        LEFT JOIN product_images pi ON p.product_id = pi.product_id
        WHERE p.product_id = ?
        GROUP BY p.product_id
    """, (product_id,))
    row = cur.fetchone()
    if not row:
        return None

    product = dict(row)
    cur.execute("SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order", (product_id,))
    product["images"] = [r["image_url"] for r in cur.fetchall()]
    cur.execute("SELECT variant_id, size, color, price_cents, sku FROM product_variants WHERE product_id = ? ORDER BY size", (product_id,))
    product["variants"] = [dict(v) for v in cur.fetchall()]
    return product
