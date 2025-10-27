# utils/auth.py
# import logging
# import os
# from functools import wraps
# from flask import request, jsonify, g, make_response
# from datetime import datetime
# from uuid import uuid4
# from firebase_admin import auth as firebase_auth, credentials
# import firebase_admin
# from utils.cache import cached, firebase_token_cache, lock



# -------------------------------------------------------------
# Firebase Initialization
# -------------------------------------------------------------
# def initialize_firebase():
#     if firebase_admin._apps:
#         logging.info("Firebase already initialized; skipping re-initialization.")
#         return

#     try:
#         service_account_path = os.getenv("FIREBASE_CREDENTIALS")
#         if service_account_path and os.path.exists(service_account_path):
#             cred = credentials.Certificate(service_account_path)
#             logging.info(f"Using Firebase credentials from environment: {service_account_path}")
#         else:
#             from pathlib import Path
#             local_path = Path(__file__).resolve().parents[1] / "firebase-adminsdk.json"
#             logging.info(f"Looking for local Firebase credentials at: {local_path}")
#             cred = credentials.Certificate(str(local_path))
#             logging.info(f"Using local Firebase credentials: {local_path}")

#         firebase_admin.initialize_app(cred)
#         logging.info("Firebase Admin SDK initialized successfully. App name={app.name}")
#     except Exception as e:
#         logging.critical(f"Firebase initialization failed: {str(e)}")
#         raise RuntimeError("Failed to initialize Firebase Admin SDK.")

# utils/auth.py
import logging
import os
from functools import wraps
from flask import request, jsonify, g
from datetime import datetime
from uuid import uuid4
from firebase_admin import auth as firebase_auth, credentials
import firebase_admin
from utils.cache import cached, firebase_token_cache, lock


# -------------------------------------------------------------
# Firebase Initialization
# -------------------------------------------------------------
def initialize_firebase():
    import traceback
    logging.info("🔥 initialize_firebase() called")

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
        logging.info(f"✅ Firebase Admin initialized successfully. App name={app.name}")

        # Debug Firebase project info
        try:
            proj_id = firebase_admin.get_app().project_id
            logging.info(f"🔧 Firebase Admin project_id={proj_id}")
        except Exception:
            logging.warning("⚠️ Could not retrieve Firebase project_id for debug check.")

    except Exception as e:
        logging.critical("❌ Firebase initialization failed: %s", e)
        traceback.print_exc()
        raise


# -------------------------------------------------------------
# Guest Identity Handling
# -------------------------------------------------------------
def resolve_guest_context():
    gid = request.cookies.get("guest_id")
    if gid and len(gid) <= 64:
        g.guest_id = gid
        g.new_guest = False
        return gid

    gid = str(uuid4())
    g.guest_id = gid
    g.new_guest = True
    return gid


def _set_guest_cookie(resp, guest_id):
    is_https = request.is_secure or os.getenv("FORCE_SECURE_COOKIE") == "1"
    resp.set_cookie(
        "guest_id",
        guest_id,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=is_https,
        samesite="Lax",
    )
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    resp.headers["Access-Control-Expose-Headers"] = "Set-Cookie"
    return resp


# -------------------------------------------------------------
# Token Extraction + Verification
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


# -------------------------------------------------------------
# Firebase Token Verification (with debug)
# -------------------------------------------------------------
@cached(cache=firebase_token_cache, lock=lock)
def verify_firebase_token(token):
    """
    Verify a Firebase ID token with short-term caching.
    Added verbose debugging output.
    """
    logging.info(f"🔍 Verifying token (first 60 chars): {token[:60]}...")
    try:
        decoded = firebase_auth.verify_id_token(token, check_revoked=True)

        uid = decoded.get("uid")
        email = decoded.get("email")
        aud = decoded.get("aud")
        iss = decoded.get("iss")
        project_id = firebase_admin.get_app().project_id if firebase_admin._apps else "unknown"

        logging.info({
            "event": "firebase_token_verified",
            "uid": uid,
            "email": email,
            "aud": aud,
            "iss": iss,
            "project_id_admin": project_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        return decoded

    except Exception as e:
        msg = str(e).lower()
        logging.error({
            "event": "firebase_token_error",
            "error": str(e),
            "token_snippet": token[:30] + "...",
            "timestamp": datetime.utcnow().isoformat()
        })
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
            resolve_guest_context()
            token, error_code = extract_token()

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
                    "email": g.user.get("email"),
                    "guest_id": g.guest_id,
                    "ip": request.remote_addr,
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
