# utils/auth.py
import os
from functools import wraps
from flask import request, jsonify, g
import firebase_admin
from firebase_admin import credentials, auth as admin_auth
from domain.users import service as user_service
from db import get_db_connection

# ------------------------------------------------
# Firebase Initialization
# ------------------------------------------------

if not firebase_admin._apps:
    # Priority 1: explicit env var
    cred_path = os.getenv("FIREBASE_ADMIN_CREDENTIALS")
    if cred_path and os.path.isfile(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    # Priority 2: bundled service account file in repo root
    elif os.path.isfile("firebase-adminsdk.json"):
        cred = credentials.Certificate("firebase-adminsdk.json")
        firebase_admin.initialize_app(cred)
    # Priority 3: ADC (for cloud deployment)
    else:
        firebase_admin.initialize_app()


# ------------------------------------------------
# Decorators
# ------------------------------------------------

def require_auth(f):
    """
    Decorator to enforce Firebase authentication.
    - Expects Authorization: Bearer <idToken>
    - Verifies token
    - Ensures user exists in DB
    - Populates g.user with DB fields
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        id_token = auth_header.split(" ", 1)[1]

        try:
            decoded = admin_auth.verify_id_token(id_token)
        except Exception as e:
            return jsonify({"error": "Invalid or expired token", "details": str(e)}), 401

        firebase_uid = decoded.get("uid")
        email = decoded.get("email")
        name = decoded.get("name") or decoded.get("displayName")
        avatar_url = decoded.get("picture")

        # Ensure user exists in DB (updates last_login timestamp)
        user = user_service.ensure_user(
            firebase_uid=firebase_uid,
            email=email,
            name=name,
            avatar_url=avatar_url,
            update_last_login=True,
        )

        # Attach to request context
        g.user = {
            "user_id": user["id"],
            "firebase_uid": user["firebase_uid"],
            "email": user.get("email"),
            "name": user.get("name"),
            "role": user.get("role"),
            "is_admin": 1 if user.get("role") == "admin" else 0,
        }

        return f(*args, **kwargs)

    return decorated


def require_admin(f):
    """
    Decorator to require admin role.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not getattr(g, "user", None):
            return jsonify({"error": "Unauthorized"}), 401
        if g.user.get("role") != "admin":
            return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)
    return decorated
