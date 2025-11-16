# # routes/users.py — corrected and consistent with new auth + service layers
# import logging
# from flask import Blueprint, request, jsonify, g, make_response
# from datetime import datetime
# from uuid import uuid4

# from utils.auth import require_auth
# from utils.auth import perform_logout_response
# from domain.users import service as user_service
# from domain.users import preferences_service, payments_service
# from db import get_db_connection

# users_bp = Blueprint("users", __name__)

# # ===========================================================
# # HELPER: UNIFIED ERROR RESPONSE
# # ===========================================================
# def error_response(code, error, message=None):
#     payload = {"error": error}
#     if message:
#         payload["message"] = message
#     return jsonify(payload), code


# # ===========================================================
# # POST /api/auth/register
# # ===========================================================
# from domain.cart import service as cart_service
# from domain.wishlist import service as wishlist_service

# @users_bp.route("/api/auth/register", methods=["POST"], endpoint="register_user")
# @require_auth()
# def register_user():
#     conn = None
#     try:
#         conn = get_db_connection()
#         data = request.get_json(silent=True) or {}

#         firebase_uid = g.user.get("firebase_uid")
#         email = g.user.get("email")
#         name = g.user.get("name")
#         avatar_url = g.user.get("picture")
#         guest_id = getattr(g, "guest_id", None) or request.cookies.get("guest_id") or data.get("guest_id")

#         logging.info({
#             "event": "register_user",
#             "firebase_uid": firebase_uid,
#             "email": email,
#             "guest_id": guest_id,
#             "timestamp": datetime.utcnow().isoformat(),
#         })

#         # Step 1: Ensure or create the user record
#         user, merge_result = user_service.ensure_user_with_merge(
#             conn=conn,
#             firebase_uid=firebase_uid,
#             email=email,
#             name=name,
#             avatar_url=avatar_url,
#             guest_id=guest_id,
#             update_last_login=True,
#         )

#         if not user:
#             logging.error("User creation failed in ensure_user_with_merge")
#             return error_response(500, "user_creation_failed", "Unable to create or link user")

#         user_id = user["user_id"]

#         # Step 2: Ensure cart and wishlist are created for new users
#         try:
#             cart_service.ensure_cart_for_user(user_id)
#             wishlist_service.ensure_wishlist_for_user(user_id)
#         except Exception as e:
#             logging.warning(f"[INIT_RESOURCE_FAIL] {e}")

#         # Step 3: Prepare response
#         resp = jsonify({
#             "user": {
#                 "user_id": user["user_id"],
#                 "firebase_uid": user["firebase_uid"],
#                 "email": user["email"],
#                 "name": user["name"],
#                 "is_admin": user.get("is_admin", False),
#                 "email_verified": g.user.get("email_verified", False),
#             },
#             "merge": merge_result,
#         })

#         return make_response(resp), 200

#     except Exception as e:
#         logging.exception("Error in /api/auth/register")
#         return error_response(500, "internal_error", str(e))
#     finally:
#         if conn:
#             conn.close()



# # ===========================================================
# # GET /api/auth/session
# # ===========================================================
# @users_bp.route("/api/auth/session", methods=["GET"], endpoint="session_info")
# @require_auth(optional=True)
# def session_info():
#     """Return current user or guest session info."""
#     actor = getattr(g, "actor", {})
#     user = getattr(g, "user", {})

#     if actor.get("is_authenticated"):
#         payload = {
#             "is_authenticated": True,
#             "firebase_uid": user.get("firebase_uid"),
#             "email": user.get("email"),
#             "name": user.get("name"),
#             "email_verified": user.get("email_verified", False),
#         }
#     else:
#         payload = {
#             "is_authenticated": False,
#             "guest_id": actor.get("guest_id"),
#         }

#     logging.info({
#         "event": "session_info",
#         "payload": payload,
#         "timestamp": datetime.utcnow().isoformat(),
#     })

#     return jsonify(payload), 200


# # ===========================================================
# # GET /api/users/me
# # ===========================================================
# # @users_bp.route("/api/users/me", methods=["GET"], endpoint="get_user_profile")
# # @require_auth()
# # def get_user_profile():
# #     conn = None
# #     try:
# #         conn = get_db_connection()
# #         firebase_uid = g.user["firebase_uid"]

# #         user_profile = user_service.get_user_with_profile(conn, firebase_uid)
# #         if not user_profile:
# #             return error_response(404, "user_not_found")

