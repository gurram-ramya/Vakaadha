# routes/users.py
from flask import Blueprint, request, jsonify, g, make_response
from ..utils.auth import require_auth
from ..domain.users import service as user_service
from ..domain.cart import service as cart_service
from ..db import get_db_connection
import logging

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

        # Extract guest_id from cookie or body
        guest_id = request.cookies.get("guest_id") or data.get("guest_id")

        # Ensure user exists and merge guest cart if applicable
        user, merge_result = user_service.ensure_user_with_merge(
            conn=conn,
            firebase_uid=g.user["firebase_uid"],
            email=g.user["email"],
            name=g.user.get("name"),
            avatar_url=g.user.get("picture"),
            guest_id=guest_id,
            update_last_login=True,
        )

        # Log merge metadata for auditing
        logging.info({
            "event": "cart_merge",
            "firebase_uid": g.user["firebase_uid"],
            "guest_id": guest_id,
            "merge_result": merge_result
        })

        response = jsonify({
            "user": {
                "user_id": user["user_id"],
                "firebase_uid": user["firebase_uid"],
                "email": user["email"],
                "name": user["name"],
                "is_admin": user.get("is_admin", False),
                "email_verified": g.user.get("email_verified", False)
            },
            "merge": merge_result or None
        })

        return response, 200

    except user_service.TokenExpiredError:
        return error_response(401, "token_expired", "Firebase token expired")
    except user_service.InvalidTokenError:
        return error_response(401, "invalid_token", "Invalid Firebase token")
    except Exception as e:
        logging.exception("Error in /api/auth/register")
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
        return jsonify({
            "user_id": user.get("user_id"),
            "firebase_uid": user.get("firebase_uid"),
            "email": user.get("email"),
            "name": user.get("name"),
            "is_admin": user.get("is_admin", False),
            "email_verified": user.get("email_verified", False)
        }), 200
    except user_service.TokenExpiredError:
        return error_response(401, "token_expired", "Firebase token expired")
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

        user_profile = user_service.get_user_with_profile(conn, firebase_uid)
        if not user_profile:
            return error_response(404, "user_not_found")

        user_profile["email_verified"] = g.user.get("email_verified", False)
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

        # Validate payload
        allowed_fields = {"name", "dob", "gender", "avatar_url"}
        for field in data.keys():
            if field not in allowed_fields:
                return error_response(400, "invalid_payload", f"Unexpected field: {field}")

        # Basic validation
        if "gender" in data and data["gender"] not in ["male", "female", "other", None, ""]:
            return error_response(400, "invalid_payload", "Invalid gender value")

        updated_profile = user_service.update_profile(conn, firebase_uid, data)
        return jsonify(updated_profile), 200

    except Exception as e:
        logging.exception("Error in /api/users/me/profile")
        return error_response(500, "internal_error", str(e))
    finally:
        conn.close()


# -------------------------------------------------------------
# POST /api/auth/logout
# Placeholder for cookie/session cleanup
# -------------------------------------------------------------
@users_bp.route("/api/auth/logout", methods=["POST"], endpoint="logout")
def logout():
    response = make_response("", 204)
    if request.cookies.get("guest_id"):
        response.delete_cookie("guest_id")
    return response


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
