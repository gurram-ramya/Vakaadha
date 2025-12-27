# # ------------------------- Pgsql ------------------------

# import logging
# from flask import Blueprint, request, jsonify, g, make_response
# from datetime import datetime

# from utils.auth import require_auth, perform_logout_response
# from domain.users import service as user_service
# from domain.users import preferences_service, payments_service
# from domain.cart import service as cart_service
# from domain.wishlist import service as wishlist_service

# users_bp = Blueprint("users", __name__)


# def error_response(code, error, message=None):
#     payload = {"error": error}
#     if message:
#         payload["message"] = message
#     return jsonify(payload), code



# @users_bp.route("/api/auth/register", methods=["POST"], endpoint="register_user")
# @require_auth()
# def register_user():
#     try:
#         firebase_uid = g.user.get("firebase_uid")
#         email = g.user.get("email")

#         # definitive guest resolution
#         incoming_guest = request.json.get("guest_id") if request.is_json else None
#         cookie_guest = request.cookies.get("guest_id")
#         actor_guest = g.actor.get("guest_id")

#         guest_id = incoming_guest or cookie_guest or actor_guest

#         if not firebase_uid:
#             return error_response(400, "missing_firebase_uid", "Firebase UID not supplied")

#         # Step 1. ensure user row
#         user, merge_result = user_service.ensure_user_with_merge(
#             conn=None,
#             firebase_uid=firebase_uid,
#             email=email,
#             name=None,
#             avatar_url=None,
#             guest_id=guest_id,
#             update_last_login=True,
#         )
#         user_id = user["user_id"]

#         # Step 2. merge guest cart
#         cart_merge = cart_service.merge_carts(user_id, guest_id)

#         # Step 3. merge guest wishlist
#         wishlist_merge = wishlist_service.merge_guest_wishlist_into_user(
#             user_id,
#             guest_id
#         )

#         # Step 4. response
#         payload = {
#             "user": {
#                 "user_id": user_id,
#                 "firebase_uid": user["firebase_uid"],
#                 "email": user["email"],
#             },
#             "merge": {
#                 "user_merge": merge_result,
#                 "cart_merge": cart_merge,
#                 "wishlist_merge": wishlist_merge
#             }
#         }

#         return make_response(jsonify(payload)), 200

#     except Exception as e:
#         return error_response(500, "internal_error", str(e))


# @users_bp.route("/api/auth/session", methods=["GET"], endpoint="session_info")
# @require_auth(optional=True)
# def session_info():
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


# @users_bp.route("/api/users/me", methods=["GET"], endpoint="get_user_profile")
# @require_auth(optional=True)
# def get_user_profile():
#     try:
#         user = getattr(g, "user", None)
#         if not user or not user.get("firebase_uid"):
#             return jsonify({"error": "unauthorized", "message": "Login required"}), 401

#         user_profile = user_service.get_user_with_profile(None, user["firebase_uid"])
#         if not user_profile:
#             return jsonify({"error": "user_not_found"}), 404

#         user_profile["email_verified"] = user.get("email_verified", False)

#         return jsonify(user_profile), 200

#     except Exception as e:
#         logging.exception("error in /api/users/me")
#         return jsonify({"error": "internal_error", "message": str(e)}), 500


# @users_bp.route("/api/users/me/profile", methods=["PUT"], endpoint="update_user_profile")
# @require_auth()
# def update_user_profile():
#     try:
#         data = request.get_json(silent=True) or {}
#         firebase_uid = g.user["firebase_uid"]

#         allowed_fields = {"name", "dob", "gender", "avatar_url"}
#         for field in data.keys():
#             if field not in allowed_fields:
#                 return error_response(400, "invalid_payload", f"Unexpected field: {field}")

#         if "gender" in data and data["gender"] not in ["male", "female", "other", None, ""]:
#             return error_response(400, "invalid_payload", "Invalid gender value")

#         updated_profile = user_service.update_profile(None, firebase_uid, data)
#         return jsonify(updated_profile), 200

#     except Exception as e:
#         logging.exception("error in /api/users/me/profile")
#         return error_response(500, "internal_error", str(e))


# @users_bp.route("/api/auth/logout", methods=["POST"], endpoint="logout_user")
# @require_auth(optional=True)
# def logout_user():
#     return perform_logout_response()


