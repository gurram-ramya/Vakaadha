# # routes/addresses.py — robust, consistent with cart/wishlist behavior
# import logging
# from flask import Blueprint, jsonify, request, g
# from utils.auth import require_auth
# from domain.addresses import repository, service

# addresses_bp = Blueprint("addresses", __name__, url_prefix="/api/addresses")


# # ===========================================================
# # Helpers
# # ===========================================================
# def _json_error(code, error, message=None):
#     payload = {"error": error}
#     if message:
#         payload["message"] = message
#     return jsonify(payload), code


# def _get_user_id():
#     """Return user_id if authenticated; else None."""
#     user = getattr(g, "user", None)
#     if not user or not isinstance(user, dict):
#         return None
#     return user.get("user_id")


# # ===========================================================
# # GET /api/addresses
# # ===========================================================
# @addresses_bp.route("", methods=["GET"])
# @require_auth(optional=True)
# def list_addresses():
#     """List all saved addresses for authenticated user."""
#     user_id = _get_user_id()
#     if not user_id:
#         # Not logged in — consistent with wishlist/cart behavior
#         return jsonify([]), 200

#     try:
#         rows = repository.list_addresses(user_id)
#         return jsonify(rows or []), 200
#     except Exception as e:
#         logging.exception("Failed to list addresses")
#         return _json_error(500, "server_error", str(e))


# # ===========================================================
# # POST /api/addresses
# # ===========================================================
# @addresses_bp.route("", methods=["POST"])
# @require_auth(optional=True)
# def create_address():
#     """Create a new address (requires authenticated user)."""
#     user_id = _get_user_id()
#     if not user_id:
#         return _json_error(401, "unauthorized", "Please log in to manage addresses")

#     data = request.get_json(silent=True) or {}
#     valid, result = service.validate_address(data)
#     if not valid:
#         return _json_error(400, "validation_failed", result)

#     try:
#         created = repository.create_address(user_id, result)
#         return jsonify(created), 201
#     except Exception as e:
#         logging.exception("Failed to create address")
#         return _json_error(500, "server_error", str(e))


# # ===========================================================
# # PUT /api/addresses/<id>
# # ===========================================================
# @addresses_bp.route("/<int:address_id>", methods=["PUT"])
# @require_auth(optional=True)
# def update_address(address_id):
#     """Update an existing address (user-only)."""
#     user_id = _get_user_id()
#     if not user_id:
#         return _json_error(401, "unauthorized", "Please log in to manage addresses")

#     data = request.get_json(silent=True) or {}
#     valid, result = service.validate_address(data)
#     if not valid:
#         return _json_error(400, "validation_failed", result)

#     try:
#         existing = repository.get_address_by_id(user_id, address_id)
#         if not existing:
#             return _json_error(404, "not_found", "Address not found")

#         updated = repository.update_address(user_id, address_id, result)
#         return jsonify(updated), 200
#     except Exception as e:
#         logging.exception("Failed to update address")
#         return _json_error(500, "server_error", str(e))


# # ===========================================================
# # DELETE /api/addresses/<id>
# # ===========================================================
# @addresses_bp.route("/<int:address_id>", methods=["DELETE"])
# @require_auth(optional=True)
# def delete_address(address_id):
#     """Delete an address for current user."""
#     user_id = _get_user_id()
#     if not user_id:
#         return _json_error(401, "unauthorized", "Please log in to manage addresses")

#     try:
#         ok = repository.delete_address(user_id, address_id)
#         if not ok:
#             return _json_error(404, "not_found", "Address not found")
#         return jsonify({"success": True}), 200
#     except Exception as e:
#         logging.exception("Failed to delete address")
#         return _json_error(500, "server_error", str(e))


# # ===========================================================
# # PATCH /api/addresses/<id>/default
# # ===========================================================
# @addresses_bp.route("/<int:address_id>/default", methods=["PATCH"])
# @require_auth(optional=True)
# def set_default_address(address_id):
#     """Set an address as default (user-only)."""
#     user_id = _get_user_id()
#     if not user_id:
#         return _json_error(401, "unauthorized", "Please log in to manage addresses")

#     try:
#         existing = repository.get_address_by_id(user_id, address_id)
#         if not existing:
#             return _json_error(404, "not_found", "Address not found")

#         repository.set_default_address(user_id, address_id)
#         return jsonify({"success": True}), 200
#     except Exception as e:
#         logging.exception("Failed to set default address")
#         return _json_error(500, "server_error", str(e))

