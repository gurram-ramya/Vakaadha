# # # utils/auth.py — final corrected version
# # import logging
# # import os
# # import re
# # from functools import wraps
# # from flask import request, jsonify, g, make_response
# # from datetime import datetime
# # from uuid import uuid4
# # from firebase_admin import auth as firebase_auth, credentials
# # import firebase_admin
# # from utils.cache import cached, firebase_token_cache, lock

# # # ===========================================================
# # # FIREBASE INITIALIZATION
# # # ===========================================================
# # def initialize_firebase():
# #     import traceback
# #     logging.info("initialize_firebase() called")

# #     if firebase_admin._apps:
# #         logging.info("Firebase already initialized; skipping re-init.")
# #         return

# #     try:
# #         service_account_path = os.getenv("FIREBASE_CREDENTIALS")
# #         if service_account_path and os.path.exists(service_account_path):
# #             cred_path = service_account_path
# #             logging.info(f"Using credentials from env: {cred_path}")
# #         else:
# #             from pathlib import Path
# #             cred_path = Path(__file__).resolve().parents[1] / "firebase-adminsdk.json"
# #             logging.info(f"Using local credentials: {cred_path}")

# #         if not os.path.exists(cred_path):
# #             raise FileNotFoundError(f"Credential file not found: {cred_path}")

# #         cred = credentials.Certificate(str(cred_path))
# #         app = firebase_admin.initialize_app(cred)
# #         logging.info(f"Firebase Admin initialized successfully. App name={app.name}")
# #     except Exception as e:
# #         logging.critical("Firebase initialization failed: %s", e)
# #         traceback.print_exc()
# #         raise


# # # ===========================================================
# # # COOKIE + GUEST UTILITIES
# # # ===========================================================
# # GUEST_COOKIE = "guest_id"
# # GUEST_COOKIE_MAX_AGE = 7 * 24 * 3600


# # def _resolve_guest_context():
# #     """Stable guest_id; never regenerate within same browser session."""
# #     gid = request.cookies.get(GUEST_COOKIE)
# #     if gid and re.fullmatch(r"[0-9a-fA-F-]{20,64}", gid):
# #         g.guest_id = gid
# #         g.new_guest = False
# #         return gid

# #     # if cookie missing, create new and mark for immediate set
# #     new_gid = str(uuid4())
# #     g.guest_id = new_gid
# #     g.new_guest = True
# #     g.defer_guest_cookie = True
# #     logging.info({"event": "guest_context_created", "guest_id": new_gid})
# #     return new_gid


# # def _set_guest_cookie(resp, guest_id=None, replace=False):
# #     """Set guest cookie only once per response."""
# #     # skip static/preflight requests
# #     if request.method == "OPTIONS" or request.path.startswith("/static") or request.path.endswith(
# #         (".css", ".js", ".png", ".jpg", ".ico", ".svg")
# #     ):
# #         return resp

# #     if getattr(g, "guest_cookie_written", False):
# #         return resp

# #     current_cookie = request.cookies.get(GUEST_COOKIE)
# #     if not replace and current_cookie == guest_id:
# #         return resp

# #     if not guest_id:
# #         guest_id = getattr(g, "guest_id", None) or str(uuid4())

# #     is_https = request.is_secure or os.getenv("FORCE_SECURE_COOKIE") == "1"
# #     resp.set_cookie(
# #         GUEST_COOKIE,
# #         guest_id,
# #         max_age=GUEST_COOKIE_MAX_AGE,
# #         httponly=True,
# #         secure=is_https,
# #         samesite="Lax",
# #         path="/",
# #     )
# #     resp.headers["Access-Control-Allow-Credentials"] = "true"
# #     resp.headers["Access-Control-Expose-Headers"] = "Set-Cookie"
# #     g.guest_cookie_written = True
# #     logging.info({"event": "guest_cookie_set", "guest_id": guest_id})
# #     return resp


# # # ===========================================================
# # # TOKEN EXTRACTION + VERIFICATION
# # # ===========================================================
# # def _extract_token():
# #     auth_header = request.headers.get("Authorization", None)
# #     if not auth_header:
# #         return None, "unauthorized_missing_token"
# #     parts = auth_header.split()
# #     if parts[0].lower() != "bearer" or len(parts) != 2:
# #         return None, "unauthorized_malformed_token"
# #     return parts[1], None


# # class AuthError(Exception):
# #     def __init__(self, code, message):
# #         super().__init__(message)
# #         self.code = code
# #         self.message = message


