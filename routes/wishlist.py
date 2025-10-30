# # routes/wishlist.py — Vakaadha Wishlist Routes v2
# from flask import Blueprint, request, jsonify, g
# from utils.auth import require_auth
# from domain.wishlist import service as wishlist_service
# import logging

# bp = Blueprint("wishlist", __name__, url_prefix="/api/wishlist")


# # ============================================================
# # ADD ITEM TO WISHLIST
# # ============================================================
# @bp.route("", methods=["POST"])
# @require_auth(optional=True)
# def add_to_wishlist():
#     """
#     Add a product to the user's or guest's wishlist.
#     Automatically creates a wishlist record if it doesn't exist.
#     """
#     body = request.get_json(force=True) or {}
#     product_id = body.get("product_id")

#     if not product_id:
#         return jsonify({"error": "Missing product_id"}), 400

#     try:
#         user_id = getattr(g, "user_id", None)
#         guest_id = getattr(g, "guest_id", None)
#         result = wishlist_service.add_to_wishlist(product_id, user_id, guest_id)
#         status_code = 201 if result.get("status") == "success" else 400
#         return jsonify(result), status_code
#     except Exception as e:
#         logging.exception("[Wishlist] Failed to add product to wishlist")
#         return jsonify({"error": "Internal server error", "details": str(e)}), 500


# # ============================================================
# # REMOVE ITEM FROM WISHLIST
# # ============================================================
# @bp.route("/<int:product_id>", methods=["DELETE"])
# @require_auth(optional=True)
# def remove_from_wishlist(product_id):
#     """
#     Remove a product from the user's or guest's wishlist.
#     """
#     try:
#         user_id = getattr(g, "user_id", None)
#         guest_id = getattr(g, "guest_id", None)
#         result = wishlist_service.remove_from_wishlist(product_id, user_id, guest_id)
#         return jsonify(result), 200
#     except Exception as e:
#         logging.exception("[Wishlist] Failed to remove product")
#         return jsonify({"error": "Internal server error", "details": str(e)}), 500


# # ============================================================
# # GET WISHLIST ITEMS
# # ============================================================
# @bp.route("", methods=["GET"])
# @require_auth(optional=True)
# def get_wishlist():
#     """
#     Retrieve all wishlist items for the current user or guest.
#     Returns structured response:
#     {
#         "wishlist_id": ...,
#         "count": ...,
#         "items": [...]
#     }
#     """
#     try:
#         user_id = getattr(g, "user_id", None)
#         guest_id = getattr(g, "guest_id", None)
#         data = wishlist_service.get_wishlist(user_id, guest_id)
#         return jsonify(data), 200
#     except Exception as e:
#         logging.exception("[Wishlist] Failed to retrieve wishlist")
#         return jsonify({"error": "Internal server error", "details": str(e)}), 500


# # ============================================================
# # GET WISHLIST COUNT
# # ============================================================
# @bp.route("/count", methods=["GET"])
# @require_auth(optional=True)
# def get_wishlist_count():
#     """
#     Return the total number of wishlist items for the current user or guest.
#     """
#     try:
#         user_id = getattr(g, "user_id", None)
#         guest_id = getattr(g, "guest_id", None)
#         count = wishlist_service.get_count(user_id, guest_id)
#         return jsonify({"count": count}), 200
#     except Exception as e:
#         logging.exception("[Wishlist] Failed to get wishlist count")
#         return jsonify({"error": "Internal server error", "details": str(e)}), 500


# # ============================================================
# # CLEAR ENTIRE WISHLIST
# # ============================================================
# @bp.route("/clear", methods=["DELETE"])
# @require_auth(optional=True)
# def clear_wishlist():
#     """
#     Remove all items from the current user's or guest's wishlist.
#     """
#     try:
#         user_id = getattr(g, "user_id", None)
#         guest_id = getattr(g, "guest_id", None)
#         result = wishlist_service.clear_wishlist(user_id, guest_id)
#         return jsonify(result), 200
#     except Exception as e:
#         logging.exception("[Wishlist] Failed to clear wishlist")
#         return jsonify({"error": "Internal server error", "details": str(e)}), 500


