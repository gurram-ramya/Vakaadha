from flask import Blueprint, request, jsonify, g, current_app, make_response
from functools import wraps
from utils.auth import require_auth, auth_error_response
import domain.wishlist.service as wishlist_service
import logging
from datetime import datetime

wishlist_bp = Blueprint("wishlist", __name__, url_prefix="/api/wishlist")

def _get_guest_id_from_cookie():
    return request.cookies.get("guest_id")

def _set_guest_id_cookie(resp, guest_id):
    resp.set_cookie(
        "guest_id",
        guest_id,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=True,
        samesite="Lax"
    )

def _get_identity():
    """
    Returns a tuple (user_id, guest_id). One or both could be None.
    g.user may exist (when authenticated).
    """
    user_id = None
    if hasattr(g, "user") and g.user:
        user_id = g.user.get("user_id")
    guest_id = _get_guest_id_from_cookie()
    return user_id, guest_id

@wishlist_bp.route("/", methods=["GET"])
def get_wishlist():
    """
    Retrieve the wishlist for current user or guest.
    If guest and no wishlist exists, create one (issue cookie).
    """
    user_id, guest_id = _get_identity()

    # If guest and no guest_id, create a new guest wishlist
    resp = None
    if not user_id and not guest_id:
        # domain layer can choose to generate a new guest_id
        guest_id, wishlist = wishlist_service.get_or_create_guest_wishlist(None)
        resp = make_response(jsonify(wishlist))
        _set_guest_id_cookie(resp, guest_id)
        return resp

    # For authenticated user, ensure merge of guest into user
    if user_id and guest_id:
        try:
            merge_info = wishlist_service.merge_guest_wishlist(user_id, guest_id)
        except wishlist_service.GuestWishlistNotFoundError:
            # guest had no wishlist, ok to skip
            merge_info = None
        # After merge, optionally clear guest cookie or not
        resp = make_response()

    # Now get the wishlist for the principal
    try:
        wishlist = wishlist_service.get_wishlist_items(user_id, guest_id)
    except wishlist_service.WishlistNotFoundError:
        # Even if none exists, we may want to return empty structure
        wishlist = {"wishlist_id": None, "items": []}

    if resp is None:
        resp = make_response(jsonify(wishlist))
    else:
        resp.data = jsonify(wishlist).get_data()

    return resp

@wishlist_bp.route("/add", methods=["POST"])
@require_auth(optional=True)
def add_item():
    """
    Add a product (or variant) to the wishlist.
    Body expects: { "product_id": <int> or "variant_id": <int> }
    """
    user_id, guest_id = _get_identity()
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "invalid_payload", "message": "JSON body required"}), 400

    product_id = data.get("product_id")
    variant_id = data.get("variant_id")
    if not product_id and not variant_id:
        return jsonify({"error": "invalid_payload", "message": "Provide product_id or variant_id"}), 400

    try:
        wishlist_entry = wishlist_service.add_to_wishlist(user_id, guest_id, product_id, variant_id)
    except wishlist_service.InvalidItemError as e:
        return jsonify({"error": "InvalidItemError", "message": str(e)}), 400
    except wishlist_service.DuplicateWishlistItemError as e:
        return jsonify({"error": "DuplicateWishlistItemError", "message": str(e)}), 409
    except Exception as e:
        logging.exception("Error in wishlist add_item")
        return jsonify({"error": "server_error", "message": "Internal error adding wishlist item"}), 500

    resp = make_response(jsonify(wishlist_entry))
    # If guest_id cookie not set, set it
    if not guest_id and wishlist_entry.get("guest_id"):
        _set_guest_id_cookie(resp, wishlist_entry["guest_id"])

    return resp

@wishlist_bp.route("/remove", methods=["POST"])
@require_auth(optional=True)
def remove_item():
    """
    Remove an item from wishlist. Body expects variant_id or product_id.
    """
    user_id, guest_id = _get_identity()
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "invalid_payload", "message": "JSON body required"}), 400

    product_id = data.get("product_id")
    variant_id = data.get("variant_id")
    if not product_id and not variant_id:
        return jsonify({"error": "invalid_payload", "message": "Provide product_id or variant_id"}), 400

    try:
        result = wishlist_service.remove_from_wishlist(user_id, guest_id, product_id, variant_id)
    except wishlist_service.WishlistNotFoundError as e:
        return jsonify({"error": "WishlistNotFoundError", "message": str(e)}), 404
    except Exception as e:
        logging.exception("Error in wishlist remove_item")
        return jsonify({"error": "server_error", "message": "Internal error removing wishlist item"}), 500

    return jsonify(result)

@wishlist_bp.route("/clear", methods=["POST"])
@require_auth(optional=True)
def clear_wishlist():
    """
    Clear all items in the wishlist for current user or guest.
    """
    user_id, guest_id = _get_identity()

    try:
        result = wishlist_service.clear_wishlist(user_id, guest_id)
    except wishlist_service.WishlistNotFoundError as e:
        # If wishlist doesn't exist, treat as no-op
        result = {"status": "cleared", "items_removed": 0}
    except Exception as e:
        logging.exception("Error in wishlist clear")
        return jsonify({"error": "server_error", "message": "Internal error clearing wishlist"}), 500

    return jsonify(result)
