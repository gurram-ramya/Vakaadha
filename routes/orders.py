# minimal code for the place holder

from flask import Blueprint, jsonify, g
from utils.auth import require_auth
from domain.orders import service as orders

bp = Blueprint("orders", __name__)

@bp.post("/checkout/place")
@require_auth
def place_order():
    data = orders.place_order(g.user["user_id"])
    return jsonify(data), 201