# # @cached(cache=firebase_token_cache, lock=lock)
# # def verify_firebase_token(token):
# #     """Firebase token verification with caching."""
# #     try:
# #         decoded = firebase_auth.verify_id_token(token, check_revoked=True)
# #         return decoded
# #     except Exception as e:
# #         msg = str(e).lower()
# #         if "expired" in msg:
# #             raise AuthError("token_expired", "Firebase ID token expired")
# #         elif "revoked" in msg:
# #             raise AuthError("token_revoked", "Firebase ID token revoked")
# #         elif "invalid" in msg:
# #             raise AuthError("invalid_token", "Invalid Firebase ID token")
# #         else:
# #             raise AuthError("auth_verification_failed", str(e))


# # # ===========================================================
# # # DECORATOR: REQUIRE AUTH (USER-FIRST)
# # # ===========================================================
# # def require_auth(optional=False):
# #     """
# #     Enforce Firebase authentication if available.
# #     optional=True → allows guest fallback.
# #     """
# #     def decorator(func):
# #         @wraps(func)
# #         def wrapper(*args, **kwargs):
# #             token, token_error = _extract_token()
# #             g.user = None
# #             g.actor = {"user_id": None, "guest_id": None, "is_authenticated": False}

# #             if token:
# #                 try:
# #                     decoded = verify_firebase_token(token)
# #                     g.user = {
# #                         "firebase_uid": decoded.get("uid"),
# #                         "email": decoded.get("email"),
# #                         "name": decoded.get("name"),
# #                         "email_verified": decoded.get("email_verified", False),
# #                     }
        
# #                     # Enrich user context from DB (ensures user_id present)
# #                     from domain.users import repository
# #                     db_user = repository.get_user_by_uid(g.user["firebase_uid"])
# #                     if db_user:
# #                         if isinstance(db_user, dict):
# #                             g.user["user_id"] = db_user.get("user_id")
# #                         else:
# #                             g.user["user_id"] = db_user["user_id"]

# #                     g.actor.update({
# #                         "is_authenticated": True,
# #                         "firebase_uid": g.user["firebase_uid"],
# #                         "guest_id": None,
# #                     })
# #                     return func(*args, **kwargs)
# #                 except AuthError as e:
# #                     if not optional:
# #                         return jsonify({"error": e.code, "message": e.message}), 401
# #                 except Exception as e:
# #                     if not optional:
# #                         return jsonify({"error": "auth_verification_failed", "message": str(e)}), 401

# #             # guest fallback — single creation per request
# #             gid = _resolve_guest_context()
# #             g.actor.update({"guest_id": gid, "is_authenticated": False})
# #             if not optional and not gid:
# #                 return jsonify({"error": "invalid_guest"}), 401

# #             return func(*args, **kwargs)
# #         return wrapper
# #     return decorator


# # # ===========================================================
# # # REQUIRE GUEST (EXPLICIT GUEST-ONLY ROUTES)
# # # ===========================================================
# # def require_guest(func):
# #     """Ensure guest_id is valid when no authenticated user present."""
# #     @wraps(func)
# #     def _wrapped(*args, **kwargs):
# #         gid = request.args.get("guest_id") or request.cookies.get(GUEST_COOKIE)
# #         if getattr(g, "user", None):
# #             return func(*args, **kwargs)
# #         if not gid or not re.fullmatch(r"[0-9a-fA-F-]{20,64}", gid):
# #             return jsonify({"error": "invalid_guest_id"}), 400
# #         g.guest_id = gid
# #         g.actor = {"user_id": None, "guest_id": gid, "is_authenticated": False}
# #         return func(*args, **kwargs)
# #     return _wrapped


# # # ===========================================================
# # # LOGOUT HANDLER SUPPORT
# # # ===========================================================
# # def perform_logout_response():
# #     """
# #     Called during /api/auth/logout.
# #     Rotates guest cookie once, resets user context.
# #     """
# #     resp = make_response(jsonify({"status": "logged_out"}))
# #     resp.delete_cookie(GUEST_COOKIE)
# #     new_guest_id = str(uuid4())
# #     _set_guest_cookie(resp, new_guest_id, replace=True)
# #     g.user = None
# #     g.actor = {"user_id": None, "guest_id": new_guest_id, "is_authenticated": False}
# #     logging.info({
# #         "event": "user_logout",
# #         "guest_id": new_guest_id,
# #         "timestamp": datetime.utcnow().isoformat(),
# #     })
# #     return resp


