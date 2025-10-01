# utils/auth.py
import os
from functools import wraps
from flask import request, jsonify, g
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from domain.users import service as user_service
from domain.cart import service as cart_service  # <-- added import

# ----------------------------
# Firebase Admin Initialization
# ----------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cred_path = os.path.join(BASE_DIR, "firebase-adminsdk.json")  # <-- updated name

if not firebase_admin._apps:
    if not os.path.exists(cred_path):
        raise RuntimeError(f"Firebase credential file not found: {cred_path}")
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)


# ----------------------------
# Decorator to enforce authentication
# ----------------------------
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

        # Ensure user exists in DB
        user = user_service.ensure_user(
            firebase_uid=firebase_uid,
            email=email,
            name=name,
            update_last_login=True,
        )

        # Ensure cart exists for this user
        cart_service.get_or_create_cart(user_id=user["user_id"], guest_id=None)

        g.user = {
            "user_id": user["user_id"],
            "firebase_uid": firebase_uid,
            "email": user.get("email"),
            "name": user.get("name"),
            "is_admin": user.get("is_admin", 0),
        }

        return fn(*args, **kwargs)

    return decorated
