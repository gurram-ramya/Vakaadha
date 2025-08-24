# routes/orders.py
from flask import Blueprint, jsonify, g, request
from utils.auth import require_auth
from domain.orders import service as orders

bp = Blueprint("orders", __name__, url_prefix="/users/me/orders")

@bp.post("/checkout")
@require_auth
def checkout():
    try:
        body = request.get_json(force=True)
        address_id = body.get("address_id")
        payment_method = body.get("payment_method")
        if not address_id or not payment_method:
            return jsonify({"error": "Missing address or payment_method"}), 400

        data = orders.checkout(g.user["user_id"], address_id, payment_method)
        return jsonify(data), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        if str(e) == "insufficient_stock":
            return jsonify({"error": "insufficient_stock"}), 409
        raise

@bp.get("")
@require_auth
def list_orders():
    data = orders.list_orders(g.user["user_id"])
    return jsonify(data), 200
