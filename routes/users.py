# routes/users.py
import logging
from flask import Blueprint, request, jsonify, g, make_response
from utils.auth import require_auth, _set_guest_cookie
from domain.users import service as user_service
from domain.cart import service as cart_service
from db import get_db_connection
from uuid import uuid4
from datetime import datetime

users_bp = Blueprint("users", __name__)

# -------------------------------------------------------------
# Helper: JSON error response
# -------------------------------------------------------------
def error_response(code, error, message=None):
    payload = {"error": error}
    if message:
        payload["message"] = message
    return jsonify(payload), code


# -------------------------------------------------------------
# POST /api/auth/register
# Authenticate user via Firebase and ensure DB consistency
# -------------------------------------------------------------
@users_bp.route("/api/auth/register", methods=["POST"], endpoint="register_user")
@require_auth()
def register_user():
    try:
        conn = get_db_connection()
        data = request.get_json(silent=True) or {}

        # Debug: show incoming user context
        logging.info({
            "event": "register_user_start",
            "firebase_uid": g.user.get("firebase_uid"),
            "email": g.user.get("email"),
            "guest_id_cookie": request.cookies.get("guest_id"),
            "guest_id_payload": data.get("guest_id"),
            "timestamp": datetime.utcnow().isoformat()
        })

        # Extract guest_id from context or payload
        guest_id = getattr(g, "guest_id", None) or request.cookies.get("guest_id") or data.get("guest_id")

        # Ensure user exists & merge guest cart if applicable
        user, merge_result = user_service.ensure_user_with_merge(
            conn=conn,
            firebase_uid=g.user["firebase_uid"],
            email=g.user["email"],
            name=g.user.get("name"),
            avatar_url=g.user.get("picture"),
            guest_id=guest_id,
            update_last_login=True,
        )

        # Debug: DB user creation / merge info
        logging.info({
            "event": "register_user_merge_done",
            "firebase_uid": g.user["firebase_uid"],
            "guest_id": guest_id,
            "db_user_id": user["user_id"],
            "merge_result": merge_result,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Response payload
        response = jsonify({
            "user": {
                "user_id": user["user_id"],
                "firebase_uid": user["firebase_uid"],
                "email": user["email"],
                "name": user["name"],
                "is_admin": user.get("is_admin", False),
                "email_verified": g.user.get("email_verified", False),
            },
            "merge": merge_result or None,
        })

        # Rotate guest cookie
        resp = make_response(response)
        if request.cookies.get("guest_id"):
            resp.delete_cookie("guest_id")
        _set_guest_cookie(resp, str(uuid4()))

        logging.info({
            "event": "register_user_success",
            "firebase_uid": g.user["firebase_uid"],
            "new_guest_cookie": True,
            "timestamp": datetime.utcnow().isoformat()
        })

        return resp, 200

    except user_service.TokenExpiredError:
        logging.warning({
            "event": "register_user_failed",
            "reason": "token_expired",
            "firebase_uid": g.user.get("firebase_uid"),
            "timestamp": datetime.utcnow().isoformat()
        })
        return error_response(401, "token_expired", "Firebase token expired")

    except user_service.InvalidTokenError:
        logging.warning({
            "event": "register_user_failed",
            "reason": "invalid_token",
            "firebase_uid": g.user.get("firebase_uid"),
            "timestamp": datetime.utcnow().isoformat()
        })
        return error_response(401, "invalid_token", "Invalid Firebase token")

    except Exception as e:
        logging.exception({
            "event": "register_user_exception",
            "error": str(e),
            "firebase_uid": getattr(g.user, "firebase_uid", None),
            "timestamp": datetime.utcnow().isoformat()
        })
        return error_response(500, "internal_error", str(e))

    finally:
        conn.close()


# -------------------------------------------------------------
# GET /api/auth/session
# Validate Firebase token and return current user session snapshot
# -------------------------------------------------------------
@users_bp.route("/api/auth/session", methods=["GET"], endpoint="session_info")
@require_auth()
def session_info():
    try:
        user = g.user
        logging.info({
            "event": "session_info",
            "firebase_uid": user.get("firebase_uid"),
            "email": user.get("email"),
            "timestamp": datetime.utcnow().isoformat()
        })
        return jsonify({
            "user_id": user.get("user_id"),
            "firebase_uid": user.get("firebase_uid"),
            "email": user.get("email"),
            "name": user.get("name"),
            "is_admin": user.get("is_admin", False),
            "email_verified": user.get("email_verified", False)
        }), 200
    except Exception as e:
        logging.exception("Error in /api/auth/session")
        return error_response(500, "internal_error", str(e))


# -------------------------------------------------------------
# GET /api/users/me
# Return full user and profile info
# -------------------------------------------------------------
@users_bp.route("/api/users/me", methods=["GET"], endpoint="get_user_profile")
@require_auth()
def get_user_profile():
    try:
        conn = get_db_connection()
        firebase_uid = g.user["firebase_uid"]
        logging.info({
            "event": "get_user_profile_start",
            "firebase_uid": firebase_uid,
            "timestamp": datetime.utcnow().isoformat()
        })

        user_profile = user_service.get_user_with_profile(conn, firebase_uid)
        if not user_profile:
            logging.warning({
                "event": "user_not_found",
                "firebase_uid": firebase_uid,
                "timestamp": datetime.utcnow().isoformat()
            })
            return error_response(404, "user_not_found")

        user_profile["email_verified"] = g.user.get("email_verified", False)

        logging.info({
            "event": "get_user_profile_success",
            "firebase_uid": firebase_uid,
            "user_id": user_profile.get("user_id"),
            "timestamp": datetime.utcnow().isoformat()
        })
        return jsonify(user_profile), 200
    except Exception as e:
        logging.exception("Error in /api/users/me")
        return error_response(500, "internal_error", str(e))
    finally:
        conn.close()


# -------------------------------------------------------------
# PUT /api/users/me/profile
# Update user profile fields
# -------------------------------------------------------------
@users_bp.route("/api/users/me/profile", methods=["PUT"], endpoint="update_user_profile")
@require_auth()
def update_user_profile():
    try:
        conn = get_db_connection()
        data = request.get_json(silent=True) or {}
        firebase_uid = g.user["firebase_uid"]

        logging.info({
            "event": "update_user_profile_start",
            "firebase_uid": firebase_uid,
            "payload_keys": list(data.keys()),
            "timestamp": datetime.utcnow().isoformat()
        })

        allowed_fields = {"name", "dob", "gender", "avatar_url"}
        for field in data.keys():
            if field not in allowed_fields:
                return error_response(400, "invalid_payload", f"Unexpected field: {field}")

        if "gender" in data and data["gender"] not in ["male", "female", "other", None, ""]:
            return error_response(400, "invalid_payload", "Invalid gender value")

        updated_profile = user_service.update_profile(conn, firebase_uid, data)
        logging.info({
            "event": "update_user_profile_success",
            "firebase_uid": firebase_uid,
            "updated_fields": list(data.keys()),
            "timestamp": datetime.utcnow().isoformat()
        })
        return jsonify(updated_profile), 200

    except Exception as e:
        logging.exception("Error in /api/users/me/profile")
        return error_response(500, "internal_error", str(e))
    finally:
        conn.close()


# -------------------------------------------------------------
# POST /api/auth/logout
# -------------------------------------------------------------
@users_bp.route("/api/auth/logout", methods=["POST"])
@require_auth(optional=True)
def logout_user():
    resp = jsonify({"status": "logged_out"})
    if request.cookies.get("guest_id"):
        resp.delete_cookie("guest_id")
    _set_guest_cookie(resp, str(uuid4()))

    logging.info({
        "event": "user_logout",
        "firebase_uid": getattr(g.user, "firebase_uid", None),
        "timestamp": datetime.utcnow().isoformat(),
    })
    return resp, 200


# -------------------------------------------------------------
# GET /api/cart/merge (Deprecated)
# -------------------------------------------------------------
@users_bp.route("/api/cart/merge", methods=["GET"], endpoint="deprecated_merge_endpoint")
@require_auth()
def deprecated_merge_endpoint():
    return jsonify({
        "error": "deprecated",
        "message": "Guest cart is now auto-merged during authentication",
        "use": "/api/auth/register"
    }), 410


# -------------------------------------------------------------
# USER PREFERENCES ROUTES
# -------------------------------------------------------------
from domain.users import preferences_service, payments_service

@users_bp.route("/api/users/me/preferences", methods=["GET"])
@require_auth()
def get_user_preferences():
    logging.info({
        "event": "get_user_preferences",
        "firebase_uid": g.user.get("firebase_uid"),
        "timestamp": datetime.utcnow().isoformat()
    })
    prefs = preferences_service.list_preferences(g.user["user_id"])
    return jsonify({"preferences": prefs}), 200


@users_bp.route("/api/users/me/preferences", methods=["PUT"])
@require_auth()
def update_user_preferences():
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "InvalidInput", "message": "Expected JSON key-value map"}), 400

    logging.info({
        "event": "update_user_preferences",
        "firebase_uid": g.user.get("firebase_uid"),
        "keys": list(data.keys()),
        "timestamp": datetime.utcnow().isoformat()
    })

    for key, value in data.items():
        preferences_service.set_preference(g.user["user_id"], key, str(value))
    return jsonify({"status": "updated"}), 200


