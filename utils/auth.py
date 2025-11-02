# utils/auth.py — final corrected version
import logging
import os
import re
from functools import wraps
from flask import request, jsonify, g, make_response
from datetime import datetime
from uuid import uuid4
from firebase_admin import auth as firebase_auth, credentials
import firebase_admin
from utils.cache import cached, firebase_token_cache, lock

# ===========================================================
# FIREBASE INITIALIZATION
# ===========================================================
def initialize_firebase():
    import traceback
    logging.info("initialize_firebase() called")

    if firebase_admin._apps:
        logging.info("Firebase already initialized; skipping re-init.")
        return

    try:
        service_account_path = os.getenv("FIREBASE_CREDENTIALS")
        if service_account_path and os.path.exists(service_account_path):
            cred_path = service_account_path
            logging.info(f"Using credentials from env: {cred_path}")
        else:
            from pathlib import Path
            cred_path = Path(__file__).resolve().parents[1] / "firebase-adminsdk.json"
            logging.info(f"Using local credentials: {cred_path}")

        if not os.path.exists(cred_path):
            raise FileNotFoundError(f"Credential file not found: {cred_path}")

        cred = credentials.Certificate(str(cred_path))
        app = firebase_admin.initialize_app(cred)
        logging.info(f"Firebase Admin initialized successfully. App name={app.name}")
    except Exception as e:
        logging.critical("Firebase initialization failed: %s", e)
        traceback.print_exc()
        raise


# ===========================================================
# COOKIE + GUEST UTILITIES
# ===========================================================
GUEST_COOKIE = "guest_id"
GUEST_COOKIE_MAX_AGE = 7 * 24 * 3600


def _resolve_guest_context():
    """Stable guest_id; never regenerate within same browser session."""
    gid = request.cookies.get(GUEST_COOKIE)
    if gid and re.fullmatch(r"[0-9a-fA-F-]{20,64}", gid):
        g.guest_id = gid
        g.new_guest = False
        return gid

    # if cookie missing, create new and mark for immediate set
    new_gid = str(uuid4())
    g.guest_id = new_gid
    g.new_guest = True
    g.defer_guest_cookie = True
    logging.info({"event": "guest_context_created", "guest_id": new_gid})
    return new_gid


def _set_guest_cookie(resp, guest_id=None, replace=False):
    """Set guest cookie only once per response."""
    # skip static/preflight requests
    if request.method == "OPTIONS" or request.path.startswith("/static") or request.path.endswith(
        (".css", ".js", ".png", ".jpg", ".ico", ".svg")
    ):
        return resp

    if getattr(g, "guest_cookie_written", False):
        return resp

    current_cookie = request.cookies.get(GUEST_COOKIE)
    if not replace and current_cookie == guest_id:
        return resp

    if not guest_id:
        guest_id = getattr(g, "guest_id", None) or str(uuid4())

    is_https = request.is_secure or os.getenv("FORCE_SECURE_COOKIE") == "1"
    resp.set_cookie(
        GUEST_COOKIE,
        guest_id,
        max_age=GUEST_COOKIE_MAX_AGE,
        httponly=True,
        secure=is_https,
        samesite="Lax",
        path="/",
    )
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    resp.headers["Access-Control-Expose-Headers"] = "Set-Cookie"
    g.guest_cookie_written = True
    logging.info({"event": "guest_cookie_set", "guest_id": guest_id})
    return resp


# ===========================================================
# TOKEN EXTRACTION + VERIFICATION
# ===========================================================
def _extract_token():
    auth_header = request.headers.get("Authorization", None)
    if not auth_header:
        return None, "unauthorized_missing_token"
    parts = auth_header.split()
    if parts[0].lower() != "bearer" or len(parts) != 2:
        return None, "unauthorized_malformed_token"
    return parts[1], None


class AuthError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


@cached(cache=firebase_token_cache, lock=lock)
def verify_firebase_token(token):
    """Firebase token verification with caching."""
    try:
        decoded = firebase_auth.verify_id_token(token, check_revoked=True)
        return decoded
    except Exception as e:
        msg = str(e).lower()
        if "expired" in msg:
            raise AuthError("token_expired", "Firebase ID token expired")
        elif "revoked" in msg:
            raise AuthError("token_revoked", "Firebase ID token revoked")
        elif "invalid" in msg:
            raise AuthError("invalid_token", "Invalid Firebase ID token")
        else:
            raise AuthError("auth_verification_failed", str(e))


# ===========================================================
# DECORATOR: REQUIRE AUTH (USER-FIRST)
# ===========================================================
def require_auth(optional=False):
    """
    Enforce Firebase authentication if available.
    optional=True → allows guest fallback.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            token, token_error = _extract_token()
            g.user = None
            g.actor = {"user_id": None, "guest_id": None, "is_authenticated": False}

            if token:
                try:
                    decoded = verify_firebase_token(token)
                    g.user = {
                        "firebase_uid": decoded.get("uid"),
                        "email": decoded.get("email"),
                        "name": decoded.get("name"),
                        "email_verified": decoded.get("email_verified", False),
                    }
                    g.actor.update({
                        "is_authenticated": True,
                        "firebase_uid": g.user["firebase_uid"],
                        "guest_id": None,
                    })
                    return func(*args, **kwargs)
                except AuthError as e:
                    if not optional:
                        return jsonify({"error": e.code, "message": e.message}), 401
                except Exception as e:
                    if not optional:
                        return jsonify({"error": "auth_verification_failed", "message": str(e)}), 401

            # guest fallback — single creation per request
            gid = _resolve_guest_context()
            g.actor.update({"guest_id": gid, "is_authenticated": False})
            if not optional and not gid:
                return jsonify({"error": "invalid_guest"}), 401

            return func(*args, **kwargs)
        return wrapper
    return decorator


# ===========================================================
# REQUIRE GUEST (EXPLICIT GUEST-ONLY ROUTES)
# ===========================================================
def require_guest(func):
    """Ensure guest_id is valid when no authenticated user present."""
    @wraps(func)
    def _wrapped(*args, **kwargs):
        gid = request.args.get("guest_id") or request.cookies.get(GUEST_COOKIE)
        if getattr(g, "user", None):
            return func(*args, **kwargs)
        if not gid or not re.fullmatch(r"[0-9a-fA-F-]{20,64}", gid):
            return jsonify({"error": "invalid_guest_id"}), 400
        g.guest_id = gid
        g.actor = {"user_id": None, "guest_id": gid, "is_authenticated": False}
        return func(*args, **kwargs)
    return _wrapped


# ===========================================================
# LOGOUT HANDLER SUPPORT
# ===========================================================
def perform_logout_response():
    """
    Called during /api/auth/logout.
    Rotates guest cookie once, resets user context.
    """
    resp = make_response(jsonify({"status": "logged_out"}))
    resp.delete_cookie(GUEST_COOKIE)
    new_guest_id = str(uuid4())
    _set_guest_cookie(resp, new_guest_id, replace=True)
    g.user = None
    g.actor = {"user_id": None, "guest_id": new_guest_id, "is_authenticated": False}
    logging.info({
        "event": "user_logout",
        "guest_id": new_guest_id,
        "timestamp": datetime.utcnow().isoformat(),
    })
    return resp


# ===========================================================
# CONTEXT ACCESSOR
# ===========================================================
def get_current_actor():
    """Return unified session context."""
    if hasattr(g, "actor"):
        return g.actor
    return {"user_id": None, "guest_id": None, "is_authenticated": False}