# #         user_profile["email_verified"] = g.user.get("email_verified", False)
# #         return jsonify(user_profile), 200

# #     except Exception as e:
# #         logging.exception("Error in /api/users/me")
# #         return error_response(500, "internal_error", str(e))
# #     finally:
# #         if conn:
# #             conn.close()

# @users_bp.route("/api/users/me", methods=["GET"], endpoint="get_user_profile")
# @require_auth(optional=True)
# def get_user_profile():
#     conn = None
#     try:
#         user = getattr(g, "user", None)
#         if not user or not user.get("firebase_uid"):
#             return jsonify({"error": "unauthorized", "message": "Login required"}), 401

#         conn = get_db_connection()
#         firebase_uid = user["firebase_uid"]

#         user_profile = user_service.get_user_with_profile(conn, firebase_uid)
#         if not user_profile:
#             return jsonify({"error": "user_not_found"}), 404

#         user_profile["email_verified"] = user.get("email_verified", False)
#         return jsonify(user_profile), 200

#     except Exception as e:
#         logging.exception("Error in /api/users/me")
#         return jsonify({"error": "internal_error", "message": str(e)}), 500
#     finally:
#         if conn:
#             conn.close()


# # ===========================================================
# # PUT /api/users/me/profile
# # ===========================================================
# @users_bp.route("/api/users/me/profile", methods=["PUT"], endpoint="update_user_profile")
# @require_auth()
# def update_user_profile():
#     conn = None
#     try:
#         conn = get_db_connection()
#         data = request.get_json(silent=True) or {}
#         firebase_uid = g.user["firebase_uid"]

#         allowed_fields = {"name", "dob", "gender", "avatar_url"}
#         for field in data.keys():
#             if field not in allowed_fields:
#                 return error_response(400, "invalid_payload", f"Unexpected field: {field}")

#         if "gender" in data and data["gender"] not in ["male", "female", "other", None, ""]:
#             return error_response(400, "invalid_payload", "Invalid gender value")

#         updated_profile = user_service.update_profile(conn, firebase_uid, data)
#         return jsonify(updated_profile), 200

#     except Exception as e:
#         logging.exception("Error in /api/users/me/profile")
#         return error_response(500, "internal_error", str(e))
#     finally:
#         if conn:
#             conn.close()


# # ===========================================================
# # POST /api/auth/logout
# # ===========================================================
# @users_bp.route("/api/auth/logout", methods=["POST"], endpoint="logout_user")
# @require_auth(optional=True)
# def logout_user():
#     """Unified logout; clears Firebase session and resets guest context."""
#     return perform_logout_response()


# # ===========================================================
# # DEPRECATED ENDPOINT
# # ===========================================================
# @users_bp.route("/api/cart/merge", methods=["GET"], endpoint="deprecated_merge_endpoint")
# @require_auth()
# def deprecated_merge_endpoint():
#     return jsonify({
#         "error": "deprecated",
#         "message": "Guest cart is now auto-merged during authentication",
#         "use": "/api/auth/register"
#     }), 410


# # ===========================================================
# # USER PREFERENCES
# # ===========================================================
# @users_bp.route("/api/users/me/preferences", methods=["GET"])
# @require_auth()
# def get_user_preferences():
#     prefs = preferences_service.list_preferences(g.user["user_id"])
#     return jsonify({"preferences": prefs}), 200


# @users_bp.route("/api/users/me/preferences", methods=["PUT"])
# @require_auth()
# def update_user_preferences():
#     data = request.get_json(silent=True) or {}
#     if not isinstance(data, dict):
#         return error_response(400, "invalid_payload", "Expected JSON key-value map")

#     for key, value in data.items():
#         preferences_service.set_preference(g.user["user_id"], key, str(value))
#     return jsonify({"status": "updated"}), 200


# # ===========================================================
# # USER PAYMENT METHODS
# # ===========================================================
# @users_bp.route("/api/users/me/payments", methods=["GET"])
# @require_auth()
# def list_user_payments():
#     payments = payments_service.list_payment_methods(g.user["user_id"])
#     return jsonify({"payment_methods": payments}), 200


# @users_bp.route("/api/users/me/payments", methods=["POST"])
# @require_auth()
# def add_user_payment():
#     data = request.get_json(silent=True) or {}
#     required = ["provider", "token"]
#     for f in required:
#         if f not in data:
#             return error_response(400, "invalid_payload", f"Missing field: {f}")

