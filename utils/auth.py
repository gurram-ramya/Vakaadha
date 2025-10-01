# utils/auth.py
import os
from functools import wraps
from flask import request, jsonify, g
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from domain.users import service as user_service

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cred_path = os.path.join(BASE_DIR, "firebase-adminsdk.json")

if not firebase_admin._apps:
    if not os.path.exists(cred_path):
        raise RuntimeError(f"Firebase credential file not found: {cred_path}")
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)


def require_auth(fn):
    @wraps(fn)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        id_token = auth_header.split(" ", 1)[1]

        try:
            decoded_token = firebase_auth.verify_id_token(id_token)
        except Exception as e:
            return jsonify({"error": f"Invalid token: {str(e)}"}), 401

        firebase_uid = decoded_token.get("uid")
        email = decoded_token.get("email")
        name = decoded_token.get("name")

        if not firebase_uid:
            return jsonify({"error": "Invalid Firebase UID"}), 401

        # Optional guest_id for merge (sent during login/register)
        guest_id = None
        try:
            payload = request.get_json(silent=True)
            if payload and isinstance(payload, dict):
                guest_id = payload.get("guest_id")
        except Exception:
            guest_id = None

        # Ensure user exists (handles cart + guest merge)
        user = user_service.ensure_user(
            firebase_uid=firebase_uid,
            email=email,
            name=name,
            update_last_login=True,
            guest_id=guest_id,
        )

        g.user = {
            "user_id": user["user_id"],
            "firebase_uid": firebase_uid,
            "email": user.get("email"),
            "name": user.get("name"),
            "is_admin": user.get("is_admin", 0),
        }

        # Debug trace
        print("[DEBUG require_auth] g.user:", g.user)

        return fn(*args, **kwargs)

    return decorated
