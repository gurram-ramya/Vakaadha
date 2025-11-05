# routes/addresses.py
# import logging
# from flask import Blueprint, jsonify, request, g
# from db import get_db_connection
# from utils.auth import require_auth
# from domain.addresses import service as address_service

# routes/addresses.py
# routes/addresses.py
from flask import Blueprint, jsonify, request, g
from domain.addresses import service
from utils.auth import require_auth

addresses_bp = Blueprint("addresses", __name__, url_prefix="/api/addresses")

# -----------------------------
# Address Routes — REST Endpoints
# -----------------------------

@addresses_bp.get("")
@require_auth()
def list_addresses():
    user_id = g.user["user_id"]
    items = service.list_addresses(g.db, user_id)
    return jsonify(items), 200


@addresses_bp.get("/<int:address_id>")
@require_auth()
def get_address(address_id):
    user_id = g.user["user_id"]
    try:
        addr = service.get_address(g.db, user_id, address_id)
        return jsonify(addr), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@addresses_bp.post("")
@require_auth()
def create_address():
    try:
        user = getattr(g, "user", None)
        if not user or "user_id" not in user:
            return jsonify({"error": "unauthorized"}), 401

        user_id = user["user_id"]
        payload = request.get_json(force=True) or {}
        if not isinstance(payload, dict):
            return jsonify({"error": "Invalid JSON payload"}), 400

        required = ["name", "phone", "line1", "city", "state", "pincode"]
        missing = [f for f in required if not payload.get(f)]
        if missing:
            return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

        new_addr = service.create_address(g.db, user_id, payload)
        return jsonify(new_addr), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": "internal_error", "detail": str(e)}), 500


@addresses_bp.put("/<int:address_id>")
@require_auth()
def update_address(address_id):
    user_id = g.user["user_id"]
    payload = request.get_json(force=True)
    try:
        updated = service.update_address(g.db, user_id, address_id, payload)
        return jsonify(updated), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@addresses_bp.delete("/<int:address_id>")
@require_auth()
def delete_address(address_id):
    user_id = g.user["user_id"]
    try:
        service.delete_address(g.db, user_id, address_id)
        return jsonify({"status": "deleted"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@addresses_bp.post("/<int:address_id>/default")
@require_auth()
def set_default(address_id):
    user_id = g.user["user_id"]
    try:
        addr = service.set_default(g.db, user_id, address_id)
        return jsonify(addr), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404





