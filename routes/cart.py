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
    Preference: authenticated user_id if available.
    """
    if hasattr(g, "user") and g.user.get("user_id"):
        uid = g.user["user_id"]
        print(f"[DEBUG resolve_identity] Authenticated user_id={uid}")
        return uid, None

    guest_id = req.args.get("guest_id")
    if not guest_id and req.method in ("POST", "PUT"):
        data = req.get_json(silent=True) or {}
        guest_id = data.get("guest_id")

    print(f"[DEBUG resolve_identity] Guest user_id=None, guest_id={guest_id}")
    return None, guest_id


def require_auth_or_guest(fn):
    """
    Middleware: If Authorization is present, validate with require_auth.
    Else fall back to guest_id query param.
    """
    def decorator(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            # Force normal require_auth behavior
            return require_auth(fn)(*args, **kwargs)
        # No token → guest flow
        return fn(*args, **kwargs)
    decorator.__name__ = fn.__name__
    return decorator


@bp.route("", methods=["GET"])
@require_auth_or_guest
def fetch_cart():
    """
    Fetch cart contents for either authenticated user or guest.
    Always returns hydrated items.
    """
    user_id, guest_id = resolve_identity(request)
    if not user_id and not guest_id:
        print("[DEBUG /cart GET] Missing identifiers")
        return jsonify({"error": "Missing user_id or guest_id"}), 400

    cart = get_cart_with_items(user_id=user_id, guest_id=guest_id)
    print(f"[DEBUG /cart GET] resolved user_id={user_id}, guest_id={guest_id}, items={len(cart.get('items', []))}")
    return jsonify(cart)


@bp.route("", methods=["POST"])
def add_item():
    """
    Add a product variant to the cart.
    Body: { "variant_id": int, "quantity": int }
    """
    user_id, guest_id = resolve_identity(request)
    if not user_id and not guest_id:
        print("[DEBUG /cart POST] Missing identifiers")
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
        print(f"[DEBUG /cart POST] Added variant={variant_id}, qty={quantity}, user_id={user_id}, guest_id={guest_id}")
    except ValueError as e:
        print(f"[WARN /cart POST] {e}")
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
        print("[DEBUG /cart PUT] Missing identifiers")
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
        print(f"[DEBUG /cart PUT] Updated cart_item={cart_item_id}, qty={quantity}, user_id={user_id}, guest_id={guest_id}")
    except ValueError as e:
        print(f"[WARN /cart PUT] {e}")
        return jsonify({"error": str(e)}), 400

    return jsonify(cart)


@bp.route("/<int:cart_item_id>", methods=["DELETE"])
def delete_item(cart_item_id):
    """
    Remove a cart item.
    """
    user_id, guest_id = resolve_identity(request)
    if not user_id and not guest_id:
        print("[DEBUG /cart DELETE] Missing identifiers")
        return jsonify({"error": "Missing user_id or guest_id"}), 400

    try:
        cart = remove_cart_item(
            user_id=user_id,
            guest_id=guest_id,
            cart_item_id=cart_item_id,
        )
        print(f"[DEBUG /cart DELETE] Removed cart_item={cart_item_id}, user_id={user_id}, guest_id={guest_id}")
    except ValueError as e:
        print(f"[WARN /cart DELETE] {e}")
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
    print(f"[DEBUG /cart/merge] guest_id={guest_id} merged into user_id={user_id}")

    return jsonify(get_cart_with_items(user_id=user_id))