# # # ===========================================================
# # # CONTEXT ACCESSOR
# # # ===========================================================
# # def get_current_actor():
# #     """Return unified session context."""
# #     if hasattr(g, "actor"):
# #         return g.actor
# #     return {"user_id": None, "guest_id": None, "is_authenticated": False}

# #---------------- pgsql ----------------------

# # utils/auth.py
# import logging
# import os
# import re
# from functools import wraps
# from flask import request, jsonify, g, make_response
# from datetime import datetime
# from uuid import uuid4

# import firebase_admin
# from firebase_admin import auth as firebase_auth, credentials

# from utils.cache import cached, firebase_token_cache, lock

# # Public names used by routes: _set_guest_cookie, require_auth, require_guest, perform_logout_response, get_current_actor
# GUEST_COOKIE = "guest_id"
# GUEST_COOKIE_MAX_AGE = 7 * 24 * 3600


# # ===========================================================
# # FIREBASE INITIALIZATION
# # ===========================================================
# def initialize_firebase():
#     """Initialize Firebase admin SDK once. Raises on failure."""
#     if firebase_admin._apps:
#         logging.info("Firebase already initialized; skipping.")
#         return

#     service_account_path = os.getenv("FIREBASE_CREDENTIALS")
#     if service_account_path and os.path.exists(service_account_path):
#         cred_path = service_account_path
#     else:
#         from pathlib import Path
#         cred_path = Path(__file__).resolve().parents[1] / "firebase-adminsdk.json"

#     if not os.path.exists(cred_path):
#         raise FileNotFoundError(f"Firebase credentials not found at {cred_path}")

#     cred = credentials.Certificate(str(cred_path))
#     app = firebase_admin.initialize_app(cred)
#     logging.info(f"Firebase initialized. App name={app.name}")


# # ===========================================================
# # GUEST COOKIE / CONTEXT HELPERS
# # ===========================================================
# def _resolve_guest_context():
#     """
#     Ensure a stable guest_id for the incoming request.
#     Sets g.guest_id and g.new_guest.
#     Returns the guest_id.
#     """
#     gid = request.cookies.get(GUEST_COOKIE)
#     if gid and re.fullmatch(r"[0-9a-fA-F-]{20,64}", gid):
#         g.guest_id = gid
#         g.new_guest = False
#         return gid

#     new_gid = str(uuid4())
#     g.guest_id = new_gid
#     g.new_guest = True
#     # used by routes to decide whether to write cookie back
#     g.defer_guest_cookie = True
#     logging.info({"event": "guest_context_created", "guest_id": new_gid})
#     return new_gid


# def _set_guest_cookie(resp, guest_id: str | None = None, replace: bool = False):
#     """
#     Set or replace guest cookie on the response.

#     Signature kept to match existing call-sites:
#         _set_guest_cookie(resp, guest_id, replace=True)

#     Behavior:
#     - If replace=False and request cookie already equals guest_id -> no-op
#     - If guest_id is None, uses g.guest_id or creates a new uuid
#     - Writes SameSite=Lax, HttpOnly, secure based on request/env
#     - Sets CORS headers to expose Set-Cookie when cookie is written
#     """
#     # Skip static or preflight requests
#     if request.method == "OPTIONS" or request.path.startswith("/static") or request.path.endswith(
#         (".css", ".js", ".png", ".jpg", ".ico", ".svg")
#     ):
#         return resp

#     if getattr(g, "guest_cookie_written", False):
#         return resp

#     current_cookie = request.cookies.get(GUEST_COOKIE)
#     if not replace and guest_id and current_cookie == guest_id:
#         return resp

#     if not guest_id:
#         guest_id = getattr(g, "guest_id", None) or str(uuid4())

#     is_https = request.is_secure or os.getenv("FORCE_SECURE_COOKIE") == "1"
#     resp.set_cookie(
#         GUEST_COOKIE,
#         guest_id,
#         max_age=GUEST_COOKIE_MAX_AGE,
#         httponly=True,
#         secure=is_https,
#         samesite="Lax",
#         path="/",
#     )

#     # Ensure client can read Set-Cookie in some environments (CORS)
#     resp.headers["Access-Control-Allow-Credentials"] = "true"
#     resp.headers["Access-Control-Expose-Headers"] = "Set-Cookie"

#     g.guest_cookie_written = True
#     logging.info({"event": "guest_cookie_set", "guest_id": guest_id})
#     return resp


