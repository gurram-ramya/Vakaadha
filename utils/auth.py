# utils/auth.py
import logging
import os
from functools import wraps
from flask import request, jsonify, g, make_response
from datetime import datetime
from uuid import uuid4
from firebase_admin import auth as firebase_auth, credentials
import firebase_admin
from utils.cache import cached, firebase_token_cache, lock



# -------------------------------------------------------------
# Firebase Initialization
# -------------------------------------------------------------
def initialize_firebase():
    if firebase_admin._apps:
        logging.info("Firebase already initialized; skipping re-initialization.")
        return

    try:
        service_account_path = os.getenv("FIREBASE_CREDENTIALS")
        if service_account_path and os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            logging.info(f"Using Firebase credentials from environment: {service_account_path}")
        else:
            from pathlib import Path
            local_path = Path(__file__).resolve().parents[1] / "firebase-adminsdk.json"
            cred = credentials.Certificate(str(local_path))
            logging.info(f"Using local Firebase credentials: {local_path}")

        firebase_admin.initialize_app(cred)
        logging.info("Firebase Admin SDK initialized successfully.")
    except Exception as e:
        logging.critical(f"Firebase initialization failed: {str(e)}")
        raise RuntimeError("Failed to initialize Firebase Admin SDK.")


# -------------------------------------------------------------
# Guest Identity Handling
# -------------------------------------------------------------
def resolve_guest_context():
    """
    Ensures every request has a guest_id (for anonymous users).
    Stores it in flask.g and marks whether it was newly created.
    """
    gid = request.cookies.get("guest_id")
    if gid and len(gid) <= 64:
        g.guest_id = gid
        g.new_guest = False
        return gid

    # Create new guest_id
    gid = str(uuid4())
    g.guest_id = gid
    g.new_guest = True
    return gid


def _set_guest_cookie(resp, guest_id):
    """
    Apply secure cookie parameters and attach guest_id cookie to response.
    """
    is_https = request.is_secure or os.getenv("FORCE_SECURE_COOKIE") == "1"
    resp.set_cookie(
        "guest_id",
        guest_id,
        max_age=7 * 24 * 3600,  # 7 days TTL
        httponly=True,
        secure=is_https,
        samesite="Lax",
    )
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    resp.headers["Access-Control-Expose-Headers"] = "Set-Cookie"
    return resp


# -------------------------------------------------------------
# Token Extraction and Verification
# -------------------------------------------------------------
def extract_token():
    auth_header = request.headers.get("Authorization", None)
    if not auth_header:
        return None, "unauthorized_missing_token"

    parts = auth_header.split()
    if parts[0].lower() != "bearer" or len(parts) != 2:
        return None, "unauthorized_malformed_token"

    return parts[1], None


def auth_error_response(error_code, message):
    response = jsonify({"error": error_code, "message": message})
    response.status_code = 401
    return response


class AuthError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message




@cached(cache=firebase_token_cache, lock=lock)
def verify_firebase_token(token):
    """
    Verify a Firebase ID token with short-term caching.
    Cached tokens reduce repeated Firebase Admin SDK calls.
    """
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


# -------------------------------------------------------------
# Decorator: Require Authentication
# -------------------------------------------------------------
def require_auth(optional=False):
    """
    Decorator enforcing Firebase authentication, while always resolving guest_id.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Ensure guest context always exists
            resolve_guest_context()

            token, error_code = extract_token()

            # No token provided
            if not token:
                if optional:
                    g.user = None
                    logging.info({
                        "event": "auth_skipped",
                        "reason": "no_token_provided",
                        "guest_id": g.guest_id,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    return f(*args, **kwargs)
                return auth_error_response(error_code, "Missing or malformed Authorization header")

            # Validate token via Firebase
            try:
                decoded = verify_firebase_token(token)
                g.user = {
                    "firebase_uid": decoded.get("uid"),
                    "email": decoded.get("email"),
                    "name": decoded.get("name"),
                    "email_verified": decoded.get("email_verified", False),
                }

                logging.info({
                    "event": "auth_success",
                    "uid": g.user["firebase_uid"],
                    "guest_id": g.guest_id,
                    # "ip": request.remote_addr,
                    "timestamp": datetime.utcnow().isoformat(),
                })
                return f(*args, **kwargs)

            except AuthError as e:
                logging.warning({
                    "event": "auth_failure",
                    "error": e.code,
                    "message": e.message,
                    "guest_id": g.guest_id,
                    "timestamp": datetime.utcnow().isoformat(),
                })
                if optional:
                    g.user = None
                    return f(*args, **kwargs)
                return auth_error_response(e.code, e.message)

            except Exception as e:
                logging.error({
                    "event": "auth_unexpected_error",
                    "error": str(e),
                    "guest_id": g.guest_id,
                    "timestamp": datetime.utcnow().isoformat(),
                })
                if optional:
                    g.user = None
                    return f(*args, **kwargs)
                return auth_error_response("auth_verification_failed", "Unexpected authentication error")

        return wrapper
    return decorator