# -------------------------------------------------------------
# USER PAYMENT METHODS ROUTES
# -------------------------------------------------------------
@users_bp.route("/api/users/me/payments", methods=["GET"])
@require_auth()
def list_user_payments():
    logging.info({
        "event": "list_user_payments",
        "firebase_uid": g.user.get("firebase_uid"),
        "timestamp": datetime.utcnow().isoformat()
    })
    payments = payments_service.list_payment_methods(g.user["user_id"])
    return jsonify({"payment_methods": payments}), 200


@users_bp.route("/api/users/me/payments", methods=["POST"])
@require_auth()
def add_user_payment():
    data = request.get_json(silent=True) or {}
    required = ["provider", "token"]
    for f in required:
        if f not in data:
            return jsonify({"error": "BadRequest", "message": f"Missing field: {f}"}), 400

    logging.info({
        "event": "add_user_payment",
        "firebase_uid": g.user.get("firebase_uid"),
        "provider": data.get("provider"),
        "timestamp": datetime.utcnow().isoformat()
    })

    payments_service.add_payment_method(
        user_id=g.user["user_id"],
        provider=data["provider"],
        token=data["token"],
        last4=data.get("last4"),
        expiry=data.get("expiry"),
        is_default=bool(data.get("is_default", False)),
    )
    return jsonify({"status": "added"}), 201


@users_bp.route("/api/users/me/payments/<int:payment_id>", methods=["DELETE"])
@require_auth()
def delete_user_payment(payment_id):
    logging.info({
        "event": "delete_user_payment",
        "firebase_uid": g.user.get("firebase_uid"),
        "payment_id": payment_id,
        "timestamp": datetime.utcnow().isoformat()
    })
    payments_service.delete_payment_method(g.user["user_id"], payment_id)
    return jsonify({"status": "deleted"}), 200