# # ===========================================================
# # TOKEN EXTRACTION + VERIFICATION
# # ===========================================================
# def _extract_token():
#     header = request.headers.get("Authorization", None)
#     if not header:
#         return None, "unauthorized_missing_token"
#     parts = header.split()
#     if parts[0].lower() != "bearer" or len(parts) != 2:
#         return None, "unauthorized_malformed_token"
#     return parts[1], None


# class AuthError(Exception):
#     def __init__(self, code, message):
#         super().__init__(message)
#         self.code = code
#         self.message = message


# @cached(cache=firebase_token_cache, lock=lock)
# def verify_firebase_token(token: str):
#     """
#     Verify Firebase ID token (cached). Raises AuthError on known cases.
#     """
#     try:
#         decoded = firebase_auth.verify_id_token(token, check_revoked=True)
#         return decoded
#     except Exception as e:
#         msg = str(e).lower()
#         if "expired" in msg:
#             raise AuthError("token_expired", "Firebase ID token expired")
#         if "revoked" in msg:
#             raise AuthError("token_revoked", "Firebase ID token revoked")
#         if "invalid" in msg:
#             raise AuthError("invalid_token", "Invalid Firebase ID token")
#         raise AuthError("auth_verification_failed", str(e))


# # ===========================================================
# # DECORATOR: REQUIRE AUTH (USER-FIRST)
# # ===========================================================
# def require_auth(optional: bool = False):
#     """
#     Decorator for routes.

#     optional=True => allow guest fallback (resolve guest_id)
#     optional=False => reject when token absent/invalid
#     """
#     def decorator(func):
#         @wraps(func)
#         def wrapper(*args, **kwargs):
#             token, token_error = _extract_token()
#             g.user = None
#             g.actor = {"user_id": None, "guest_id": None, "is_authenticated": False}

#             if token:
#                 try:
#                     decoded = verify_firebase_token(token)
#                     g.user = {
#                         "firebase_uid": decoded.get("uid"),
#                         "email": decoded.get("email"),
#                         "name": decoded.get("name"),
#                         "email_verified": decoded.get("email_verified", False),
#                     }

#                     # enrich DB user_id if available
#                     from domain.users import repository
#                     db_user = repository.get_user_by_uid(g.user["firebase_uid"])
#                     if db_user:
#                         # db_user may be dict-like or None
#                         g.user["user_id"] = db_user.get("user_id") if isinstance(db_user, dict) else db_user["user_id"]

#                     g.actor.update({
#                         "is_authenticated": True,
#                         "firebase_uid": g.user.get("firebase_uid"),
#                         "guest_id": None,
#                     })
#                     return func(*args, **kwargs)

#                 except AuthError as e:
#                     if not optional:
#                         return jsonify({"error": e.code, "message": e.message}), 401
#                 except Exception as e:
#                     logging.exception("Token verification failure")
#                     if not optional:
#                         return jsonify({"error": "auth_verification_failed", "message": str(e)}), 401

#             # guest fallback: resolve guest context once per request
#             gid = _resolve_guest_context()
#             g.actor.update({"guest_id": gid, "is_authenticated": False})
#             if not optional and not gid:
#                 return jsonify({"error": "invalid_guest"}), 401

#             return func(*args, **kwargs)
#         return wrapper
#     return decorator


# # ===========================================================
# # REQUIRE GUEST (EXPLICIT GUEST-ONLY ROUTES)
# # ===========================================================
# def require_guest(func):
#     """
#     Ensure a guest_id is present when user is not authenticated.
#     Sets g.guest_id and g.actor for downstream code.
#     """
#     @wraps(func)
#     def _wrapped(*args, **kwargs):
#         gid = request.args.get("guest_id") or request.cookies.get(GUEST_COOKIE)
#         if getattr(g, "user", None):
#             return func(*args, **kwargs)
#         if not gid or not re.fullmatch(r"[0-9a-fA-F-]{20,64}", gid):
#             return jsonify({"error": "invalid_guest_id"}), 400
#         g.guest_id = gid
#         g.actor = {"user_id": None, "guest_id": gid, "is_authenticated": False}
#         return func(*args, **kwargs)
#     return _wrapped


# # ===========================================================
# # LOGOUT HANDLER SUPPORT
# # ===========================================================
# def perform_logout_response():
#     """
#     Called by /api/auth/logout:
#     - delete existing guest cookie
#     - generate a new guest id cookie (rotate)
#     - reset g.user and g.actor context
#     """
#     resp = make_response(jsonify({"status": "logged_out"}))
#     resp.delete_cookie(GUEST_COOKIE)

