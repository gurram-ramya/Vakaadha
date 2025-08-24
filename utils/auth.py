# utils/auth.py

import firebase_admin
from firebase_admin import auth, credentials
from flask import request, jsonify, g
from functools import wraps
import os

# 🔐 Load Firebase credentials
FIREBASE_KEY_PATH = os.path.join(os.path.dirname(__file__), '..', 'firebase-adminsdk.json')
if not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_KEY_PATH)
    firebase_admin.initialize_app(cred)


def verify_firebase_token(id_token):
    try:
        return auth.verify_id_token(id_token)
    except Exception as e:
        print("Firebase Token Error:", e)
        return None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization header missing or malformed"}), 401

        token = auth_header.split(" ")[1]
        decoded_token = verify_firebase_token(token)
        if not decoded_token:
            return jsonify({"error": "Invalid Firebase token"}), 401

        # ✅ Make user info available to routes
        g.user = {
            "uid": decoded_token.get("uid"),
            "email": decoded_token.get("email"),
            "name": decoded_token.get("name", ""),
            "phone": decoded_token.get("phone_number")
        }
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "user") or not g.user:
            return jsonify({"error": "Unauthorized"}), 401

        from domain.users import service
        db_user = service.get_user_by_firebase_uid(g.user["uid"])
        if not db_user or db_user["role"] != "admin":
            return jsonify({"error": "Admin access required"}), 403

        return f(*args, **kwargs)
    return decorated