#     payments_service.add_payment_method(
#         user_id=g.user["user_id"],
#         provider=data["provider"],
#         token=data["token"],
#         last4=data.get("last4"),
#         expiry=data.get("expiry"),
#         is_default=bool(data.get("is_default", False)),
#     )
#     return jsonify({"status": "added"}), 201


# @users_bp.route("/api/users/me/payments/<int:payment_id>", methods=["DELETE"])
# @require_auth()
# def delete_user_payment(payment_id):
#     payments_service.delete_payment_method(g.user["user_id"], payment_id)
#     return jsonify({"status": "deleted"}), 200

# ------------------------------------------------------------------------
# @users_bp.route("/api/auth/register", methods=["POST"], endpoint="register_user")
# @require_auth()
# def register_user():
#     try:
#         data = request.get_json(silent=True) or {}

#         firebase_uid = g.user.get("firebase_uid")
#         email = g.user.get("email")
#         name = g.user.get("name")
#         avatar_url = g.user.get("picture")
#         guest_id = getattr(g, "guest_id", None) or request.cookies.get("guest_id") or data.get("guest_id")

#         logging.info({
#             "event": "register_user",
#             "firebase_uid": firebase_uid,
#             "email": email,
#             "guest_id": guest_id,
#             "timestamp": datetime.utcnow().isoformat(),
#         })

#         user, merge_result = user_service.ensure_user_with_merge(
#             conn=None,
#             firebase_uid=firebase_uid,
#             email=email,
#             name=name,
#             avatar_url=avatar_url,
#             guest_id=guest_id,
#             update_last_login=True,
#         )

#         if not user:
#             return error_response(500, "user_creation_failed", "Unable to create or link user")

#         user_id = user["user_id"]

#         try:
#             cart_service.ensure_cart_for_user(user_id)
#             wishlist_service.ensure_wishlist_for_user(user_id)
#         except Exception as e:
#             logging.warning(f"init resource failure: {e}")

#         resp = jsonify({
#             "user": {
#                 "user_id": user["user_id"],
#                 "firebase_uid": user["firebase_uid"],
#                 "email": user["email"],
#                 "name": user["name"],
#                 "is_admin": user.get("is_admin", False),
#                 "email_verified": g.user.get("email_verified", False),
#             },
#             "merge": merge_result,
#         })

#         return make_response(resp), 200

#     except Exception as e:
#         logging.exception("error in /api/auth/register")
#         return error_response(500, "internal_error", str(e))

# ------------------------- Pgsql ------------------------

import logging
from flask import Blueprint, request, jsonify, g, make_response
from datetime import datetime

from utils.auth import require_auth, perform_logout_response
from domain.users import service as user_service
from domain.users import preferences_service, payments_service
from domain.cart import service as cart_service
from domain.wishlist import service as wishlist_service

users_bp = Blueprint("users", __name__)


def error_response(code, error, message=None):
    payload = {"error": error}
    if message:
        payload["message"] = message
    return jsonify(payload), code



@users_bp.route("/api/auth/register", methods=["POST"], endpoint="register_user")
@require_auth()
def register_user():
    try:
        firebase_uid = g.user.get("firebase_uid")
        email = g.user.get("email")

        # definitive guest resolution
        incoming_guest = request.json.get("guest_id") if request.is_json else None
        cookie_guest = request.cookies.get("guest_id")
        actor_guest = g.actor.get("guest_id")

        guest_id = incoming_guest or cookie_guest or actor_guest

        if not firebase_uid:
            return error_response(400, "missing_firebase_uid", "Firebase UID not supplied")

        # Step 1. ensure user row
        user, merge_result = user_service.ensure_user_with_merge(
            conn=None,
            firebase_uid=firebase_uid,
            email=email,
            name=None,
            avatar_url=None,
            guest_id=guest_id,
            update_last_login=True,
        )
        user_id = user["user_id"]

        # Step 2. merge guest cart
        cart_merge = cart_service.merge_carts(user_id, guest_id)

        # Step 3. merge guest wishlist
        wishlist_merge = wishlist_service.merge_guest_wishlist_into_user(
            user_id,
            guest_id
        )

        # Step 4. response
        payload = {
            "user": {
                "user_id": user_id,
                "firebase_uid": user["firebase_uid"],
                "email": user["email"],
            },
            "merge": {
                "user_merge": merge_result,
                "cart_merge": cart_merge,
                "wishlist_merge": wishlist_merge
            }
        }

        return make_response(jsonify(payload)), 200

    except Exception as e:
        return error_response(500, "internal_error", str(e))


