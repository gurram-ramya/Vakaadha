# utils/auth.py
from __future__ import annotations
import os
from functools import wraps
from typing import Callable, Optional, Dict

from flask import request, jsonify, g

import firebase_admin
from firebase_admin import credentials, auth as admin_auth

# --- Firebase Admin init (once) ---
def _init_firebase_admin():
    if not firebase_admin._apps:
        # Try common locations; prefer explicit path via env
        key_path = os.getenv("FIREBASE_ADMIN_CREDENTIALS") or os.path.join(
            os.path.dirname(__file__), "..", "firebase-adminsdk.json"
        )
        key_path = os.path.abspath(key_path)
        if os.path.exists(key_path):
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)
        else:
            # Fallback: Application Default Credentials (e.g., on GCP)
            firebase_admin.initialize_app()

_init_firebase_admin()


def _parse_bearer_token() -> Optional[str]:
    h = request.headers.get("Authorization", "")
    if not h.startswith("Bearer "):
        return None
    return h.split(" ", 1)[1].strip()


def _verify_firebase_id_token(id_token: str) -> Dict:
    """
    Verify Firebase ID token and return decoded claims.
    Raises on invalid/expired tokens.
    """
    return admin_auth.verify_id_token(id_token, check_revoked=False)


def require_auth(f: Callable):
    """
    Ensures the request has a valid Firebase ID token.
    - Verifies the token using Firebase Admin
    - Upserts/loads a local DB user via users.service.ensure_user(...)
    - Attaches a stable request-scoped identity at g.user:
      {
        uid: <firebase uid>,
        email: <email from token>,
        name: <display name from token (if any)>,
        email_verified: <bool>,
        user_id: <local users.id>,
        role: <'user' or existing role>
      }
    """
    @wraps(f)
    def _wrap(*args, **kwargs):
        token = _parse_bearer_token()
        if not token:
            return jsonify({"error": "missing_authorization", "detail": "Authorization: Bearer <idToken> required"}), 401

        try:
            
            # print("🧪 [AUTH] Raw Authorization header:", request.headers.get("Authorization"))  
            # print("🧪 [AUTH] Extracted token (start):", token[:40], "...")
            # print("🧪 [AUTH] Request path:", request.path)
            decoded = _verify_firebase_id_token(token)
        except Exception as e:
            return jsonify({
                "error": "invalid_token",
                "detail": "Firebase token invalid or expired. Please login again.",
                "exception": str(e)
            }), 401
        # Extract identity bits from token
        uid = decoded.get("uid")
        email = decoded.get("email")
        # Firebase claims may expose name under 'name' or 'displayName'
        name = decoded.get("name") or decoded.get("displayName")
        picture = decoded.get("picture")
        email_verified = bool(decoded.get("email_verified"))

        if not uid:
            return jsonify({"error": "invalid_token", "detail": "uid missing"}), 401

        # Upsert local user and ensure we have a local users.id
        from domain.users import service as users_service
        db_user = users_service.ensure_user(
            firebase_uid=uid,
            email=email,
            name=name,                # may be None; service handles keep-or-update logic
            avatar_url=picture,
            update_last_login=True,
        )

        # Normalize role and local id
        local_id = db_user.get("id") or db_user.get("user_id")
        role = db_user.get("role") or "user"

        # Attach request identity
        g.user = {
            "uid": uid,
            "email": email,
            "name": db_user.get("name") or name or (email.split("@")[0] if email else None),
            "email_verified": email_verified,
            "user_id": local_id,
            "role": role,
        }
        return f(*args, **kwargs)

    return _wrap


def require_admin(f: Callable):
    """
    Example admin guard. Your schema defaults to 'user'; only 'admin' passes here.
    """
    @wraps(f)
    def _wrap(*args, **kwargs):
        user = getattr(g, "user", None)
        if not user:
            return jsonify({"error": "unauthorized"}), 401
        if user.get("role") != "admin":
            return jsonify({"error": "forbidden", "detail": "admin_only"}), 403
        return f(*args, **kwargs)
    return _wrap
