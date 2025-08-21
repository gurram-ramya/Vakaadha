from __future__ import annotations
from typing import Any, Dict, List, Optional, Sequence, Tuple
import json
import sqlite3

from db import get_db_connection

# -------- helpers --------

def _has_column(con: sqlite3.Connection, table: str, column: str) -> bool:
    cur = con.execute(f"PRAGMA table_info({table})")
    return any(r[1] == column for r in cur.fetchall())

def _table_exists(con: sqlite3.Connection, table: str) -> bool:
    cur = con.execute("SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name=? LIMIT 1", (table,))
    return cur.fetchone() is not None

def _in_clause(column: str, values: Sequence[Any]) -> Tuple[str, List[Any]]:
    ph = ",".join(["?"] * len(values))
    return f"{column} IN ({ph})", list(values)

def _order_role_case(alias: str = "pi.role") -> str:
    # main → gallery → thumb → others
    return f"CASE {alias} WHEN 'main' THEN 0 WHEN 'gallery' THEN 1 WHEN 'thumb' THEN 2 ELSE 3 END"

def _normalize_search_q(q: Optional[str]) -> Optional[str]:
    if not q:
        return None
    q = q.strip()
    return q or None

# -------- public API --------

def list_products(
    page: int = 1,
    page_size: int = 24,
    search: Optional[str] = None,
    category: Optional[str] = None,
    attrs: Optional[Dict[str, Sequence[str]]] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    sort: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Returns:
      {
        "items": [ { productId, name, category, minPriceCents, maxPriceCents, image, colors, sizes } ... ],
        "pagination": { "page", "pageSize", "total", "totalPages" },
        "facets": {
            "categories": [ {"value": "apparel", "count": 2}, ... ],
            "attributes": { "color": [ {"value":"black","count":2}, ... ],
                            "size":  [ {"value":"m","count":3}, ... ] },
            "price": {"min": 999, "max": 3999}
        }
      }
    """
    con = get_db_connection()
    cur = con.cursor()

    # Schema / feature detection (safe on any schema)
    has_products_active = _has_column(con, "products", "active")
    has_variants_active = _has_column(con, "product_variants", "active")
    fts_available = _table_exists(con, "products_fts")

    attrs = attrs or {}
    search_q = _normalize_search_q(search)

    # ---- product-level filters (category, active, search) ----
    where_products: List[str] = []
    params_products: List[Any] = []

    if category:
        where_products.append("p.category = ?")
        params_products.append(category)

    if has_products_active:
        where_products.append("p.active = 1")

    search_cte = ""
    join_search = ""
    if search_q:
        if fts_available:
            # FTS5 (rank via bm25)
            search_cte = """
            , search_products AS (
                SELECT rowid AS product_id, bm25(products_fts) AS rank
                FROM products_fts
                WHERE products_fts MATCH ?
            )
            """
            join_search = "JOIN search_products sp ON sp.product_id = p.product_id"
            params_products = [search_q] + params_products
        else:
            # LIKE fallback over name/description/long_description
            where_products.append(
                "(p.name LIKE ? OR IFNULL(p.description,'') LIKE ? OR IFNULL(pd.long_description,'') LIKE ?)"
            )
            like = f"%{search_q}%"
            params_products += [like, like, like]

    # ---- variant-level filters (active, color, size, price) ----
    where_variants: List[str] = []
    params_variants: List[Any] = []

    if has_variants_active:
        where_variants.append("v.active = 1")
    if isinstance(min_price, int):
        where_variants.append("v.price_cents >= ?")
        params_variants.append(min_price)
    if isinstance(max_price, int):
        where_variants.append("v.price_cents <= ?")
        params_variants.append(max_price)

    if "color" in attrs and attrs["color"]:
        clause, vals = _in_clause("LOWER(v.color)", [v.lower() for v in attrs["color"]])
        where_variants.append(clause)
        params_variants.extend(vals)
    if "size" in attrs and attrs["size"]:
        clause, vals = _in_clause("LOWER(v.size)", [v.lower() for v in attrs["size"]])
        where_variants.append(clause)
        params_variants.extend(vals)

    # ---- CTEs ----
    cte = f"""
    WITH
    products_base AS (
        SELECT p.product_id, p.name, p.description, p.category, p.created_at
        FROM products p
        {"LEFT JOIN product_details pd USING(product_id)" if (search_q and not fts_available) else ""}
        {" ".join([join_search])}
        {"WHERE " + " AND ".join(where_products) if where_products else ""}
    )
    {search_cte}
    , filtered_variants AS (
        SELECT v.*
        FROM product_variants v
        JOIN products_base pb ON pb.product_id = v.product_id
        {"WHERE " + " AND ".join(where_variants) if where_variants else ""}
    )
    , product_agg AS (
        SELECT pb.product_id, pb.name, pb.description, pb.category, pb.created_at,
               MIN(fv.price_cents) AS min_price_cents,
               MAX(fv.price_cents) AS max_price_cents
        FROM products_base pb
        JOIN filtered_variants fv ON fv.product_id = pb.product_id
        GROUP BY pb.product_id
    )
    """

    # Total count
    cur.execute(cte + " SELECT COUNT(*) FROM product_agg;", tuple(params_products + params_variants))
    total = cur.fetchone()[0]
    total_pages = (total + page_size - 1) // page_size if page_size else 1
    offset = (page - 1) * page_size

    # Sort
    sort = (sort or "").lower()
    if sort == "price_asc":
        order_by = "ORDER BY product_agg.min_price_cents ASC, product_agg.product_id ASC"
    elif sort == "price_desc":
        order_by = "ORDER BY product_agg.min_price_cents DESC, product_agg.product_id ASC"
    elif sort == "name_asc":
        order_by = "ORDER BY product_agg.name COLLATE NOCASE ASC"
    elif sort == "name_desc":
        order_by = "ORDER BY product_agg.name COLLATE NOCASE DESC"
    elif sort == "newest":
        order_by = "ORDER BY product_agg.created_at DESC"
    else:
        # If searching with FTS, use rank; else newest
        if search_q and fts_available:
            order_by = "ORDER BY (SELECT sp.rank FROM search_products sp WHERE sp.product_id = product_agg.product_id) ASC"
        else:
            order_by = "ORDER BY product_agg.created_at DESC"

    # Page
    sql_page = cte + f"""
        SELECT product_agg.product_id, product_agg.name, product_agg.category,
               product_agg.min_price_cents, product_agg.max_price_cents
        FROM product_agg
        {order_by}
        LIMIT ? OFFSET ?;
    """
    cur.execute(sql_page, tuple(params_products + params_variants + [page_size, offset]))
    rows = cur.fetchall()
    product_ids = [r[0] for r in rows]

    # Images (primary per product), colors & sizes (from filtered variants)
    images_by_product: Dict[int, Optional[Dict[str, Any]]] = {}
    colors_by_product: Dict[int, List[str]] = {}
    sizes_by_product: Dict[int, List[str]] = {}

    if product_ids:
        # Primary image per product (main → gallery → thumb)
        order_case = _order_role_case("pi.role")
        ph = ",".join(["?"] * len(product_ids))
        cur.execute(f"""
            SELECT pi.product_id, pi.role, pi.storage_key, pi.width, pi.height, pi.alt_text
            FROM product_images pi
            WHERE pi.product_id IN ({ph})
            ORDER BY pi.product_id, {order_case}, pi.image_id ASC
        """, product_ids)
        for pid, role, storage_key, w, h, alt in cur.fetchall():
            if pid not in images_by_product:
                images_by_product[pid] = {
                    "role": role,
                    "url": f"/media/{storage_key}",
                    "width": w, "height": h,
                    "alt": alt,
                }

        # Available colors/sizes (already filtered set)
        cur.execute(f"""
            {cte}
            SELECT fv.product_id,
                   LOWER(IFNULL(fv.color,'')) AS color,
                   LOWER(IFNULL(fv.size,'')) AS size
            FROM filtered_variants fv
            JOIN product_agg pa ON pa.product_id = fv.product_id
            WHERE fv.product_id IN ({ph})
        """, tuple(params_products + params_variants + product_ids))
        colors_tmp: Dict[int, set] = {}
        sizes_tmp: Dict[int, set] = {}
        for pid, color, size in cur.fetchall():
            if color:
                colors_tmp.setdefault(pid, set()).add(color)
            if size:
                sizes_tmp.setdefault(pid, set()).add(size)
        colors_by_product = {pid: sorted(list(vals)) for pid, vals in colors_tmp.items()}
        sizes_by_product = {pid: sorted(list(vals)) for pid, vals in sizes_tmp.items()}

    items = []
    for pid, name, category, min_p, max_p in rows:
        items.append({
            "productId": pid,
            "name": name,
            "category": category,
            "minPriceCents": min_p,
            "maxPriceCents": max_p,
            "image": images_by_product.get(pid),
            "colors": colors_by_product.get(pid, []),
            "sizes": sizes_by_product.get(pid, []),
        })

    facets = _compute_facets(cur, cte, params_products, params_variants)

    return {
        "items": items,
        "pagination": {"page": page, "pageSize": page_size, "total": total, "totalPages": total_pages},
        "facets": facets,
    }

def _compute_facets(cur: sqlite3.Cursor, cte_sql: str, params_products: List[Any], params_variants: List[Any]) -> Dict[str, Any]:
    # Categories facet
    cur.execute(cte_sql + """
        SELECT pa.category, COUNT(*) AS cnt
        FROM product_agg pa
        GROUP BY pa.category
        ORDER BY cnt DESC, pa.category ASC;
    """, tuple(params_products + params_variants))
    categories = [{"value": r[0], "count": r[1]} for r in cur.fetchall() if r[0] is not None]

    # Color facet
    cur.execute(cte_sql + """
        SELECT LOWER(fv.color) AS color, COUNT(*) AS cnt
        FROM filtered_variants fv
        GROUP BY LOWER(fv.color)
        HAVING color IS NOT NULL AND color <> ''
        ORDER BY cnt DESC, color ASC;
    """, tuple(params_products + params_variants))
    colors = [{"value": r[0], "count": r[1]} for r in cur.fetchall()]

    # Size facet
    cur.execute(cte_sql + """
        SELECT LOWER(fv.size) AS size, COUNT(*) AS cnt
        FROM filtered_variants fv
        GROUP BY LOWER(fv.size)
        HAVING size IS NOT NULL AND size <> ''
        ORDER BY cnt DESC, size ASC;
    """, tuple(params_products + params_variants))
    sizes = [{"value": r[0], "count": r[1]} for r in cur.fetchall()]

    # Price bounds
    cur.execute(cte_sql + """
        SELECT MIN(fv.price_cents), MAX(fv.price_cents)
        FROM filtered_variants fv;
    """, tuple(params_products + params_variants))
    r = cur.fetchone()
    price_facet = {"min": r[0], "max": r[1]} if r and r[0] is not None else {"min": None, "max": None}

    return {
        "categories": categories,
        "attributes": {"color": colors, "size": sizes},
        "price": price_facet,
    }

def get_product(product_id: int) -> Optional[Dict[str, Any]]:
    con = get_db_connection()
    cur = con.cursor()

    # Product
    cur.execute("""
        SELECT p.product_id, p.name, p.description, p.category, p.created_at
        FROM products p
        WHERE p.product_id = ?
        LIMIT 1
    """, (product_id,))
    row = cur.fetchone()
    if not row:
        return None

    pid, name, description, category, created_at = row

    # Variants (active if column exists)
    has_variants_active = _has_column(con, "product_variants", "active")
    where_v = "WHERE v.product_id = ?"
    params_v: List[Any] = [pid]
    if has_variants_active:
        where_v += " AND v.active = 1"
    cur.execute(f"""
        SELECT v.variant_id, v.sku, v.color, v.size, v.price_cents
        FROM product_variants v
        {where_v}
        ORDER BY v.price_cents ASC, v.variant_id ASC
    """, params_v)
    variants = [
        {"variantId": r[0], "sku": r[1], "color": r[2], "size": r[3], "priceCents": r[4]}
        for r in cur.fetchall()
    ]

    # Images (main → gallery → thumb)
    order_case = _order_role_case("pi.role")
    cur.execute(f"""
        SELECT pi.role, pi.storage_key, pi.width, pi.height, pi.alt_text
        FROM product_images pi
        WHERE pi.product_id = ?
        ORDER BY {order_case}, pi.image_id ASC
    """, (pid,))
    images = [
        {"role": r[0], "url": f"/media/{r[1]}", "width": r[2], "height": r[3], "alt": r[4]}
        for r in cur.fetchall()
    ]
    # Fallback to deprecated products.image_url
    if not images:
        cur.execute("SELECT image_url FROM products WHERE product_id = ?", (pid,))
        r = cur.fetchone()
        if r and r[0]:
            images = [{"role": "main", "url": r[0], "width": None, "height": None, "alt": name}]

    # Details (JSON parsed)
    cur.execute("""
        SELECT long_description, specs_json, care_html
        FROM product_details
        WHERE product_id = ?
        LIMIT 1
    """, (pid,))
    dr = cur.fetchone()
    details = None
    if dr:
        long_desc, specs_json, care_html = dr
        specs = None
        if specs_json:
            try:
                specs = json.loads(specs_json)
            except Exception:
                specs = None
        details = {"longDescription": long_desc, "specs": specs, "careHtml": care_html}

    # Generic attributes (optional)
    cur.execute("""
        SELECT a.name, pa.value
        FROM product_attributes pa
        JOIN attributes a ON a.attribute_id = pa.attribute_id
        WHERE pa.product_id = ?
    """, (pid,))
    attributes = {name: value for (name, value) in cur.fetchall()}

    # Review summary (visible only)
    cur.execute("""
        SELECT COUNT(*), AVG(rating)
        FROM reviews
        WHERE product_id = ? AND status = 'visible'
    """, (pid,))
    r = cur.fetchone()
    review_count = int(r[0]) if r and r[0] is not None else 0
    avg_rating = float(r[1]) if r and r[1] is not None else None

    cur.execute("""
        SELECT rating, COUNT(*) FROM reviews
        WHERE product_id = ? AND status = 'visible'
        GROUP BY rating
    """, (pid,))
    dist = {int(rt): int(cnt) for (rt, cnt) in cur.fetchall()}

    return {
        "productId": pid,
        "name": name,
        "description": description,
        "category": category,
        "createdAt": created_at,
        "images": images,
        "variants": variants,
        "details": details,
        "attributes": attributes,
        "reviews": {
            "count": review_count,
            "average": avg_rating,
            "distribution": dist,
        },
    }
