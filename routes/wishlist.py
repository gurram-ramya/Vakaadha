# routes/wishlist.py

"""
Vakaadha — Wishlist API Routes
==============================

Endpoints:
GET    /api/wishlist
POST   /api/wishlist
DELETE /api/wishlist/<wishlist_item_id>
DELETE /api/wishlist/clear
POST   /api/wishlist/move-to-cart
GET    /api/wishlist/count
"""

import logging
from flask import Blueprint, request, jsonify, g, make_response
from utils.auth import require_auth
from utils.auth import resolve_guest_context, _set_guest_cookie
from domain.wishlist import service as wishlist_service

bp = Blueprint("wishlist", __name__, url_prefix="/api/wishlist")


# -------------------------------------------------------------
# Helpers
# -------------------------------------------------------------
# def _resolve_identity():
#     """Resolve current identity for user or guest context."""
#     user_id = getattr(g, "user", None)
#     user_id = user_id["user_id"] if isinstance(user_id, dict) and "user_id" in user_id else user_id
#     guest_id = _get_guest_id(request)
#     return user_id, guest_id


def _resolve_identity():
    """Resolve current identity for user or guest context."""
    user_id = getattr(g, "user", None)
    user_id = user_id["user_id"] if isinstance(user_id, dict) and "user_id" in user_id else user_id

    guest_id = getattr(g, "guest_id", None)
    if not guest_id:
        guest_id = resolve_guest_context()  # ensures guest_id exists

    return user_id, guest_id

# -------------------------------------------------------------
# Routes
# -------------------------------------------------------------
@bp.route("", methods=["GET"])
@require_auth(optional=True)
def get_wishlist():
    """Return full wishlist."""
    user_id, guest_id = _resolve_identity()
    data = wishlist_service.get_wishlist(user_id=user_id, guest_id=guest_id)
    resp = make_response(jsonify(data), 200)
    if not guest_id and not user_id:
        guest_id = _set_guest_cookie(resp)
    return resp


@bp.route("", methods=["POST"])
@require_auth(optional=True)
def add_to_wishlist():
    """Add product/variant to wishlist."""
    user_id, guest_id = _resolve_identity()
    body = request.get_json(force=True) or {}
    product_id = body.get("product_id")
    variant_id = body.get("variant_id")

    if not (product_id and variant_id):
        return jsonify({"error": "Missing product_id or variant_id"}), 400

    try:
        result = wishlist_service.add_to_wishlist(product_id, variant_id, user_id, guest_id)
        resp = make_response(jsonify(result), 201)
        if not user_id and not guest_id:
            _set_guest_cookie(resp)
        return resp
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.exception("[wishlist] add_to_wishlist failed")
        return jsonify({"error": "Internal Server Error"}), 500


@bp.route("/<int:wishlist_item_id>", methods=["DELETE"])
@require_auth(optional=True)
def remove_wishlist_item(wishlist_item_id):
    """Remove a single wishlist item."""
    user_id, guest_id = _resolve_identity()
    try:
        result = wishlist_service.remove_from_wishlist(wishlist_item_id, user_id, guest_id)
        return jsonify(result)
    except Exception as e:
        logging.exception("[wishlist] remove failed")
        return jsonify({"error": str(e)}), 500


@bp.route("/clear", methods=["DELETE"])
@require_auth(optional=True)
def clear_wishlist():
    """Clear entire wishlist."""
    user_id, guest_id = _resolve_identity()
    result = wishlist_service.clear_wishlist(user_id, guest_id)
    return jsonify(result)


@bp.route("/move-to-cart", methods=["POST"])
@require_auth(optional=True)
def move_to_cart():
    """Move a wishlist item to cart."""
    user_id, guest_id = _resolve_identity()
    body = request.get_json(force=True) or {}
    variant_id = body.get("variant_id")

    if not variant_id:
        return jsonify({"error": "Missing variant_id"}), 400

    result = wishlist_service.move_to_cart(variant_id, user_id, guest_id)
    if result.get("status") == "error" and result.get("code") == 409:
        return jsonify(result), 409
    return jsonify(result), 200


@bp.route("/count", methods=["GET"])
@require_auth(optional=True)
def wishlist_count():
    """Return wishlist count for navbar polling."""
    user_id, guest_id = _resolve_identity()
    count = wishlist_service.get_count(user_id, guest_id)
    return jsonify({"count": count})