# # ============================================================
# # MOVE ITEM TO CART
# # ============================================================
# @bp.route("/move-to-cart", methods=["POST"])
# @require_auth(optional=True)
# def move_to_cart():
#     """
#     Move an item from the wishlist to the cart.
#     Requires product_id and variant_id in the request body.
#     """
#     body = request.get_json(force=True) or {}
#     product_id = body.get("product_id")
#     variant_id = body.get("variant_id")

#     if not product_id or not variant_id:
#         return jsonify({"error": "Missing product_id or variant_id"}), 400

#     try:
#         user_id = getattr(g, "user_id", None)
#         guest_id = getattr(g, "guest_id", None)
#         result = wishlist_service.move_to_cart(product_id, variant_id, user_id, guest_id)
#         return jsonify(result), 200
#     except Exception as e:
#         logging.exception("[Wishlist] Failed to move item to cart")
#         return jsonify({"error": "Internal server error", "details": str(e)}), 500


# # ============================================================
# # MERGE GUEST WISHLIST → USER WISHLIST (AFTER LOGIN)
# # ============================================================
# @bp.route("/merge", methods=["POST"])
# @require_auth(optional=True)
# def merge_guest_wishlist():
#     """
#     Merge a guest's wishlist into a logged-in user's wishlist.
#     Typically called after login (guest → authenticated user).
#     """
#     try:
#         user_id = getattr(g, "user_id", None)
#         guest_id = getattr(g, "guest_id", None)

#         if not user_id or not guest_id:
#             return jsonify({"error": "Missing user_id or guest_id"}), 400

#         result = wishlist_service.merge_guest_wishlist(user_id, guest_id)
#         return jsonify(result), 200
#     except Exception as e:
#         logging.exception("[Wishlist] Failed to merge guest wishlist")
#         return jsonify({"error": "Internal server error", "details": str(e)}), 500


# # ============================================================
# # ARCHIVE WISHLIST (ADMIN / CLEANUP)
# # ============================================================
# @bp.route("/<int:wishlist_id>/archive", methods=["POST"])
# @require_auth(optional=True)
# def archive_wishlist(wishlist_id):
#     """
#     Archive a wishlist for long-term retention.
#     Usually used by automated cleanup or admin tools.
#     """
#     try:
#         result = wishlist_service.archive_wishlist(wishlist_id)
#         return jsonify(result), 200
#     except Exception as e:
#         logging.exception("[Wishlist] Failed to archive wishlist")
#         return jsonify({"error": "Internal server error", "details": str(e)}), 500

# routes/wishlist.py — Unified Guest + User Wishlist Routes v3
from flask import Blueprint, request, jsonify, g
from utils.auth import require_auth
from domain.wishlist import service as wishlist_service
import logging

bp = Blueprint("wishlist", __name__, url_prefix="/api/wishlist")


# ============================================================
# INTERNAL HELPER — GET CONTEXT
# ============================================================
def get_context():
    """
    Determine whether the current session is authenticated or guest.
    Returns (user_id, guest_id).
    If user is authenticated, guest_id is None.
    """
    user = getattr(g, "user", None)
    user_id = user.get("user_id") if user else None
    guest_id = None if user_id else getattr(g, "guest_id", None)
    return user_id, guest_id


# ============================================================
# ADD ITEM TO WISHLIST
# ============================================================
@bp.route("", methods=["POST"])
@require_auth(optional=True)
def add_to_wishlist():
    """
    Add a product to the current user's or guest's wishlist.
    Auto-creates a wishlist if it doesn't exist.
    """
    body = request.get_json(force=True) or {}
    product_id = body.get("product_id")

    if not product_id:
        return jsonify({"error": "Missing product_id"}), 400

    try:
        user_id, guest_id = get_context()
        result = wishlist_service.add_to_wishlist(product_id, user_id, guest_id)
        status = 201 if result.get("status") == "success" else 400
        return jsonify(result), status
    except Exception as e:
        logging.exception("[Wishlist] Failed to add product")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


