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
    - Creates user row if missing.
    - Ensures the user has their own cart row.
    - Optionally merges a guest cart into the user's cart.
    """
    guest_id = None
    try:
        payload = request.get_json(silent=True)
        if payload:
            guest_id = payload.get("guest_id")
    except Exception:
        guest_id = None

    # Guarantee a cart row for the user
    try:
        cart_service.get_or_create_cart(user_id=g.user["user_id"])
    except Exception as e:
        print(f"[WARN] failed to ensure user cart: {e}")

    # Merge guest cart if provided
    if guest_id:
        try:
            cart_service.merge_guest_cart(guest_id=guest_id, user_id=g.user["user_id"])
        except Exception as e:
            print(f"[WARN] cart merge failed for guest_id={guest_id}: {e}")

    return jsonify(g.user), 200


# ----------------------------
# Get current user
# ----------------------------
@bp.route("/users/me", methods=["GET"])
@require_auth
def get_me():
    """
    Return the current authenticated user's details and profile.
    """
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
    """
    Update the authenticated user's profile (name, dob, gender, avatar).
    """
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
