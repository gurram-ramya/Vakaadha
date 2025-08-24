# routes/users.py
from flask import Blueprint, request, jsonify, g
from utils.auth import require_auth, verify_firebase_token
from domain.users import service

bp = Blueprint("users", __name__)

# --------- Auth ---------

@bp.route("/signup", methods=["POST"])
@require_auth
def signup():
    """
    Since Firebase handles authentication, signup here just ensures the user
    exists in our local DB. If not, create it.
    """
    uid = g.user["uid"]
    email = g.user.get("email")
    name = g.user.get("name", "")
    phone = g.user.get("phone")

    user = service.get_user_by_firebase_uid(uid)
    if not user:
        user = service.create_user_from_firebase(uid, email, name, phone)

    return jsonify(user)


@bp.route("/me", methods=["GET"])
@require_auth
def me():
    """
    Return current authenticated user info (users + profile).
    """
    uid = g.user["uid"]
    user = service.get_user_by_firebase_uid(uid)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(service.get_user_with_profile(user["user_id"]))


# --------- Profile ---------

@bp.route("/users/me/profile", methods=["PUT"])
@require_auth
def update_profile():
    """
    Update the current user's profile info.
    Accepts: name, phone, dob, gender, avatar_url
    """
    uid = g.user["uid"]
    user = service.get_user_by_firebase_uid(uid)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.json or {}
    updated = service.update_user_profile(user["user_id"], data)
    return jsonify(updated)


# --------- Admin ---------

@bp.route("/admin/users", methods=["GET"])
@require_auth
def list_users():
    """
    List all users (admin only).
    """
    uid = g.user["uid"]
    user = service.get_user_by_firebase_uid(uid)
    if not user or user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    return jsonify(service.list_users())


@bp.route("/admin/users/<int:user_id>", methods=["PUT"])
@require_auth
def update_user_admin(user_id):
    """
    Update user role/status (admin only).
    Input: { "role": "seller", "status": "blocked" }
    """
    uid = g.user["uid"]
    current = service.get_user_by_firebase_uid(uid)
    if not current or current["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.json or {}
    updated = service.update_user_role_status(user_id, data.get("role"), data.get("status"))
    return jsonify(updated)


@bp.route("/admin/users/<int:user_id>", methods=["DELETE"])
@require_auth
def delete_user_admin(user_id):
    """
    Delete user (admin only).
    """
    uid = g.user["uid"]
    current = service.get_user_by_firebase_uid(uid)
    if not current or current["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403

    service.delete_user(user_id)
    return jsonify({"message": "User deleted"})
