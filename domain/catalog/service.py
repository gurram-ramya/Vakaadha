#Mininimal code for the place holder



from db import get_db_connection

def list_products(page=1, page_size=24, search=None, category=None, sort=None):
    con = get_db_connection()
    cur = con.cursor()

    params = []
    where = []
    if search:
        where.append("(p.name LIKE ? OR p.description LIKE ?)")
        s = f"%{search}%"; params += [s, s]
    if category:
        where.append("p.category = ?"); params.append(category)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    order_sql = "ORDER BY p.created_at DESC" if not sort else "ORDER BY p.name ASC"

    # count
    cur.execute(f"SELECT COUNT(*) FROM products p {where_sql}", params)
    total = cur.fetchone()[0]

    offset = (page-1) * page_size
    cur.execute(f"""
        SELECT p.product_id, p.name, p.description, p.category, p.price_cents
        FROM products p
        {where_sql}
        {order_sql}
        LIMIT ? OFFSET ?
    """, [*params, page_size, offset])
    items = [{
        "productId": r[0], "name": r[1], "description": r[2],
        "category": r[3], "priceCents": r[4],
    } for r in cur.fetchall()]

    return {"items": items, "page": page, "pageSize": page_size, "total": total}

def get_product(product_id: int):
    con = get_db_connection()
    cur = con.cursor()
    cur.execute("""
        SELECT product_id, name, description, category, price_cents
        FROM products WHERE product_id = ?
    """, [product_id])
    r = cur.fetchone()
    if not r: return None

    cur.execute("""
        SELECT role, storage_key, width, height, alt_text
        FROM product_images WHERE product_id = ?
    """, [product_id])
    images = [{
        "role": ir[0],
        "url": f"/media/{ir[1]}",
        "width": ir[2],
        "height": ir[3],
        "alt": ir[4],
    } for ir in cur.fetchall()]

    return {
        "productId": r[0], "name": r[1], "description": r[2],
        "category": r[3], "priceCents": r[4], "images": images,
    }