@users_bp.route("/api/auth/session", methods=["GET"], endpoint="session_info")
@require_auth(optional=True)
def session_info():
    actor = getattr(g, "actor", {})
    user = getattr(g, "user", {})

    if actor.get("is_authenticated"):
        payload = {
            "is_authenticated": True,
            "firebase_uid": user.get("firebase_uid"),
            "email": user.get("email"),
            "name": user.get("name"),
            "email_verified": user.get("email_verified", False),
        }
    else:
        payload = {
            "is_authenticated": False,
            "guest_id": actor.get("guest_id"),
        }

    logging.info({
        "event": "session_info",
        "payload": payload,
        "timestamp": datetime.utcnow().isoformat(),
    })

    return jsonify(payload), 200


@users_bp.route("/api/users/me", methods=["GET"], endpoint="get_user_profile")
@require_auth(optional=True)
def get_user_profile():
    try:
        user = getattr(g, "user", None)
        if not user or not user.get("firebase_uid"):
            return jsonify({"error": "unauthorized", "message": "Login required"}), 401

        user_profile = user_service.get_user_with_profile(None, user["firebase_uid"])
        if not user_profile:
            return jsonify({"error": "user_not_found"}), 404

        user_profile["email_verified"] = user.get("email_verified", False)

        return jsonify(user_profile), 200

    except Exception as e:
        logging.exception("error in /api/users/me")
        return jsonify({"error": "internal_error", "message": str(e)}), 500


@users_bp.route("/api/users/me/profile", methods=["PUT"], endpoint="update_user_profile")
@require_auth()
def update_user_profile():
    try:
        data = request.get_json(silent=True) or {}
        firebase_uid = g.user["firebase_uid"]

        allowed_fields = {"name", "dob", "gender", "avatar_url"}
        for field in data.keys():
            if field not in allowed_fields:
                return error_response(400, "invalid_payload", f"Unexpected field: {field}")

        if "gender" in data and data["gender"] not in ["male", "female", "other", None, ""]:
            return error_response(400, "invalid_payload", "Invalid gender value")

        updated_profile = user_service.update_profile(None, firebase_uid, data)
        return jsonify(updated_profile), 200

    except Exception as e:
        logging.exception("error in /api/users/me/profile")
        return error_response(500, "internal_error", str(e))


@users_bp.route("/api/auth/logout", methods=["POST"], endpoint="logout_user")
@require_auth(optional=True)
def logout_user():
    return perform_logout_response()


@users_bp.route("/api/cart/merge", methods=["GET"], endpoint="deprecated_merge_endpoint")
@require_auth()
def deprecated_merge_endpoint():
    return jsonify({
        "error": "deprecated",
        "message": "Guest cart auto-merged during authentication",
        "use": "/api/auth/register"
    }), 410


@users_bp.route("/api/users/me/preferences", methods=["GET"])
@require_auth()
def get_user_preferences():
    prefs = preferences_service.list_preferences(g.user["user_id"])
    return jsonify({"preferences": prefs}), 200


@users_bp.route("/api/users/me/preferences", methods=["PUT"])
@require_auth()
def update_user_preferences():
    data = request.get_json(silent=True) or {}

    if not isinstance(data, dict):
        return error_response(400, "invalid_payload", "Expected JSON object")

    for key, value in data.items():
        preferences_service.set_preference(g.user["user_id"], key, str(value))

    return jsonify({"status": "updated"}), 200


@users_bp.route("/api/users/me/payments", methods=["GET"])
@require_auth()
def list_user_payments():
    payments = payments_service.list_payment_methods(g.user["user_id"])
    return jsonify({"payment_methods": payments}), 200


@users_bp.route("/api/users/me/payments", methods=["POST"])
@require_auth()
def add_user_payment():
    data = request.get_json(silent=True) or {}
    required = ["provider", "token"]

    for f in required:
        if f not in data:
            return error_response(400, "invalid_payload", f"Missing field: {f}")

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
    payments_service.delete_payment_method(g.user["user_id"], payment_id)
    return jsonify({"status": "deleted"}), 200
