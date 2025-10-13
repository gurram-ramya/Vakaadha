# utils/auth.py

import logging
import os
from functools import wraps
from flask import request, jsonify, g
from datetime import datetime
from firebase_admin import auth as firebase_auth, credentials
import firebase_admin


# -------------------------------------------------------------
# Firebase Initialization
# -------------------------------------------------------------
def initialize_firebase():
    """
    Initializes the Firebase Admin SDK once at application startup.
    This must be called before any token verification.
    """
    if firebase_admin._apps:
        logging.info("Firebase already initialized; skipping re-initialization.")
        return

    try:
        # Prefer environment variable
        service_account_path = os.getenv("FIREBASE_CREDENTIALS")

        if service_account_path and os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            logging.info(f"Using Firebase credentials from environment: {service_account_path}")
        else:
            # Fallback to local service account file
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
# Helper: Extract Bearer Token
# -------------------------------------------------------------
def extract_token():
    """
    Extract Bearer token from the Authorization header.
    Returns (token, error_code) tuple.
    """
    auth_header = request.headers.get("Authorization", None)
    if not auth_header:
        return None, "unauthorized_missing_token"

    parts = auth_header.split()
    if parts[0].lower() != "bearer" or len(parts) != 2:
        return None, "unauthorized_malformed_token"

    return parts[1], None


# -------------------------------------------------------------
# Helper: Standardized Error Response
# -------------------------------------------------------------
def auth_error_response(error_code, message):
    """
    Returns standardized JSON 401 response for authentication errors.
    """
    response = jsonify({"error": error_code, "message": message})
    response.status_code = 401
    return response


# -------------------------------------------------------------
# Custom Auth Error Class
# -------------------------------------------------------------
class AuthError(Exception):
    """
    Represents Firebase authentication failures with specific codes.
    """
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


# -------------------------------------------------------------
# Core: Verify Firebase ID Token
# -------------------------------------------------------------
def verify_firebase_token(token):
    """
    Verifies Firebase ID token and returns decoded claims.
    Raises AuthError on failure.
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
    Flask route decorator that enforces Firebase authentication.
    Sets g.user on success.
    If optional=True, allows missing/invalid tokens and continues with g.user=None.
    """
    def decorator(f):
        @wraps(f)  # Critical to preserve the original function name for Flask endpoint registration
        def wrapper(*args, **kwargs):
            token, error_code = extract_token()

            # No token case
            if not token:
                if optional:
                    g.user = None
                    logging.info({
                        "event": "auth_skipped",
                        "reason": "no_token_provided",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    return f(*args, **kwargs)
                return auth_error_response(error_code, "Missing or malformed Authorization header")

            # Validate token
            try:
                decoded = verify_firebase_token(token)
                g.user = {
                    "firebase_uid": decoded.get("uid"),
                    "email": decoded.get("email"),
                    "name": decoded.get("name"),
                    "email_verified": decoded.get("email_verified", False)
                }

                logging.info({
                    "event": "auth_success",
                    "uid": g.user["firebase_uid"],
                    "email": g.user["email"],
                    "timestamp": datetime.utcnow().isoformat()
                })

                return f(*args, **kwargs)

            except AuthError as e:
                logging.warning({
                    "event": "auth_failure",
                    "error": e.code,
                    "message": e.message,
                    "timestamp": datetime.utcnow().isoformat()
                })
                if optional:
                    g.user = None
                    return f(*args, **kwargs)
                return auth_error_response(e.code, e.message)

            except Exception as e:
                logging.error({
                    "event": "auth_unexpected_error",
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                })
                if optional:
                    g.user = None
                    return f(*args, **kwargs)
                return auth_error_response("auth_verification_failed", "Unexpected authentication error")

        return wrapper
    return decorator