# # ===========================================================
# # GET /api/addresses/<id>
# # ===========================================================
# @addresses_bp.route("/<int:address_id>", methods=["GET"])
# @require_auth(optional=True)
# def get_single_address(address_id):
#     """Fetch a single address by ID for the current user."""
#     user_id = _get_user_id()
#     if not user_id:
#         return _json_error(401, "unauthorized", "Please log in to manage addresses")

#     try:
#         addr = repository.get_address_by_id(user_id, address_id)
#         if not addr:
#             return _json_error(404, "not_found", "Address not found")
#         return jsonify(addr), 200
#     except Exception as e:
#         logging.exception("Failed to fetch address by ID")
#         return _json_error(500, "server_error", str(e))


# ---------------- pgsql ---------------

import logging
from flask import Blueprint, jsonify, request, g
from utils.auth import require_auth
from domain.addresses import repository, service

addresses_bp = Blueprint("addresses", __name__, url_prefix="/api/addresses")

def _json_error(code, error, message=None):
    payload = {"error": error}
    if message:
        payload["message"] = message
    return jsonify(payload), code

def _get_user_id():
    user = getattr(g, "user", None)
    if not user or not isinstance(user, dict):
        return None
    return user.get("user_id")

@addresses_bp.route("", methods=["GET"])
@require_auth(optional=True)
def list_addresses():
    user_id = _get_user_id()
    if not user_id:
        return jsonify([]), 200
    try:
        rows = repository.list_addresses(user_id)
        return jsonify(rows or []), 200
    except Exception as e:
        logging.exception("Failed to list addresses")
        return _json_error(500, "server_error", str(e))

@addresses_bp.route("", methods=["POST"])
@require_auth(optional=True)
def create_address():
    user_id = _get_user_id()
    if not user_id:
        return _json_error(401, "unauthorized", "Please log in to manage addresses")

    data = request.get_json(silent=True) or {}
    valid, cleaned = service.validate_address(data)
    if not valid:
        return _json_error(400, "validation_failed", cleaned)

    try:
        created = repository.create_address(user_id, cleaned)
        return jsonify(created), 201
    except Exception as e:
        logging.exception("Failed to create address")
        return _json_error(500, "server_error", str(e))

@addresses_bp.route("/<int:address_id>", methods=["PUT"])
@require_auth(optional=True)
def update_address(address_id):
    user_id = _get_user_id()
    if not user_id:
        return _json_error(401, "unauthorized", "Please log in to manage addresses")

    data = request.get_json(silent=True) or {}
    valid, cleaned = service.validate_address(data)
    if not valid:
        return _json_error(400, "validation_failed", cleaned)

    try:
        existing = repository.get_address_by_id(user_id, address_id)
        if not existing:
            return _json_error(404, "not_found", "Address not found")

        updated = repository.update_address(user_id, address_id, cleaned)
        return jsonify(updated), 200
    except Exception as e:
        logging.exception("Failed to update address")
        return _json_error(500, "server_error", str(e))

@addresses_bp.route("/<int:address_id>", methods=["DELETE"])
@require_auth(optional=True)
def delete_address(address_id):
    user_id = _get_user_id()
    if not user_id:
        return _json_error(401, "unauthorized", "Please log in to manage addresses")

    try:
        ok = repository.delete_address(user_id, address_id)
        if not ok:
            return _json_error(404, "not_found", "Address not found")
        return jsonify({"success": True}), 200
    except Exception as e:
        logging.exception("Failed to delete address")
        return _json_error(500, "server_error", str(e))

@addresses_bp.route("/<int:address_id>/default", methods=["PATCH"])
@require_auth(optional=True)
def set_default_address(address_id):
    user_id = _get_user_id()
    if not user_id:
        return _json_error(401, "unauthorized", "Please log in to manage addresses")

    try:
        existing = repository.get_address_by_id(user_id, address_id)
        if not existing:
            return _json_error(404, "not_found", "Address not found")

        repository.set_default_address(user_id, address_id)
        return jsonify({"success": True}), 200
    except Exception as e:
        logging.exception("Failed to set default address")
        return _json_error(500, "server_error", str(e))

@addresses_bp.route("/<int:address_id>", methods=["GET"])
@require_auth(optional=True)
def get_single_address(address_id):
    user_id = _get_user_id()
    if not user_id:
        return _json_error(401, "unauthorized", "Please log in to manage addresses")

    try:
        addr = repository.get_address_by_id(user_id, address_id)
        if not addr:
            return _json_error(404, "not_found", "Address not found")
        return jsonify(addr), 200
    except Exception as e:
        logging.exception("Failed to fetch address by ID")
        return _json_error(500, "server_error", str(e))