# @users_bp.route("/api/cart/merge", methods=["GET"], endpoint="deprecated_merge_endpoint")
# @require_auth()
# def deprecated_merge_endpoint():
#     return jsonify({
#         "error": "deprecated",
#         "message": "Guest cart auto-merged during authentication",
#         "use": "/api/auth/register"
#     }), 410


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
#         return error_response(400, "invalid_payload", "Expected JSON object")

#     for key, value in data.items():
#         preferences_service.set_preference(g.user["user_id"], key, str(value))

#     return jsonify({"status": "updated"}), 200


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

# -----------------------------------------------------------------------------------------------

import logging
from flask import Blueprint, request, jsonify, g
from utils.auth import require_auth, perform_logout_response
from domain.users import service as user_service
from domain.users import preferences_service, payments_service

users_bp = Blueprint("users", __name__)

# ============================================================
# Helpers
# ============================================================

def error_response(code, error, message=None):
    payload = {"error": error}
    if message:
        payload["message"] = message
    return jsonify(payload), code


# ============================================================
# AUTH RECONCILIATION — SINGLE ENTRY POINT
# ============================================================

@users_bp.route("/api/auth/register", methods=["POST"], endpoint="register_user")
@require_auth()
def register_user():
    logging.warning("=== /api/auth/register HIT ===")
    logging.warning("g.user at entry: %s", getattr(g, "user", None))
    logging.warning("g.actor at entry: %s", getattr(g, "actor", None))

    try:
        if not getattr(g, "user", None) or not g.user.get("firebase_uid"):
            logging.warning("register_user: missing firebase_uid in g.user")
            return error_response(400, "missing_firebase_uid")

        firebase_uid = g.user["firebase_uid"]

        guest_id = (
            request.headers.get("X-Guest-Id")
            or request.cookies.get("guest_id")
            or getattr(g, "actor", {}).get("guest_id")
        )

        logging.warning("Resolved guest_id: %s", guest_id)

        provided_name = None
        if request.is_json:
            body = request.get_json(silent=True) or {}
            provided_name = body.get("name") or body.get("providedName")

        email = g.user.get("email")
        email_verified = bool(g.user.get("email_verified", False))
        phone_number = g.user.get("phone_number") or g.user.get("phone")

        logging.warning(
            "Firebase identity: uid=%s email=%s verified=%s phone=%s",
            firebase_uid,
            email,
            email_verified,
            phone_number,
        )

        try:
            user, merge_result = user_service.ensure_user_with_merge(
                conn=None,
                firebase_uid=firebase_uid,
                email=(email if email_verified else None),
                name=provided_name,
                avatar_url=None,
                guest_id=guest_id,
                update_last_login=True,
                email_verified=email_verified,
                phone=phone_number,
            )
        except TypeError:
            user, merge_result = user_service.ensure_user_with_merge(
                conn=None,
                firebase_uid=firebase_uid,
                email=(email if email_verified else None),
                name=provided_name,
                avatar_url=None,
                guest_id=guest_id,
                update_last_login=True,
            )

        if not user:
            logging.error("ensure_user_with_merge returned no user")
            return error_response(500, "registration_failed")

        logging.warning("User ensured successfully: user_id=%s", user.get("user_id"))

        return jsonify({
            "status": "ok",
            "user": {
                "user_id": user.get("user_id"),
                "firebase_uid": firebase_uid,
            },
            "merge": merge_result or {},
        }), 200

    except Exception as e:
        logging.exception("auth/register failed")
        return error_response(500, "internal_error", str(e))


# ============================================================
# SESSION INTROSPECTION
# ============================================================

@users_bp.route("/api/auth/session", methods=["GET"], endpoint="session_info")
@require_auth(optional=True)
def session_info():
    logging.warning("=== /api/auth/session HIT ===")
    logging.warning("g.user: %s", getattr(g, "user", None))
    logging.warning("g.actor: %s", getattr(g, "actor", None))

    actor = getattr(g, "actor", {}) or {}
    user = getattr(g, "user", {}) or {}

    if actor.get("is_authenticated"):
        payload = {
            "is_authenticated": True,
            "firebase_uid": user.get("firebase_uid"),
            "email": user.get("email"),
            "email_verified": user.get("email_verified", False),
        }
    else:
        payload = {
            "is_authenticated": False,
            "guest_id": actor.get("guest_id"),
        }

    return jsonify(payload), 200


# ============================================================
# CANONICAL USER VIEW
# ============================================================

