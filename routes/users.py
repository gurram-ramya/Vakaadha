# routes/users.py
from flask import Blueprint, jsonify, request, g
from utils.auth import require_auth
from domain.users import service as user_service
from domain.cart import service as cart_service
from db import get_db_connection

bp = Blueprint("users", __name__)

# # ----------------------------
# # Auth/Register (idempotent)
# # ----------------------------
# @bp.route("/auth/register", methods=["POST"])
# @require_auth
# def register_user():
#     """
#     Ensures a Firebase-authenticated user exists in DB.
#     Frontend can call this after Firebase signup.
#     """
#     return jsonify(g.user), 200


# # ----------------------------
# # Get current user
# # ----------------------------
# @bp.route("/users/me", methods=["GET"])
# @require_auth
# def get_me():
#     con = get_db_connection()
#     user = user_service.get_user_with_profile(con, g.user["firebase_uid"])
#     if not user:
#         return jsonify({"error": "User not found"}), 404
#     return jsonify(user), 200


# # ----------------------------
# # Update profile
# # ----------------------------
# @bp.route("/users/me/profile", methods=["PUT"])
# @require_auth
# def update_profile():
#     con = get_db_connection()
#     data = request.get_json(force=True)
#     updated = user_service.update_profile(
#         con,
#         g.user["firebase_uid"],
#         name=data.get("name"),
#         dob=data.get("dob"),
#         gender=data.get("gender"),
#         avatar_url=data.get("avatar_url"),
#     )
#     return jsonify(updated), 200


# routes/users.py
from flask import Blueprint, jsonify, request, g
from utils.auth import require_auth
from domain.users import service as user_service
from domain.cart import service as cart_service
from db import get_db_connection

bp = Blueprint("users", __name__)

# ----------------------------
# Auth/Register (idempotent)
# ----------------------------
@bp.route("/auth/register", methods=["POST"])
@require_auth
def register_user():
    """
    Ensures a Firebase-authenticated user exists in DB.
    Frontend can call this after Firebase signup.
    Also merges any guest cart into the user's cart if guest_id is provided.
    """
    guest_id = None
    try:
        payload = request.get_json(silent=True)
        if payload:
            guest_id = payload.get("guest_id")
    except Exception:
        guest_id = None

    if guest_id:
        try:
            cart_service.merge_guest_cart(guest_id=guest_id, user_id=g.user["user_id"])
        except Exception as e:
            # Don't block login/registration on cart merge failure
            print(f"[WARN] cart merge failed for guest_id={guest_id}: {e}")

    return jsonify(g.user), 200


# ----------------------------
# Get current user
# ----------------------------
@bp.route("/users/me", methods=["GET"])
@require_auth
def get_me():
    con = get_db_connection()
    user = user_service.get_user_with_profile(con, g.user["firebase_uid"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user), 200


# ----------------------------
# Update profile
# ----------------------------
@bp.route("/users/me/profile", methods=["PUT"])
@require_auth
def update_profile():
    con = get_db_connection()
    data = request.get_json(force=True)
    updated = user_service.update_profile(
        con,
        g.user["firebase_uid"],
        name=data.get("name"),
        dob=data.get("dob"),
        gender=data.get("gender"),
        avatar_url=data.get("avatar_url"),
    )
    return jsonify(updated), 200
