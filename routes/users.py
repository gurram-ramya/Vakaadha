# routes/users.py
from __future__ import annotations
from flask import Blueprint, jsonify, g, request

from utils.auth import require_auth
from domain.users import service as users_service

bp = Blueprint("users", __name__)

@bp.post("/signup")
@require_auth
def signup():
    """
    Idempotent: ensure a local user exists for the authenticated Firebase uid.
    Also backfills name if Firebase provided one.
    Returns the merged current user payload.
    """
    # require_auth already called ensure_user; but do it once more to backfill name if needed
    ensured = users_service.ensure_user(
        firebase_uid=g.user["uid"],
        email=g.user.get("email"),
        name=g.user.get("name"),
        avatar_url=None,
        update_last_login=True,
    )
    # Rebuild g.user.name if it was just filled by ensure_user
    g.user["user_id"] = ensured["id"]
    g.user["name"] = ensured.get("name") or g.user.get("name")

    me = users_service.get_user_with_profile(g.user["user_id"])
    # Attach email_verified from token
    me["email_verified"] = bool(g.user.get("email_verified"))
    return jsonify(me)


@bp.get("/users/me")
@require_auth
def users_me():
    """
    Return the merged user + profile + email_verified.
    """
    me = users_service.get_user_with_profile(g.user["user_id"])
    me["email_verified"] = bool(g.user.get("email_verified"))
    return jsonify(me)


@bp.put("/users/me/profile")
@require_auth
def update_my_profile():
    """
    Update profile fields. Name updates on `users` table if provided.
    Body: { name?, dob?, gender?, avatar_url? }
    """
    body = request.get_json(silent=True) or {}
    name = body.get("name")
    dob = body.get("dob")
    gender = body.get("gender")
    avatar_url = body.get("avatar_url")

    updated = users_service.update_profile(
        g.user["user_id"],
        name=name,
        dob=dob,
        gender=gender,
        avatar_url=avatar_url,
    )
    updated["email_verified"] = bool(g.user.get("email_verified"))
    return jsonify(updated)


# Example admin endpoint (optional). Ensure you use <int:user_id> not {user_id}
@bp.delete("/admin/users/<int:user_id>")
@require_auth
def admin_delete_user(user_id: int):
    """
    Soft-delete user (example). You can protect this with @require_admin if needed.
    """
    # from utils.auth import require_admin
    # (Decorate with @require_admin above if you want real admin guard.)

    from db import get_db
    con = get_db()
    con.execute("UPDATE users SET status='deleted' WHERE id = ?", (user_id,))
    con.commit()
    return jsonify({"deleted": True, "user_id": user_id})
