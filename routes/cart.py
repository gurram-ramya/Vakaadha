# # routes/cart.py — Unified Guest + User Cart API v3
# import logging
# from flask import Blueprint, request, jsonify, make_response, g
# from domain.cart import service as cart_service
# from utils.auth import require_auth, _set_guest_cookie

# cart_bp = Blueprint("cart", __name__)

# # =============================================================
# # Helpers
# # =============================================================
# def _json_error(code, error, message):
#     return jsonify({"error": error, "message": message}), code


# def _parse_json(required=None):
#     """Validate JSON body and return dict or error."""
#     try:
#         data = request.get_json(force=True)
#     except Exception:
#         return None, _json_error(400, "BadRequest", "Malformed JSON")
#     if required:
#         for field in required:
#             if field not in data:
#                 return None, _json_error(400, "BadRequest", f"Missing field: {field}")
#     return data, None


# def get_context():
#     """Resolve user_id vs guest_id based on auth state."""
#     user = getattr(g, "user", None)
#     user_id = user.get("user_id") if user else None
#     guest_id = None if user_id else getattr(g, "guest_id", None)
#     return user_id, guest_id



# # =============================================================
# # GET CART
# # =============================================================
# @cart_bp.route("/api/cart", methods=["GET"])
# @require_auth(optional=True)
# def get_cart():
#     """Return current cart (guest or user)."""
#     try:
#         user_id, guest_id = get_context()
#         if user_id:
#             cart_info = cart_service.ensure_cart_for_user(user_id)
#         else:
#             cart_info = cart_service.ensure_cart_for_guest(guest_id)

#         cart_data = cart_service.fetch_cart(cart_info["cart_id"])
#         resp = make_response(jsonify(cart_data))

#         if not user_id and getattr(g, "new_guest", False):
#             _set_guest_cookie(resp, cart_info["guest_id"], replace=True)

#         return resp

#     except cart_service.GuestCartExpired:
#         return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
#     except Exception as e:
#         logging.exception("Cart GET failed")
#         return _json_error(500, "ServerError", str(e))


# # =============================================================
# # ADD TO CART
# # =============================================================
# @cart_bp.route("/api/cart", methods=["POST"])
# @require_auth(optional=True)
# def add_to_cart():
#     """Add a product variant to the cart (guest or user)."""
#     data, err = _parse_json(["variant_id", "quantity"])
#     if err:
#         return err

#     variant_id = int(data["variant_id"])
#     quantity = int(data["quantity"])

#     try:
#         user_id, guest_id = get_context()
#         if user_id:
#             cart_info = cart_service.ensure_cart_for_user(user_id)
#         else:
#             cart_info = cart_service.ensure_cart_for_guest(guest_id)

#         cart_data = cart_service.add_item(cart_info["cart_id"], variant_id, quantity)
#         resp = make_response(jsonify(cart_data))
#         if not user_id and getattr(g, "new_guest", False):
#             _set_guest_cookie(resp, cart_info["guest_id"], replace=True)

#         return resp

#     except cart_service.GuestCartExpired:
#         return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
#     except cart_service.InsufficientStockError:
#         return _json_error(409, "OutOfStock", "Requested item is out of stock")
#     except cart_service.InvalidVariantError:
#         return _json_error(400, "InvalidVariant", "Variant not found")
#     except cart_service.InvalidQuantityError:
#         return _json_error(400, "InvalidQuantity", "Quantity must be positive")
#     except Exception as e:
#         logging.exception("Add to cart failed")
#         return _json_error(500, "ServerError", str(e))


# # =============================================================
# # PATCH CART ITEM
# # =============================================================
# @cart_bp.route("/api/cart", methods=["PATCH"])
# @require_auth(optional=True)
# def patch_cart_item():
#     """Update quantity for existing cart item."""
#     data, err = _parse_json(["cart_item_id", "quantity"])
#     if err:
#         return err

#     try:
#         user_id, guest_id = get_context()
#         if user_id:
#             cart_info = cart_service.ensure_cart_for_user(user_id)
#         else:
#             cart_info = cart_service.ensure_cart_for_guest(guest_id)

#         cart_data = cart_service.update_item_quantity(
#             cart_info["cart_id"],
#             int(data["cart_item_id"]),
#             int(data["quantity"])
#         )
#         resp = make_response(jsonify(cart_data))

#         if not user_id and getattr(g, "new_guest", False):
#             _set_guest_cookie(resp, cart_info["guest_id"], replace=True)

#         return resp

#     except cart_service.GuestCartExpired:
#         return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
#     except cart_service.InsufficientStockError:
#         return _json_error(409, "OutOfStock", "Item exceeds available stock")
#     except Exception as e:
#         logging.exception("Cart PATCH failed")
#         return _json_error(500, "ServerError", str(e))


