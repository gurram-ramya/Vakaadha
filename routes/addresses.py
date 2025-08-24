from flask import Blueprint, jsonify, g, request
from utils.auth import require_auth
from domain.addresses import service as addresses

bp = Blueprint("addresses", __name__, url_prefix="/users/me/addresses")

@bp.get("")
@require_auth
def list_addresses():
    data = addresses.list_addresses(g.user["user_id"])
    return jsonify(data), 200

@bp.post("")
@require_auth
def add_address():
    body = request.get_json(force=True)
    required = ["full_name", "phone", "line1", "city", "zip"]
    if not all(body.get(f) for f in required):
        return jsonify({"error": "Missing required fields"}), 400

    result = addresses.add_address(g.user["user_id"], body)
    return jsonify(result), 201