#     new_guest_id = str(uuid4())
#     # set g to reflect rotated guest for the request
#     g.user = None
#     g.guest_id = new_guest_id
#     g.new_guest = True

#     _set_guest_cookie(resp, new_guest_id, replace=True)

#     g.actor = {"user_id": None, "guest_id": new_guest_id, "is_authenticated": False}
#     logging.info({
#         "event": "user_logout",
#         "guest_id": new_guest_id,
#         "timestamp": datetime.utcnow().isoformat(),
#     })
#     return resp


# # ===========================================================
# # CONTEXT ACCESSOR
# # ===========================================================
# def get_current_actor():
#     """
#     Return unified session context used across services.
#     """
#     if hasattr(g, "actor"):
#         return g.actor
#     return {"user_id": None, "guest_id": None, "is_authenticated": False}


# utils/auth.py
import logging
import os
import re
from functools import wraps
from flask import request, jsonify, g, make_response
from uuid import uuid4
from datetime import datetime

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials



GUEST_COOKIE = "guest_id"
GUEST_COOKIE_MAX_AGE = 7 * 24 * 3600


# ===========================================================
# FIREBASE INITIALIZATION
# ===========================================================
def initialize_firebase():
    if firebase_admin._apps:
        return

    path = os.getenv("FIREBASE_CREDENTIALS")
    if not path:
        from pathlib import Path
        path = Path(__file__).resolve().parents[1] / "firebase-adminsdk.json"

    if not os.path.exists(path):
        raise RuntimeError(f"Missing Firebase credential file: {path}")

    cred = credentials.Certificate(str(path))
    firebase_admin.initialize_app(cred)


# ===========================================================
# TOKEN VERIFICATION
# ===========================================================
class AuthError(Exception):
    def __init__(self, code, message):
        self.code = code
        self.message = message
        super().__init__(message)


def _extract_bearer_token():
    header = request.headers.get("Authorization")
    if not header:
        return None

    parts = header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    return parts[1]



def verify_firebase_token(token: str):
    try:
        return firebase_auth.verify_id_token(token, check_revoked=False)
    except Exception as e:
        msg = str(e).lower()
        if "expired" in msg:
            raise AuthError("token_expired", "Firebase ID token expired")
        if "revoked" in msg:
            raise AuthError("token_revoked", "Firebase ID token revoked")
        if "invalid" in msg:
            raise AuthError("invalid_token", "Invalid Firebase ID token")
        raise AuthError("auth_verification_failed", str(e))


# ===========================================================
# GUEST HANDLING
# ===========================================================
def _resolve_guest():
    cookie_value = request.cookies.get(GUEST_COOKIE)

    if cookie_value and re.fullmatch(r"[a-fA-F0-9-]{20,64}", cookie_value):
        g.guest_id = cookie_value
        g.new_guest = False
        return cookie_value

    # missing or invalid
    gid = str(uuid4())
    g.guest_id = gid
    g.new_guest = True
    return gid


def _apply_guest_cookie(resp):
    """
    Backwards-compatible cookie setter. Does not overwrite existing cookie
    unless replace=True is passed by callers (see wrapper below).
    """
    if getattr(g, "guest_cookie_written", False):
        return resp

    gid = getattr(g, "guest_id", None)
    if not gid:
        gid = str(uuid4())
        g.guest_id = gid

    # resp.set_cookie(
    #     GUEST_COOKIE,
    #     gid,
    #     max_age=GUEST_COOKIE_MAX_AGE,
    #     httponly=True,
    #     samesite="Lax",
    #     secure=request.is_secure or os.getenv("FORCE_SECURE_COOKIE") == "1",
    #     path="/",
    # )
    resp.set_cookie(
        GUEST_COOKIE,
        gid,
        max_age=GUEST_COOKIE_MAX_AGE,
        httponly=True,
        samesite="None",
        secure=False,
        path="/",
    )

    g.guest_cookie_written = True
    # expose cookie header for CORS clients
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    resp.headers["Access-Control-Expose-Headers"] = "Set-Cookie"
    logging.info({"event": "guest_cookie_set", "guest_id": gid})
    return resp


# Backwards compatible exported name used across codebase
def _set_guest_cookie(resp, guest_id=None, replace=False):
    """
    Compatibility wrapper: if replace=True, always set cookie to provided guest_id.
    Otherwise behave conservatively and avoid resetting existing cookie unnecessarily.
    """
    # Skip for static or preflight
    if request.method == "OPTIONS" or request.path.startswith("/static") or request.path.endswith(
        (".css", ".js", ".png", ".jpg", ".ico", ".svg")
    ):
        return resp

    if getattr(g, "guest_cookie_written", False):
        return resp

    current_cookie = request.cookies.get(GUEST_COOKIE)
    if not replace and current_cookie and guest_id and current_cookie == guest_id:
        return resp

    if guest_id:
        g.guest_id = guest_id

    return _apply_guest_cookie(resp)


