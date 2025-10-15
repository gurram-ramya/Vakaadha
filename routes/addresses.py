# routes/addresses.py
import logging
from flask import Blueprint, jsonify, request, g
from db import get_db_connection
from utils.auth import require_auth
from domain.addresses import service as address_service

addresses_bp = Blueprint("addresses", __name__, url_prefix="/api/addresses")

# -------------------------------------------------------------
# GET /api/addresses
# -------------------------------------------------------------
@addresses_bp.route("", methods=["GET"])
@require_auth()
def list_addresses():
    conn = get_db_connection()
    try:
        user_id = g.user["user_id"]
        addresses = address_service.list_addresses(conn, user_id)
        return jsonify(addresses), 200
    except Exception as e:
        logging.exception("Error listing addresses")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()


# -------------------------------------------------------------
# POST /api/addresses
# -------------------------------------------------------------
@addresses_bp.route("", methods=["POST"])
@require_auth()
def add_address():
    conn = get_db_connection()
    try:
        user_id = g.user["user_id"]
        data = request.get_json(silent=True) or {}
        new_addr = address_service.add_address(conn, user_id, data)
        conn.commit()
        return jsonify(new_addr), 201
    except ValueError as e:
        conn.rollback()
        return jsonify({"error": "invalid_request", "message": str(e)}), 400
    except Exception as e:
        conn.rollback()
        logging.exception("Error adding address")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()


# -------------------------------------------------------------
# PUT /api/addresses/<id>
# -------------------------------------------------------------
@addresses_bp.route("/<int:address_id>", methods=["PUT"])
@require_auth()
def update_address(address_id):
    conn = get_db_connection()
    try:
        user_id = g.user["user_id"]
        data = request.get_json(silent=True) or {}
        updated = address_service.update_address(conn, user_id, address_id, data)
        if not updated:
            conn.rollback()
            return jsonify({"error": "not_found"}), 404
        conn.commit()
        return jsonify(updated), 200
    except Exception as e:
        conn.rollback()
        logging.exception("Error updating address")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()


# -------------------------------------------------------------
# DELETE /api/addresses/<id>
# -------------------------------------------------------------
@addresses_bp.route("/<int:address_id>", methods=["DELETE"])
@require_auth()
def delete_address(address_id):
    conn = get_db_connection()
    try:
        user_id = g.user["user_id"]
        deleted = address_service.delete_address(conn, user_id, address_id)
        conn.commit()
        if not deleted:
            return jsonify({"error": "not_found"}), 404
        return jsonify({"status": "deleted", "address_id": address_id}), 200
    except Exception as e:
        conn.rollback()
        logging.exception("Error deleting address")
        return jsonify({"error": "internal_error", "message": str(e)}), 500
    finally:
        conn.close()