@users_bp.route("/api/users/me", methods=["GET"], endpoint="get_user_profile")
@require_auth(optional=True)
def get_user_profile():
    logging.warning("=== /api/users/me HIT ===")
    logging.warning("g.user at entry: %s", getattr(g, "user", None))
    logging.warning("g.actor at entry: %s", getattr(g, "actor", None))

    try:
        user = getattr(g, "user", None)
        if not user or not user.get("firebase_uid"):
            logging.warning("/api/users/me unauthorized: missing g.user or firebase_uid")
            return error_response(401, "unauthorized", "Login required")

        firebase_uid = user["firebase_uid"]
        logging.warning("Fetching profile for firebase_uid=%s", firebase_uid)

        profile = user_service.get_user_with_profile(None, firebase_uid)

        if not profile:
            logging.warning(
                "No backend profile found for firebase_uid=%s (expected for first-time users)",
                firebase_uid,
            )
            return error_response(404, "user_not_registered")

        logging.warning("Profile loaded successfully for firebase_uid=%s", firebase_uid)
        return jsonify(profile), 200

    except Exception as e:
        logging.exception("users/me failed")
        return error_response(500, "internal_error", str(e))


# ============================================================
# PROFILE UPDATE
# ============================================================

@users_bp.route("/api/users/me/profile", methods=["PUT"], endpoint="update_user_profile")
@require_auth()
def update_user_profile():
    logging.warning("=== /api/users/me/profile PUT HIT ===")
    logging.warning("g.user: %s", getattr(g, "user", None))

    try:
        data = request.get_json(silent=True) or {}
        firebase_uid = g.user["firebase_uid"]

        allowed_fields = {"name", "dob", "gender", "avatar_url"}
        for field in data:
            if field not in allowed_fields:
                logging.warning("Invalid profile field: %s", field)
                return error_response(400, "invalid_payload", f"Unexpected field: {field}")

        if "gender" in data and data["gender"] not in ["male", "female", "other", None, ""]:
            return error_response(400, "invalid_gender")

        updated = user_service.update_profile(None, firebase_uid, data)
        if not updated:
            return error_response(404, "user_not_found")

        logging.warning("Profile updated for firebase_uid=%s", firebase_uid)
        return jsonify(updated), 200

    except Exception as e:
        logging.exception("profile update failed")
        return error_response(500, "internal_error", str(e))


# ============================================================
# LOGOUT
# ============================================================

@users_bp.route("/api/auth/logout", methods=["POST"], endpoint="logout_user")
@require_auth(optional=True)
def logout_user():
    logging.warning("=== /api/auth/logout HIT ===")
    logging.warning("g.user: %s", getattr(g, "user", None))
    logging.warning("g.actor: %s", getattr(g, "actor", None))
    return perform_logout_response()


# ============================================================
# USER PREFERENCES
# ============================================================

@users_bp.route("/api/users/me/preferences", methods=["GET"])
@require_auth()
def get_user_preferences():
    logging.warning("=== /api/users/me/preferences GET HIT ===")
    prefs = preferences_service.list_preferences(g.user["user_id"])
    return jsonify({"preferences": prefs}), 200


@users_bp.route("/api/users/me/preferences", methods=["PUT"])
@require_auth()
def update_user_preferences():
    logging.warning("=== /api/users/me/preferences PUT HIT ===")
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return error_response(400, "invalid_payload")

    for key, value in data.items():
        preferences_service.set_preference(g.user["user_id"], key, str(value))

    return jsonify({"status": "updated"}), 200


# ============================================================
# USER PAYMENTS
# ============================================================

@users_bp.route("/api/users/me/payments", methods=["GET"])
@require_auth()
def list_user_payments():
    logging.warning("=== /api/users/me/payments GET HIT ===")
    payments = payments_service.list_payment_methods(g.user["user_id"])
    return jsonify({"payment_methods": payments}), 200


@users_bp.route("/api/users/me/payments", methods=["POST"])
@require_auth()
def add_user_payment():
    logging.warning("=== /api/users/me/payments POST HIT ===")
    data = request.get_json(silent=True) or {}

    for f in ("provider", "token"):
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
    logging.warning("=== /api/users/me/payments DELETE HIT === payment_id=%s", payment_id)
    payments_service.delete_payment_method(g.user["user_id"], payment_id)
    return jsonify({"status": "deleted"}), 200
