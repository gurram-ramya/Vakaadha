# routes/cart.py
from flask import Blueprint, request, jsonify, g
from utils.auth import require_auth
from domain.cart import service as cart_service

bp = Blueprint("cart", __name__, url_prefix="/users/me/cart")

@bp.route("", methods=["GET"])
@require_auth
def get_cart():
    cart = cart_service.get_cart_with_items(g.user["user_id"])
    return jsonify(cart)

@bp.route("", methods=["POST"])
@require_auth
def add_item():
    data = request.json
    variant_id = data.get("variant_id")
    quantity = data.get("quantity", 1)
    if not variant_id:
        return jsonify({"error": "variant_id required"}), 400
    cart = cart_service.add_item(g.user["user_id"], variant_id, quantity)
    return jsonify(cart)

@bp.route("/<int:item_id>", methods=["PUT"])
@require_auth
def update_item(item_id):
    data = request.json
    quantity = data.get("quantity")
    if quantity is None:
        return jsonify({"error": "quantity required"}), 400
    cart = cart_service.update_item(g.user["user_id"], item_id, quantity)
    return jsonify(cart)

@bp.route("/<int:item_id>", methods=["DELETE"])
@require_auth
def remove_item(item_id):
    cart = cart_service.remove_item(g.user["user_id"], item_id)
    return jsonify(cart)