# ===========================================================
# DECORATOR: REQUIRE AUTH
# ===========================================================
# def require_auth(optional=False):
#     def decorator(func):
#         @wraps(func)
#         def wrapper(*args, **kwargs):
#             token = _extract_bearer_token()

#             g.user = None
#             g.actor = {
#                 "is_authenticated": False,
#                 "user_id": None,
#                 "guest_id": None,
#             }

#             if token:
#                 try:
#                     decoded = verify_firebase_token(token)

#                     # Always treat valid Firebase token as authenticated identity
#                     g.user = {
#                         "firebase_uid": decoded.get("uid"),
#                         "email": decoded.get("email"),
#                         "name": decoded.get("name"),
#                         "email_verified": decoded.get("email_verified", False),
#                         "user_id": None,
#                     }

#                     try:
#                         from domain.users import repository
#                         u = repository.get_user_by_uid(decoded.get("uid"))
#                     except Exception:
#                         u = None

#                     # If DB user exists, attach user_id
#                     if u:
#                         g.user["user_id"] = u["user_id"]

#                     # Token = authenticated. DB user row optional.
#                     g.actor.update({
#                         "is_authenticated": True,
#                         "user_id": g.user["user_id"],
#                         "guest_id": None,
#                     })

#                     return func(*args, **kwargs)

#                 except AuthError as e:
#                     if not optional:
#                         return jsonify({"error": e.code, "message": e.message}), 401
#                 except Exception as e:
#                     if not optional:
#                         return jsonify({"error": "auth_failed", "message": str(e)}), 401

#             # No token
#             if not token and not optional:
#                 return jsonify({"error": "unauthorized", "message": "Authentication required"}), 401

#             gid = _resolve_guest()
#             g.actor.update({
#                 "is_authenticated": False,
#                 "guest_id": gid,
#                 "user_id": None,
#             })
#             return func(*args, **kwargs)

#         return wrapper
#     return decorator

# [DEBUG COMMIT] Added debug statements for guest/user resolution tracking

def require_auth(optional=False):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            token = _extract_bearer_token()

            g.user = None
            g.actor = {
                "is_authenticated": False,
                "user_id": None,
                "guest_id": None,
            }

            ck = request.cookies.get(GUEST_COOKIE)

            if token:
                try:
                    decoded = verify_firebase_token(token)

                    g.user = {
                        "firebase_uid": decoded.get("uid"),
                        "email": decoded.get("email"),
                        "name": decoded.get("name"),
                        "email_verified": decoded.get("email_verified", False),
                        "user_id": None,
                    }

                    try:
                        from domain.users import repository
                        u = repository.get_user_by_uid(decoded.get("uid"))
                    except Exception:
                        u = None

                    if u:
                        g.user["user_id"] = u["user_id"]

                    g.actor["is_authenticated"] = True
                    g.actor["user_id"] = g.user["user_id"]
                    g.actor["guest_id"] = ck

                    print("AUTH DEBUG:", {"mode": "auth", "guest_id": ck, "user": g.user})

                    return func(*args, **kwargs)

                except Exception as e:
                    if not optional:
                        return jsonify({"error": "auth_failed", "message": str(e)}), 401

            if not token and not optional:
                return jsonify({"error": "unauthorized"}), 401

            gid = ck or _resolve_guest()
            g.actor["guest_id"] = gid

            print("AUTH DEBUG:", {"mode": "guest", "guest_id": gid})

            return func(*args, **kwargs)

        return wrapper
    return decorator



# ===========================================================
# LOGOUT
# ===========================================================
def perform_logout_response():
    resp = make_response(jsonify({"status": "logged_out"}))
    resp.delete_cookie(GUEST_COOKIE)

    new_gid = str(uuid4())
    g.guest_id = new_gid
    g.user = None

    # set new guest cookie (replace)
    return _set_guest_cookie(resp, guest_id=new_gid, replace=True)


# ===========================================================
# ACCESS CURRENT ACTOR
# ===========================================================
def get_current_actor():
    return getattr(g, "actor", {
        "is_authenticated": False,
        "user_id": None,
        "guest_id": None,
    })
