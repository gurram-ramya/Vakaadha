# Minimal code for the placeholder

from flask import Blueprint, request, jsonify, abort
from domain.catalog import service as catalog

bp = Blueprint("catalog", __name__)

@bp.get("/products")
def list_products():
    page = int(request.args.get("page", 1))
    page_size = int(request.args.get("pageSize", 24))
    search = request.args.get("search")
    category = request.args.get("category")
    sort = request.args.get("sort")
    data = catalog.list_products(page, page_size, search, category, sort)
    return jsonify(data), 200

@bp.get("/products/<int:product_id>")
def get_product(product_id: int):
    p = catalog.get_product(product_id)
    if not p: abort(404)
    return jsonify(p), 200