# # =============================================================
# # DELETE CART ITEM
# # =============================================================
# @cart_bp.route("/api/cart/<int:cart_item_id>", methods=["DELETE"])
# @require_auth(optional=True)
# def delete_cart_item(cart_item_id):
#     """Remove a single item from the cart."""
#     try:
#         user_id, guest_id = get_context()
#         if user_id:
#             cart_info = cart_service.ensure_cart_for_user(user_id)
#         else:
#             cart_info = cart_service.ensure_cart_for_guest(guest_id)

#         cart_data = cart_service.remove_item(cart_info["cart_id"], cart_item_id)
#         resp = make_response(jsonify(cart_data))

#         if not user_id and getattr(g, "new_guest", False):
#             _set_guest_cookie(resp, cart_info["guest_id"], replace=True)


#         return resp

#     except cart_service.GuestCartExpired:
#         return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
#     except Exception as e:
#         logging.exception("Cart DELETE failed")
#         return _json_error(500, "ServerError", str(e))


# # =============================================================
# # CLEAR CART
# # =============================================================
# @cart_bp.route("/api/cart/clear", methods=["DELETE"])
# @require_auth(optional=True)
# def clear_cart():
#     """Clear all cart items."""
#     try:
#         user_id, guest_id = get_context()
#         if user_id:
#             cart_info = cart_service.ensure_cart_for_user(user_id)
#         else:
#             cart_info = cart_service.ensure_cart_for_guest(guest_id)

#         cart_service.clear_cart(cart_info["cart_id"])
#         resp = make_response(jsonify({"status": "cleared"}))

#         if not user_id and getattr(g, "new_guest", False):
#             _set_guest_cookie(resp, cart_info["guest_id"], replace=True)


#         return resp

#     except cart_service.GuestCartExpired:
#         return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
#     except Exception as e:
#         logging.exception("Cart clear failed")
#         return _json_error(500, "ServerError", str(e))


# # =============================================================
# # GET CART AUDIT LOG
# # =============================================================
# @cart_bp.route("/api/cart/audit", methods=["GET"])
# @require_auth(optional=True)
# def get_cart_audit():
#     """Return recent audit logs for the current cart."""
#     try:
#         user_id, guest_id = get_context()
#         if user_id:
#             cart_info = cart_service.ensure_cart_for_user(user_id)
#         else:
#             cart_info = cart_service.ensure_cart_for_guest(guest_id)

#         audit_log = cart_service.get_audit_log(cart_info["cart_id"])
#         resp = make_response(jsonify({"cart_id": cart_info["cart_id"], "events": audit_log}))

#         if not user_id and getattr(g, "new_guest", False):
#             _set_guest_cookie(resp, cart_info["guest_id"], replace=True)

#         return resp

#     except cart_service.GuestCartExpired:
#         return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
#     except Exception as e:
#         logging.exception("Cart audit fetch failed")
#         return _json_error(500, "ServerError", str(e))


# # =============================================================
# # MERGE GUEST CART (DEPRECATED)
# # =============================================================
# @cart_bp.route("/api/cart/merge", methods=["POST"])
# @require_auth(optional=True)
# def deprecated_cart_merge():
#     """Deprecated. Guest cart is now auto-merged during authentication."""
#     return jsonify({
#         "error": "deprecated",
#         "message": "Guest cart merge is handled automatically on login"
#     }), 410



# ----------------- pgsql -------------------

# routes/cart.py
import logging
from flask import Blueprint, request, jsonify, make_response, g
from domain.cart import service as cart_service
from utils.auth import require_auth, _set_guest_cookie

cart_bp = Blueprint("cart", __name__)


def _json_error(code, error, message):
    return jsonify({"error": error, "message": message}), code


def _parse_json(required=None):
    try:
        data = request.get_json(force=True)
    except Exception:
        return None, _json_error(400, "BadRequest", "Malformed JSON")
    if required:
        for f in required:
            if f not in data:
                return None, _json_error(400, "BadRequest", f"Missing field: {f}")
    return data, None


def get_context():
    user = getattr(g, "user", None)

    if user and "user_id" in user:
        return user["user_id"], None

    # use the resolved guest_id from require_auth
    guest_id = g.actor.get("guest_id")
    return None, guest_id


@cart_bp.route("/api/cart", methods=["GET"])
@require_auth(optional=True)
def get_cart():
    try:
        user_id, guest_id = get_context()
        info = cart_service.ensure_cart_for_user(user_id) if user_id else cart_service.ensure_cart_for_guest(guest_id)
        data = cart_service.fetch_cart(info["cart_id"])
        resp = make_response(jsonify(data))
        if not user_id and getattr(g, "new_guest", False):
            _set_guest_cookie(resp, info["guest_id"], replace=True)
        return resp
    except cart_service.GuestCartExpired:
        return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
    except Exception as e:
        logging.exception("Cart GET failed")
        return _json_error(500, "ServerError", str(e))


