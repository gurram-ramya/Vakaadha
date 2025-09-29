# routes/users.py
from flask import Blueprint, request, jsonify, g
from utils.auth import require_auth
from domain.users import service as user_service
from db import get_db_connection

bp = Blueprint("users", __name__)

# =============================
# AUTH ROUTES
# =============================

@bp.route("/auth/register", methods=["POST"])
@require_auth
def register():
    """Register or return existing user based on Firebase UID"""
    payload = request.json or {}
    name = payload.get("name")
    email = payload.get("email")

    con = get_db_connection()
    user = user_service.ensure_user(con, g.user["firebase_uid"], name, email)
    return jsonify(user), 201


@bp.route("/auth/logout", methods=["POST"])
@require_auth
def logout():
    """
    Stateless logout: frontend clears Firebase token from storage.
    Backend just acknowledges.
    """
    return jsonify({"message": "Logged out"}), 200


# =============================
# USER PROFILE ROUTES
# =============================

@bp.route("/users/me", methods=["GET"])
@require_auth
def get_me():
    """Fetch current authenticated user + profile"""
    con = get_db_connection()
    user = user_service.get_user_with_profile(con, g.user["firebase_uid"])
    return jsonify(user)


@bp.route("/users/me/profile", methods=["PUT"])
@require_auth
def update_profile():
    """Update user profile (name, dob, gender, avatar)"""
    payload = request.json or {}
    name = payload.get("name")
    dob = payload.get("dob")
    gender = payload.get("gender")
    avatar_url = payload.get("avatar_url")

    con = get_db_connection()
    updated_user = user_service.update_profile(
        con,
        g.user["firebase_uid"],
        name=name,
        dob=dob,
        gender=gender,
        avatar_url=avatar_url,
    )
    return jsonify(updated_user), 200
