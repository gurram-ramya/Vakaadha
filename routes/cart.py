# routes\cart.py

from flask import Blueprint, request, jsonify
from flask import Blueprint, request, jsonify
from domain.cart.service import (
    get_cart_with_items,
    add_cart_item,
    update_cart_item,
    remove_cart_item,
)
import sqlite3


bp = Blueprint("cart", __name__, url_prefix="/api/cart")


def get_db():
    conn = sqlite3.connect("vakaadha.db")
    conn.row_factory = sqlite3.Row
    return conn


def resolve_identity(req):
    """
    Resolve identity for cart ownership.
    Priority: logged-in user_id > guest_id
    """
    user_id = getattr(req, "user_id", None)  # set by auth middleware if present
    guest_id = request.args.get("guest_id") or (request.json or {}).get("guest_id")
    return user_id, guest_id


@bp.route("", methods=["GET"])
def fetch_cart():
    """
    Fetch cart contents for either user or guest.
    Always returns hydrated items.
    """
    user_id, guest_id = resolve_identity(request)
    if not user_id and not guest_id:
        return jsonify({"error": "Missing user_id or guest_id"}), 400

    cart = get_cart_with_items(user_id=user_id, guest_id=guest_id)
    return jsonify(cart)


@bp.route("", methods=["POST"])
def add_item():
    """
    Add a product variant to the cart.
    Body: { "variant_id": int, "quantity": int }
    """
    user_id, guest_id = resolve_identity(request)
    if not user_id and not guest_id:
        return jsonify({"error": "Missing user_id or guest_id"}), 400

    data = request.get_json(force=True)
    variant_id = data.get("variant_id")
    quantity = data.get("quantity", 1)

    if not variant_id or quantity < 1:
        return jsonify({"error": "Invalid variant_id or quantity"}), 400

    try:
        cart = add_cart_item(user_id=user_id, guest_id=guest_id,
                             variant_id=variant_id, quantity=quantity)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(cart), 201


@bp.route("/<int:cart_item_id>", methods=["PUT"])
def update_item(cart_item_id):
    """
    Update quantity of a cart item.
    Body: { "quantity": int }
    """
    user_id, guest_id = resolve_identity(request)
    if not user_id and not guest_id:
        return jsonify({"error": "Missing user_id or guest_id"}), 400

    data = request.get_json(force=True)
    quantity = data.get("quantity")

    if not isinstance(quantity, int) or quantity < 1:
        return jsonify({"error": "Invalid quantity"}), 400

    try:
        cart = update_cart_item(user_id=user_id, guest_id=guest_id,
                                cart_item_id=cart_item_id, quantity=quantity)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(cart)


@bp.route("/<int:cart_item_id>", methods=["DELETE"])
def delete_item(cart_item_id):
    """
    Remove a cart item.
    """
    user_id, guest_id = resolve_identity(request)
    if not user_id and not guest_id:
        return jsonify({"error": "Missing user_id or guest_id"}), 400

    try:
        cart = remove_cart_item(user_id=user_id, guest_id=guest_id,
                                cart_item_id=cart_item_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(cart)
