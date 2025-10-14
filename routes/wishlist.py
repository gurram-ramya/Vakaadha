# routes/wishlist.py

import logging
from flask import Blueprint, jsonify, request, g
from ..utils.auth import require_auth
from ..db import get_db_connection
from ..domain.wishlist import service as wishlist_service

wishlist_bp = Blueprint("wishlist", __name__, url_prefix="/api/wishlist")

# -------------------------------------------------------------
# GET /api/wishlist
# Return full wishlist with enriched product data
# -------------------------------------------------------------
@wishlist_bp.route("", methods=["GET"])
@require_auth()
def get_wishlist():
    try:
        conn = get_db_connection()
        user_id = g.user["user_id"]

        wishlist_items = wishlist_service.get_user_wishlist(conn, user_id)
        return jsonify(wishlist_items), 200

    except Exception as e:
        logging.exception("Error in GET /api/wishlist")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()


# -------------------------------------------------------------
# GET /api/wishlist/count
# Return wishlist item count
# -------------------------------------------------------------
@wishlist_bp.route("/count", methods=["GET"])
@require_auth()
def get_wishlist_count():
    try:
        conn = get_db_connection()
        user_id = g.user["user_id"]

        count = wishlist_service.get_user_wishlist_count(conn, user_id)
        return jsonify({"count": count}), 200

    except Exception as e:
        logging.exception("Error in GET /api/wishlist/count")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()


# -------------------------------------------------------------
# POST /api/wishlist
# Add a product to wishlist
# -------------------------------------------------------------
@wishlist_bp.route("", methods=["POST"])
@require_auth()
def add_to_wishlist():
    try:
        conn = get_db_connection()
        user_id = g.user["user_id"]

        data = request.get_json(silent=True) or {}
        product_id = data.get("product_id")

        if not product_id:
            return jsonify({"error": "invalid_request", "message": "Missing product_id"}), 400

        result = wishlist_service.add_to_wishlist(conn, user_id, product_id)
        conn.commit()

        logging.info({
            "event": "wishlist_add",
            "user_id": user_id,
            "product_id": product_id
        })

        return jsonify(result), 201

    except Exception as e:
        logging.exception("Error in POST /api/wishlist")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()


# -------------------------------------------------------------
# DELETE /api/wishlist/<product_id>
# Remove product from wishlist
# -------------------------------------------------------------
@wishlist_bp.route("/<int:product_id>", methods=["DELETE"])
@require_auth()
def remove_from_wishlist(product_id):
    try:
        conn = get_db_connection()
        user_id = g.user["user_id"]

        result = wishlist_service.remove_from_wishlist(conn, user_id, product_id)
        conn.commit()

        logging.info({
            "event": "wishlist_remove",
            "user_id": user_id,
            "product_id": product_id
        })

        return jsonify(result), 200

    except Exception as e:
        logging.exception("Error in DELETE /api/wishlist/<product_id>")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()


# -------------------------------------------------------------
# POST /api/wishlist/merge
# Merge guest wishlist into user account
# -------------------------------------------------------------
@wishlist_bp.route("/merge", methods=["POST"])
@require_auth()
def merge_wishlist():
    try:
        conn = get_db_connection()
        user_id = g.user["user_id"]

        data = request.get_json(silent=True) or {}
        items = data.get("items", [])

        if not isinstance(items, list):
            return jsonify({"error": "invalid_request", "message": "items must be a list"}), 400

        result = wishlist_service.merge_guest_wishlist(conn, user_id, items)
        conn.commit()

        logging.info({
            "event": "wishlist_merge",
            "user_id": user_id,
            "items_added": result.get("items_added", 0),
            "items_skipped": result.get("items_skipped", 0)
        })

        return jsonify(result), 200

    except Exception as e:
        logging.exception("Error in POST /api/wishlist/merge")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()
