# # utils/auth.py

# import firebase_admin
# from firebase_admin import auth, credentials
# from flask import request, jsonify, g
# from functools import wraps
# import os

# # 🔐 Load Firebase credentials
# FIREBASE_KEY_PATH = os.path.join(os.path.dirname(__file__), '..', 'firebase-adminsdk.json')
# if not firebase_admin._apps:
#     cred = credentials.Certificate(FIREBASE_KEY_PATH)
#     firebase_admin.initialize_app(cred)


# def verify_firebase_token(id_token):
#     try:
#         return auth.verify_id_token(id_token)
#     except Exception as e:
#         print("Firebase Token Error:", e)
#         return None


# def require_auth(f):
#     @wraps(f)
#     def decorated(*args, **kwargs):
#         auth_header = request.headers.get("Authorization")
#         if not auth_header or not auth_header.startswith("Bearer "):
#             return jsonify({"error": "Authorization header missing or malformed"}), 401

#         token = auth_header.split(" ")[1]
#         decoded_token = verify_firebase_token(token)
#         if not decoded_token:
#             return jsonify({"error": "Invalid Firebase token"}), 401

#         # ✅ Make user info available to routes
#         g.user = {
#             "uid": decoded_token.get("uid"),
#             "email": decoded_token.get("email"),
#             "name": decoded_token.get("name", ""),
#             "phone": decoded_token.get("phone_number")
#         }
#         return f(*args, **kwargs)
#     return decorated


# def require_admin(f):
#     @wraps(f)
#     def decorated(*args, **kwargs):
#         if not hasattr(g, "user") or not g.user:
#             return jsonify({"error": "Unauthorized"}), 401

#         from domain.users import service
#         db_user = service.get_user_by_firebase_uid(g.user["uid"])
#         if not db_user or db_user["role"] != "admin":
#             return jsonify({"error": "Admin access required"}), 403

#         return f(*args, **kwargs)
#     return decorated

# utils/auth.py
"""
Auth utilities:
- Firebase Admin initialization
- require_auth decorator that verifies ID tokens
- require_admin decorator (checks role='admin' in DB)
"""

from __future__ import annotations

import os
from functools import wraps
from typing import Callable, Optional, Dict, Any

import firebase_admin
from firebase_admin import auth as admin_auth, credentials
from flask import request, jsonify, g

# ---- Initialize Firebase Admin (server-side) ----
# Looks for firebase-adminsdk.json next to this file by default.
_DEFAULT_KEY_PATH = os.path.join(os.path.dirname(__file__), "..", "firebase-adminsdk.json")
FIREBASE_KEY_PATH = os.environ.get("FIREBASE_ADMIN_KEY_PATH", _DEFAULT_KEY_PATH)

if not firebase_admin._apps:
    if not os.path.isfile(FIREBASE_KEY_PATH):
        raise RuntimeError(
            f"Firebase admin key not found at: {FIREBASE_KEY_PATH}. "
            "Set FIREBASE_ADMIN_KEY_PATH or place firebase-adminsdk.json accordingly."
        )
    cred = credentials.Certificate(FIREBASE_KEY_PATH)
    firebase_admin.initialize_app(cred)


# ---- Helpers ----
def _parse_bearer_token() -> Optional[str]:
    authz = request.headers.get("Authorization", "")
    parts = authz.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def verify_firebase_token(id_token: str) -> Dict[str, Any]:
    """
    Verify the Firebase ID token and return decoded claims.
    Raises on invalid/expired tokens.
    """
    # Allow a little skew to reduce flakiness in dev
    return admin_auth.verify_id_token(id_token, clock_skew_seconds=60)


# ---- Decorators ----
def require_auth(f: Callable):
    """
    Verifies Authorization: Bearer <idToken> and attaches g.user with:
    { uid, email, name, picture, phone }
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _parse_bearer_token()
        if not token:
            return jsonify({"error": "Authorization header missing or malformed"}), 401
        try:
            decoded = verify_firebase_token(token)
        except Exception as e:
            return jsonify({"error": "invalid_token", "detail": str(e)}), 401

        g.user = {
            "uid": decoded.get("uid"),
            "email": decoded.get("email"),
            "name": decoded.get("name") or decoded.get("displayName"),
            "picture": decoded.get("picture"),
            "phone": decoded.get("phone_number"),
        }
        if not g.user["uid"]:
            return jsonify({"error": "invalid_token"}), 401
        return f(*args, **kwargs)
    return decorated


def require_admin(f: Callable):
    """
    Requires a valid user (via require_auth) whose DB role is 'admin'.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, "user") or not g.user:
            return jsonify({"error": "Unauthorized"}), 401
        from domain.users import service
        db_user = service.get_user_by_firebase_uid(g.user["uid"])
        if not db_user or db_user.get("role") != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated
