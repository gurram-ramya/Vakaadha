# minimal code for the place holder

from flask import Blueprint, jsonify, request, g, abort
from domain.cart import service as cart
from utils.auth import require_auth  # your decorator

bp = Blueprint("cart", __name__)

@bp.get("/cart")
@require_auth
def get_cart():
    return jsonify(cart.list_cart_items(g.user["user_id"])), 200

@bp.post("/cart/items")
@require_auth
def add_cart_item():
    data = request.get_json(force=True) or {}
    variant_id = int(data.get("variant_id", 0))
    qty = int(data.get("quantity", 0))
    if variant_id <= 0 or qty <= 0: abort(400, description="invalid payload")
    return jsonify(cart.add_item(g.user["user_id"], variant_id, qty)), 200
