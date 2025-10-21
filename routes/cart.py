# routes/cart.py — Vakaadha Cart API v2
import logging
import os
from uuid import uuid4
from flask import Blueprint, request, jsonify, make_response
from domain.cart import service as cart_service

cart_bp = Blueprint("cart", __name__)

# =============================================================
# Helpers
# =============================================================
def _json_error(code, error, message):
    return jsonify({"error": error, "message": message}), code


def _parse_json(required=None):
    """Validate JSON body and return dict or error."""
    try:
        data = request.get_json(force=True)
    except Exception:
        return None, _json_error(400, "BadRequest", "Malformed JSON")
    if required:
        for field in required:
            if field not in data:
                return None, _json_error(400, "BadRequest", f"Missing field: {field}")
    return data, None


def _get_guest_id():
    gid = request.cookies.get("guest_id") or request.args.get("guest_id")
    if not gid or len(gid) > 64:
        gid = str(uuid4())
    return gid


def _set_guest_cookie(resp, guest_id):
    is_https = request.is_secure or os.getenv("FORCE_SECURE_COOKIE") == "1"
    resp.set_cookie(
        "guest_id",
        guest_id,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=is_https,
        samesite="Lax",
    )
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    resp.headers["Access-Control-Expose-Headers"] = "Set-Cookie"
    return resp


# =============================================================
# Routes
# =============================================================

@cart_bp.route("/api/cart", methods=["GET"])
def get_cart():
    """Return current cart (guest or user)."""
    guest_id = _get_guest_id()
    try:
        cart_info = cart_service.ensure_cart_for_guest(guest_id)
        cart_data = cart_service.fetch_cart(cart_info["cart_id"])
        resp = make_response(jsonify(cart_data))
        return _set_guest_cookie(resp, cart_info["guest_id"])
    except cart_service.GuestCartExpired:
        return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
    except Exception as e:
        logging.exception("Cart GET failed")
        return _json_error(500, "ServerError", str(e))


@cart_bp.route("/api/cart", methods=["POST"])
def add_to_cart():
    """Add a product variant to cart."""
    data, err = _parse_json(["variant_id", "quantity"])
    if err:
        return err

    variant_id = data.get("variant_id")
    quantity = data.get("quantity")
    guest_id = _get_guest_id()

    try:
        cart_info = cart_service.ensure_cart_for_guest(guest_id)
        cart_data = cart_service.add_item(cart_info["cart_id"], int(variant_id), int(quantity))
        resp = make_response(jsonify(cart_data))
        return _set_guest_cookie(resp, cart_info["guest_id"])
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
def patch_cart_item():
    """Update quantity for existing item."""
    data, err = _parse_json(["cart_item_id", "quantity"])
    if err:
        return err
    guest_id = _get_guest_id()

    try:
        cart_info = cart_service.ensure_cart_for_guest(guest_id)
        cart_data = cart_service.update_item_quantity(
            cart_info["cart_id"],
            int(data["cart_item_id"]),
            int(data["quantity"])
        )
        resp = make_response(jsonify(cart_data))
        return _set_guest_cookie(resp, cart_info["guest_id"])
    except cart_service.GuestCartExpired:
        return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
    except cart_service.InsufficientStockError:
        return _json_error(409, "OutOfStock", "Item exceeds available stock")
    except Exception as e:
        logging.exception("Cart PATCH failed")
        return _json_error(500, "ServerError", str(e))


@cart_bp.route("/api/cart/<int:cart_item_id>", methods=["DELETE"])
def delete_cart_item(cart_item_id):
    """Remove a single cart item."""
    guest_id = _get_guest_id()
    try:
        cart_info = cart_service.ensure_cart_for_guest(guest_id)
        cart_data = cart_service.remove_item(cart_info["cart_id"], cart_item_id)
        resp = make_response(jsonify(cart_data))
        return _set_guest_cookie(resp, cart_info["guest_id"])
    except cart_service.GuestCartExpired:
        return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
    except Exception as e:
        logging.exception("Cart DELETE failed")
        return _json_error(500, "ServerError", str(e))


@cart_bp.route("/api/cart/clear", methods=["DELETE"])
def clear_cart():
    """Clear all cart items."""
    guest_id = _get_guest_id()
    try:
        cart_info = cart_service.ensure_cart_for_guest(guest_id)
        cart_service.clear_cart(cart_info["cart_id"])
        resp = make_response(jsonify({"status": "cleared"}))
        return _set_guest_cookie(resp, cart_info["guest_id"])
    except cart_service.GuestCartExpired:
        return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
    except Exception as e:
        logging.exception("Cart clear failed")
        return _json_error(500, "ServerError", str(e))


@cart_bp.route("/api/cart/audit", methods=["GET"])
def get_cart_audit():
    """Return recent audit logs for the current guest/user cart."""
    guest_id = _get_guest_id()
    try:
        cart_info = cart_service.ensure_cart_for_guest(guest_id)
        audit_log = cart_service.get_audit_log(cart_info["cart_id"])
        return jsonify({"cart_id": cart_info["cart_id"], "events": audit_log})
    except cart_service.GuestCartExpired:
        return _json_error(410, "GuestCartExpired", "Guest cart TTL expired")
    except Exception as e:
        logging.exception("Cart audit fetch failed")
        return _json_error(500, "ServerError", str(e))
