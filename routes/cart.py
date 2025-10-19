# routes/cart.py — final full version
import logging
import os
from uuid import uuid4
from datetime import datetime
from flask import Blueprint, request, jsonify, make_response
from domain.cart import service as cart_service

cart_bp = Blueprint("cart", __name__)

# =============================================================
# Helpers
# =============================================================
def _validate_request_data(required_fields):
    try:
        data = request.get_json(force=True)
        if not data:
            return None, "Request body must be JSON"
        for f in required_fields:
            if f not in data:
                return None, f"Missing required field: {f}"
        return data, None
    except Exception:
        return None, "Malformed JSON"

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

def _handle_error(e):
    mapping = {
        "InvalidVariantError": (400, "Variant not found"),
        "InvalidQuantityError": (400, "Quantity must be positive"),
        "InsufficientStockError": (409, "Out of stock"),
        "GuestCartNotFoundError": (404, "Guest cart not found"),
        "MergeConflictError": (500, "Cart merge conflict"),
        "DBError": (500, "Database operation failed"),
    }
    name = e.__class__.__name__
    code, msg = mapping.get(name, (500, str(e)))
    logging.error(f"[Cart API Error] {name}: {msg}")
    return jsonify({"error": name, "message": msg}), code

# =============================================================
# Routes
# =============================================================

@cart_bp.route("/api/cart", methods=["GET"])
def get_cart_route():
    guest_id = _get_guest_id()
    try:
        cart_info = cart_service.get_or_create_guest_cart(guest_id)
        cart_data = cart_service.get_cart(cart_info["cart_id"])
        resp = make_response(jsonify(cart_data))
        return _set_guest_cookie(resp, cart_info["guest_id"])
    except Exception as e:
        return _handle_error(e)

@cart_bp.route("/api/cart", methods=["POST"])
def add_to_cart_route():
    data, err = _validate_request_data(["variant_id", "quantity"])
    if err:
        return jsonify({"error": "BadRequest", "message": err}), 400
    try:
        variant_id = int(data["variant_id"])
        quantity = int(data["quantity"])
    except Exception:
        return jsonify({"error": "InvalidInput", "message": "variant_id and quantity must be integers"}), 400

    guest_id = _get_guest_id()
    try:
        cart_info = cart_service.get_or_create_guest_cart(guest_id)
        cart_data = cart_service.add_to_cart(cart_info["cart_id"], variant_id, quantity)
        resp = make_response(jsonify(cart_data))
        return _set_guest_cookie(resp, cart_info["guest_id"])
    except Exception as e:
        return _handle_error(e)

@cart_bp.route("/api/cart/update", methods=["POST"])
def update_cart_item():
    data, err = _validate_request_data(["variant_id", "quantity"])
    if err:
        return jsonify({"error": "BadRequest", "message": err}), 400
    try:
        variant_id = int(data["variant_id"])
        quantity = int(data["quantity"])
    except Exception:
        return jsonify({"error": "InvalidInput", "message": "variant_id and quantity must be integers"}), 400

    guest_id = _get_guest_id()
    try:
        cart_info = cart_service.get_or_create_guest_cart(guest_id)
        cart_data = cart_service.update_cart_item(cart_info["cart_id"], variant_id, quantity)
        resp = make_response(jsonify(cart_data))
        return _set_guest_cookie(resp, cart_info["guest_id"])
    except Exception as e:
        return _handle_error(e)

@cart_bp.route("/api/cart/remove", methods=["POST"])
def remove_cart_item():
    data, err = _validate_request_data(["variant_id"])
    if err:
        return jsonify({"error": "BadRequest", "message": err}), 400
    try:
        variant_id = int(data["variant_id"])
    except Exception:
        return jsonify({"error": "InvalidInput", "message": "variant_id must be integer"}), 400

    guest_id = _get_guest_id()
    try:
        cart_info = cart_service.get_or_create_guest_cart(guest_id)
        cart_data = cart_service.remove_cart_item(cart_info["cart_id"], variant_id)
        resp = make_response(jsonify(cart_data))
        return _set_guest_cookie(resp, cart_info["guest_id"])
    except Exception as e:
        return _handle_error(e)

@cart_bp.route("/api/cart/clear", methods=["POST"])
def clear_cart():
    guest_id = _get_guest_id()
    try:
        cart_info = cart_service.get_or_create_guest_cart(guest_id)
        cart_service.clear_cart(cart_info["cart_id"])
        resp = make_response(jsonify({"status": "cleared", "cart_id": cart_info["cart_id"], "items": []}))
        return _set_guest_cookie(resp, cart_info["guest_id"])
    except Exception as e:
        return _handle_error(e)