# ============================================================
# REMOVE ITEM FROM WISHLIST
# ============================================================
@bp.route("/<int:product_id>", methods=["DELETE"])
@require_auth(optional=True)
def remove_from_wishlist(product_id):
    """
    Remove a product from the current user's or guest's wishlist.
    """
    try:
        user_id, guest_id = get_context()
        result = wishlist_service.remove_from_wishlist(product_id, user_id, guest_id)
        return jsonify(result), 200
    except Exception as e:
        logging.exception("[Wishlist] Failed to remove product")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


# ============================================================
# GET WISHLIST ITEMS
# ============================================================
@bp.route("", methods=["GET"])
@require_auth(optional=True)
def get_wishlist():
    """
    Retrieve wishlist for the current user or guest.
    Structure:
    {
        "wishlist_id": ...,
        "count": ...,
        "items": [...]
    }
    """
    try:
        user_id, guest_id = get_context()
        data = wishlist_service.get_wishlist(user_id, guest_id)
        return jsonify(data), 200
    except Exception as e:
        logging.exception("[Wishlist] Failed to get wishlist")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


# ============================================================
# GET WISHLIST COUNT
# ============================================================
@bp.route("/count", methods=["GET"])
@require_auth(optional=True)
def get_wishlist_count():
    """
    Return total number of wishlist items for the current user or guest.
    """
    try:
        user_id, guest_id = get_context()
        count = wishlist_service.get_count(user_id, guest_id)
        return jsonify({"count": count}), 200
    except Exception as e:
        logging.exception("[Wishlist] Failed to get count")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


# ============================================================
# CLEAR ENTIRE WISHLIST
# ============================================================
@bp.route("/clear", methods=["DELETE"])
@require_auth(optional=True)
def clear_wishlist():
    """
    Remove all wishlist items for the current user or guest.
    """
    try:
        user_id, guest_id = get_context()
        result = wishlist_service.clear_wishlist(user_id, guest_id)
        return jsonify(result), 200
    except Exception as e:
        logging.exception("[Wishlist] Failed to clear wishlist")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


# ============================================================
# MOVE ITEM TO CART
# ============================================================
@bp.route("/move-to-cart", methods=["POST"])
@require_auth(optional=True)
def move_to_cart():
    """
    Move an item from wishlist to cart.
    Requires product_id and variant_id.
    """
    body = request.get_json(force=True) or {}
    product_id = body.get("product_id")
    variant_id = body.get("variant_id")

    if not product_id or not variant_id:
        return jsonify({"error": "Missing product_id or variant_id"}), 400

    try:
        user_id, guest_id = get_context()
        result = wishlist_service.move_to_cart(product_id, variant_id, user_id, guest_id)
        return jsonify(result), 200
    except Exception as e:
        logging.exception("[Wishlist] Failed to move item to cart")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


# ============================================================
# MERGE GUEST WISHLIST (DEPRECATED)
# ============================================================
@bp.route("/merge", methods=["POST"])
@require_auth(optional=True)
def merge_guest_wishlist():
    """
    Deprecated.
    Wishlist merging is handled automatically during login.
    Left in place for backward compatibility.
    """
    return jsonify({"status": "deprecated", "message": "Handled by login merge"}), 410


# ============================================================
# ARCHIVE WISHLIST (ADMIN / CLEANUP)
# ============================================================
@bp.route("/<int:wishlist_id>/archive", methods=["POST"])
@require_auth(optional=True)
def archive_wishlist(wishlist_id):
    """
    Archive a wishlist (admin/automation).
    """
    try:
        result = wishlist_service.archive_wishlist(wishlist_id)
        return jsonify(result), 200
    except Exception as e:
        logging.exception("[Wishlist] Failed to archive wishlist")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
