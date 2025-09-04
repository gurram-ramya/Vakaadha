

# routes/users.py
"""
Users routes:
- POST /signup            : ensure local user exists (silent, idempotent)
- GET  /users/me          : current user info (user + profile)
- PUT  /users/me/profile  : update profile fields
- (optional) admin delete : example only
"""

from __future__ import annotations

from flask import Blueprint, jsonify, g, request
from utils.auth import require_auth, require_admin
from domain.users import service

bp = Blueprint("users", __name__)

# ---- Auth / bootstrap ----
@bp.post("/signup")
@require_auth
def signup():
    """
    Ensure the user exists in DB when logging in or signing up.
    - If new: create with role='customer', status='active'
    - Always: update last_login timestamp
    """
    claims = g.user
    user = service.ensure_user(
        firebase_uid=claims["uid"],
        email=claims.get("email"),
        name=claims.get("name"),
        avatar_url=claims.get("picture"),
        role="customer",
        status="active",
        update_last_login=True,
    )

    return jsonify(user)


# ---- Current user ----
@bp.get("/users/me")
@require_auth
def me():
    u = service.get_user_by_firebase_uid(g.user["uid"])
    if not u:
        # In case someone hits /users/me before calling /signup, ensure now.
        ensured = service.ensure_user(
            firebase_uid=g.user["uid"],
            email=g.user.get("email"),
            name=g.user.get("name"),
            avatar_url=g.user.get("picture"),
            role="customer",
            status="active",
            update_last_login=True,
        )

        return jsonify(ensured), 200
    return jsonify(service.get_user_with_profile(u["user_id"])), 200


# ---- Profile update (optional for later UX) ----
@bp.put("/users/me/profile")
@require_auth
def update_profile():
    body = request.get_json(silent=True) or {}
    current = service.get_user_by_firebase_uid(g.user["uid"])
    if not current:
        return jsonify({"error": "User not found"}), 404
    updated = service.update_profile(current["user_id"], body)
    return jsonify(updated), 200


# ---- Admin example (optional) ----
@bp.delete("/admin/users/{user_id}")
@require_admin
def admin_delete_user(user_id: int):
    service.delete_user(user_id)
    return jsonify({"ok": True}), 200
