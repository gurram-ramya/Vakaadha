# routes/cart.py

from flask import Blueprint, request, jsonify, g
from domain.cart.service import (
    get_cart_with_items,
    add_cart_item,
    update_cart_item,
    remove_cart_item,
    merge_guest_cart,
)
from utils.auth import require_auth

bp = Blueprint("cart", __name__, url_prefix="/api/cart")


def resolve_identity(req):
    """
    Resolve current actor as user or guest.
    Preference: user_id if authenticated.
    """
    if hasattr(g, "user") and g.user.get("user_id"):
        return g.user["user_id"], None

    guest_id = req.args.get("guest_id")
    if not guest_id and req.method in ("POST", "PUT"):
        data = req.get_json(silent=True) or {}
        guest_id = data.get("guest_id")

    return None, guest_id



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
        cart = add_cart_item(
            user_id=user_id,
            guest_id=guest_id,
            variant_id=variant_id,
            quantity=quantity,
        )
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
        cart = update_cart_item(
            user_id=user_id,
            guest_id=guest_id,
            cart_item_id=cart_item_id,
            quantity=quantity,
        )
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
        cart = remove_cart_item(
            user_id=user_id,
            guest_id=guest_id,
            cart_item_id=cart_item_id,
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(cart)


@bp.route("/merge", methods=["POST"])
@require_auth
def merge_cart():
    """
    Merge a guest cart into the authenticated user's cart.
    Body: { "guest_id": str }
    """
    data = request.get_json(force=True)
    user_id = g.user["user_id"]
    guest_id = data.get("guest_id")

    if not guest_id:
        return jsonify({"error": "Missing guest_id"}), 400

    merge_guest_cart(guest_id, user_id)
    return jsonify(get_cart_with_items(user_id=user_id))
