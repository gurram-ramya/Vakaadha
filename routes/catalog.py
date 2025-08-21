from flask import Blueprint, request, jsonify, abort
from domain.catalog import service as catalog

bp = Blueprint("catalog", __name__)

def _parse_int(val, default=None, min_val=None, max_val=None):
    if val is None or val == "":
        return default
    try:
        i = int(val)
    except (TypeError, ValueError):
        return default
    if min_val is not None and i < min_val:
        i = min_val
    if max_val is not None and i > max_val:
        i = max_val
    return i

@bp.get("/products")
def list_products():
    # Pagination
    page = _parse_int(request.args.get("page"), default=1, min_val=1)
    page_size = _parse_int(request.args.get("pageSize"), default=24, min_val=1, max_val=100)

    # Basic filters
    search = request.args.get("search") or None
    category = request.args.get("category") or None
    sort = request.args.get("sort") or None
    min_price = _parse_int(request.args.get("minPrice"))
    max_price = _parse_int(request.args.get("maxPrice"))

    # Attribute filters: attr.<name>=csv (e.g., attr.color=red,blue)
    attrs = {}
    for key, val in request.args.items():
        if key.startswith("attr."):
            name = key[5:].strip().lower()
            values = [v.strip() for v in (val or "").split(",") if v.strip()]
            if name and values:
                attrs[name] = values

    data = catalog.list_products(
        page=page,
        page_size=page_size,
        search=search,
        category=category,
        attrs=attrs,
        min_price=min_price,
        max_price=max_price,
        sort=sort,
    )
    return jsonify(data), 200

@bp.get("/products/<int:product_id>")
def get_product(product_id: int):
    p = catalog.get_product(product_id)
    if not p:
        abort(404)
    return jsonify(p), 200