@cart_bp.route("/api/cart", methods=["POST"])
@require_auth(optional=True)
def add_to_cart():
    data, err = _parse_json(["variant_id", "quantity"])
    if err:
        return err
    try:
        user_id, guest_id = get_context()
        info = cart_service.ensure_cart_for_user(user_id) if user_id else cart_service.ensure_cart_for_guest(guest_id)
        cart = cart_service.add_item(info["cart_id"], int(data["variant_id"]), int(data["quantity"]))
        resp = make_response(jsonify(cart))
        if not user_id and getattr(g, "new_guest", False):
            _set_guest_cookie(resp, info["guest_id"], replace=True)
        return resp
    except cart_service.GuestCartExpired:
        return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
    except cart_service.InsufficientStockError:
        return _json_error(409, "OutOfStock", "Requested item is out of stock")
    except cart_service.InvalidVariantError:
        return _json_error(400, "InvalidVariant", "Variant not found")
    except cart_service.InvalidQuantityError:
        return _json_error(400, "InvalidQuantity", "Quantity must be positive")
    except Exception as e:
        logging.exception("Add to cart failed")
        return _json_error(500, "ServerError", str(e))


@cart_bp.route("/api/cart", methods=["PATCH"])
@require_auth(optional=True)
def patch_cart_item():
    data, err = _parse_json(["cart_item_id", "quantity"])
    if err:
        return err
    try:
        user_id, guest_id = get_context()
        info = cart_service.ensure_cart_for_user(user_id) if user_id else cart_service.ensure_cart_for_guest(guest_id)
        cart = cart_service.update_item_quantity(
            info["cart_id"],
            int(data["cart_item_id"]),
            int(data["quantity"])
        )
        resp = make_response(jsonify(cart))
        if not user_id and getattr(g, "new_guest", False):
            _set_guest_cookie(resp, info["guest_id"], replace=True)
        return resp
    except cart_service.GuestCartExpired:
        return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
    except Exception as e:
        logging.exception("Cart PATCH failed")
        return _json_error(500, "ServerError", str(e))


@cart_bp.route("/api/cart/<int:cart_item_id>", methods=["DELETE"])
@require_auth(optional=True)
def delete_cart_item(cart_item_id):
    try:
        user_id, guest_id = get_context()
        info = cart_service.ensure_cart_for_user(user_id) if user_id else cart_service.ensure_cart_for_guest(guest_id)
        cart = cart_service.remove_item(info["cart_id"], cart_item_id)
        resp = make_response(jsonify(cart))
        if not user_id and getattr(g, "new_guest", False):
            _set_guest_cookie(resp, info["guest_id"], replace=True)
        return resp
    except cart_service.GuestCartExpired:
        return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
    except Exception as e:
        logging.exception("Cart DELETE failed")
        return _json_error(500, "ServerError", str(e))


@cart_bp.route("/api/cart/clear", methods=["DELETE"])
@require_auth(optional=True)
def clear_cart():
    try:
        user_id, guest_id = get_context()
        info = cart_service.ensure_cart_for_user(user_id) if user_id else cart_service.ensure_cart_for_guest(guest_id)
        cart_service.clear_cart(info["cart_id"])
        resp = make_response(jsonify({"status": "cleared"}))
        if not user_id and getattr(g, "new_guest", False):
            _set_guest_cookie(resp, info["guest_id"], replace=True)
        return resp
    except cart_service.GuestCartExpired:
        return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
    except Exception as e:
        logging.exception("Cart clear failed")
        return _json_error(500, "ServerError", str(e))


# @cart_bp.route("/api/cart/audit", methods=["GET"])
# @require_auth(optional=True)
# def get_cart_audit():
#     try:
#         user_id, guest_id = get_context()
#         info = cart_service.ensure_cart_for_user(user_id) if user_id else cart_service.ensure_cart_for_guest(guest_id)
#         # events = cart_service.get_audit_log(info["cart_id"])
#         resp = make_response(jsonify({"cart_id": info["cart_id"], "events": events}))
#         if not user_id and getattr(g, "new_guest", False):
#             _set_guest_cookie(resp, info["guest_id"], replace=True)
#         return resp
#     except cart_service.GuestCartExpired:
#         return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
#     except Exception as e:
#         logging.exception("Cart audit fetch failed")
#         return _json_error(500, "ServerError", str(e))


@cart_bp.route("/api/cart/merge", methods=["POST"])
@require_auth(optional=True)
def deprecated_cart_merge():
    return jsonify({
        "error": "deprecated",
        "message": "Guest cart merge is handled automatically on login"
    }), 410
