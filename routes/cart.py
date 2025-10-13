# routes/cart.py

import logging
from flask import Blueprint, request, jsonify, make_response, g
from datetime import datetime
from ..domain.cart import service as cart_service
from ..utils.auth import require_auth
from uuid import uuid4

cart_bp = Blueprint("cart", __name__)

# -------------------------------------------------------------
# Helpers
# -------------------------------------------------------------
def _validate_request_data(required_fields):
    try:
        data = request.get_json(force=True)
        if not data:
            return None, "Request body must be JSON"
        for field in required_fields:
            if field not in data:
                return None, f"Missing required field: {field}"
        return data, None
    except Exception:
        return None, "Malformed JSON"


def _get_guest_id():
    guest_id = request.cookies.get("guest_id")
    if guest_id and isinstance(guest_id, str) and len(guest_id) <= 64:
        return guest_id
    return None


def _set_guest_cookie(response, guest_id):
    response.set_cookie(
        "guest_id",
        guest_id,
        max_age=604800,  # 7 days
        httponly=True,
        secure=True,
        samesite="Lax"
    )
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Expose-Headers"] = "Set-Cookie"
    return response


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
    return jsonify({"error": name, "message": msg}), code


# -------------------------------------------------------------
# Routes
# -------------------------------------------------------------
@cart_bp.route("/api/cart", methods=["GET"])
@require_auth(optional=True)
def get_cart():
    try:
        if hasattr(g, "user") and g.user:
            user_id = g.user["user_id"]
            result = cart_service.get_or_create_guest_cart(None)
            guest_id = result["guest_id"]
            user_cart = cart_service.get_cart_by_user(user_id)
            if not user_cart:
                cart_service.ensure_user_cart(user_id)
                cart_data = {"cart_id": None, "items": []}
            else:
                cart_data = cart_service.get_cart(user_cart["cart_id"])
            response = make_response(jsonify(cart_data))
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response

        guest_id = _get_guest_id()
        result = cart_service.get_or_create_guest_cart(guest_id)
        guest_id = result["guest_id"]
        cart_data = cart_service.get_cart(result["cart_id"])
        response = make_response(jsonify(cart_data))
        response = _set_guest_cookie(response, guest_id)
        return response

    except Exception as e:
        return _handle_error(e)


@cart_bp.route("/api/cart", methods=["POST"])
def add_to_cart():
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
        cart_id = cart_info["cart_id"]
        guest_id = cart_info["guest_id"]

        cart_data = cart_service.add_to_cart(cart_id, variant_id, quantity)
        response = make_response(jsonify(cart_data))
        response = _set_guest_cookie(response, guest_id)

        logging.info({
            "route": "/api/cart",
            "action": "add",
            "variant_id": variant_id,
            "quantity": quantity,
            "guest_id": guest_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        return response
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
        cart_id = cart_info["cart_id"]
        guest_id = cart_info["guest_id"]

        cart_data = cart_service.update_cart_item(cart_id, variant_id, quantity)
        response = make_response(jsonify(cart_data))
        response = _set_guest_cookie(response, guest_id)

        logging.info({
            "route": "/api/cart/update",
            "action": "update",
            "variant_id": variant_id,
            "quantity": quantity,
            "guest_id": guest_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        return response
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
        cart_id = cart_info["cart_id"]
        guest_id = cart_info["guest_id"]

        cart_data = cart_service.remove_cart_item(cart_id, variant_id)
        response = make_response(jsonify(cart_data))
        response = _set_guest_cookie(response, guest_id)

        logging.info({
            "route": "/api/cart/remove",
            "action": "remove",
            "variant_id": variant_id,
            "guest_id": guest_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        return response
    except Exception as e:
        return _handle_error(e)


@cart_bp.route("/api/cart/clear", methods=["POST"])
def clear_cart():
    guest_id = _get_guest_id()
    try:
        cart_info = cart_service.get_or_create_guest_cart(guest_id)
        cart_id = cart_info["cart_id"]
        guest_id = cart_info["guest_id"]

        cart_service.clear_cart(cart_id)
        response = make_response(jsonify({"status": "cleared", "cart_id": cart_id, "items": []}))
        response = _set_guest_cookie(response, guest_id)

        logging.info({
            "route": "/api/cart/clear",
            "action": "clear",
            "guest_id": guest_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        return response
    except Exception as e:
        return _handle_error(e)
