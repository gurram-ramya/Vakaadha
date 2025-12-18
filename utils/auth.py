
# # utils/auth.py
# import logging
# import os
# import re
# from functools import wraps
# from flask import request, jsonify, g, make_response
# from uuid import uuid4
# from datetime import datetime

# import firebase_admin
# from firebase_admin import auth as firebase_auth, credentials



# GUEST_COOKIE = "guest_id"
# GUEST_COOKIE_MAX_AGE = 7 * 24 * 3600


# # ===========================================================
# # FIREBASE INITIALIZATION
# # ===========================================================
# def initialize_firebase():
#     if firebase_admin._apps:
#         return

#     path = os.getenv("FIREBASE_CREDENTIALS")
#     if not path:
#         from pathlib import Path
#         path = Path(__file__).resolve().parents[1] / "firebase-adminsdk.json"

#     if not os.path.exists(path):
#         raise RuntimeError(f"Missing Firebase credential file: {path}")

#     cred = credentials.Certificate(str(path))
#     firebase_admin.initialize_app(cred)


# # ===========================================================
# # TOKEN VERIFICATION
# # ===========================================================
# class AuthError(Exception):
#     def __init__(self, code, message):
#         self.code = code
#         self.message = message
#         super().__init__(message)


# def _extract_bearer_token():
#     header = request.headers.get("Authorization")
#     if not header:
#         return None

#     parts = header.split()
#     if len(parts) != 2 or parts[0].lower() != "bearer":
#         return None

#     return parts[1]



# def verify_firebase_token(token: str):
#     try:
#         return firebase_auth.verify_id_token(token, check_revoked=False)
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
# # GUEST HANDLING
# # ===========================================================
# def _resolve_guest():
#     cookie_value = request.cookies.get(GUEST_COOKIE)

#     if cookie_value and re.fullmatch(r"[a-fA-F0-9-]{20,64}", cookie_value):
#         g.guest_id = cookie_value
#         g.new_guest = False
#         return cookie_value

#     # missing or invalid
#     gid = str(uuid4())
#     g.guest_id = gid
#     g.new_guest = True
#     return gid


# def _apply_guest_cookie(resp):
#     """
#     Backwards-compatible cookie setter. Does not overwrite existing cookie
#     unless replace=True is passed by callers (see wrapper below).
#     """
#     if getattr(g, "guest_cookie_written", False):
#         return resp

#     gid = getattr(g, "guest_id", None)
#     if not gid:
#         gid = str(uuid4())
#         g.guest_id = gid

#     # resp.set_cookie(
#     #     GUEST_COOKIE,
#     #     gid,
#     #     max_age=GUEST_COOKIE_MAX_AGE,
#     #     httponly=True,
#     #     samesite="Lax",
#     #     secure=request.is_secure or os.getenv("FORCE_SECURE_COOKIE") == "1",
#     #     path="/",
#     # )
#     resp.set_cookie(
#         GUEST_COOKIE,
#         gid,
#         max_age=GUEST_COOKIE_MAX_AGE,
#         httponly=True,
#         samesite="None",
#         secure=False,
#         path="/",
#     )

#     g.guest_cookie_written = True
#     # expose cookie header for CORS clients
#     resp.headers["Access-Control-Allow-Credentials"] = "true"
#     resp.headers["Access-Control-Expose-Headers"] = "Set-Cookie"
#     logging.info({"event": "guest_cookie_set", "guest_id": gid})
#     return resp


# # Backwards compatible exported name used across codebase
# def _set_guest_cookie(resp, guest_id=None, replace=False):
#     """
#     Compatibility wrapper: if replace=True, always set cookie to provided guest_id.
#     Otherwise behave conservatively and avoid resetting existing cookie unnecessarily.
#     """
#     # Skip for static or preflight
#     if request.method == "OPTIONS" or request.path.startswith("/static") or request.path.endswith(
#         (".css", ".js", ".png", ".jpg", ".ico", ".svg")
#     ):
#         return resp

#     if getattr(g, "guest_cookie_written", False):
#         return resp

#     current_cookie = request.cookies.get(GUEST_COOKIE)
#     if not replace and current_cookie and guest_id and current_cookie == guest_id:
#         return resp

#     if guest_id:
#         g.guest_id = guest_id

#     return _apply_guest_cookie(resp)


# # ===========================================================
# # DECORATOR: REQUIRE AUTH
# # ===========================================================
# # def require_auth(optional=False):
# #     def decorator(func):
# #         @wraps(func)
# #         def wrapper(*args, **kwargs):
# #             token = _extract_bearer_token()

# #             g.user = None
# #             g.actor = {
# #                 "is_authenticated": False,
# #                 "user_id": None,
# #                 "guest_id": None,
# #             }

# #             if token:
# #                 try:
# #                     decoded = verify_firebase_token(token)

# #                     # Always treat valid Firebase token as authenticated identity
# #                     g.user = {
# #                         "firebase_uid": decoded.get("uid"),
# #                         "email": decoded.get("email"),
# #                         "name": decoded.get("name"),
# #                         "email_verified": decoded.get("email_verified", False),
# #                         "user_id": None,
# #                     }

# #                     try:
# #                         from domain.users import repository
# #                         u = repository.get_user_by_uid(decoded.get("uid"))
# #                     except Exception:
# #                         u = None

# #                     # If DB user exists, attach user_id
# #                     if u:
# #                         g.user["user_id"] = u["user_id"]

# #                     # Token = authenticated. DB user row optional.
# #                     g.actor.update({
# #                         "is_authenticated": True,
# #                         "user_id": g.user["user_id"],
# #                         "guest_id": None,
# #                     })

# #                     return func(*args, **kwargs)

# #                 except AuthError as e:
# #                     if not optional:
# #                         return jsonify({"error": e.code, "message": e.message}), 401
# #                 except Exception as e:
# #                     if not optional:
# #                         return jsonify({"error": "auth_failed", "message": str(e)}), 401

# #             # No token
# #             if not token and not optional:
# #                 return jsonify({"error": "unauthorized", "message": "Authentication required"}), 401

# #             gid = _resolve_guest()
# #             g.actor.update({
# #                 "is_authenticated": False,
# #                 "guest_id": gid,
# #                 "user_id": None,
# #             })
# #             return func(*args, **kwargs)

# #         return wrapper
# #     return decorator

# # [DEBUG COMMIT] Added debug statements for guest/user resolution tracking

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

#             ck = request.cookies.get(GUEST_COOKIE)

#             if token:
#                 try:
#                     decoded = verify_firebase_token(token)

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

#                     if u:
#                         g.user["user_id"] = u["user_id"]

#                     g.actor["is_authenticated"] = True
#                     g.actor["user_id"] = g.user["user_id"]
#                     g.actor["guest_id"] = ck

#                     print("AUTH DEBUG:", {"mode": "auth", "guest_id": ck, "user": g.user})

#                     return func(*args, **kwargs)

#                 except Exception as e:
#                     if not optional:
#                         return jsonify({"error": "auth_failed", "message": str(e)}), 401

#             if not token and not optional:
#                 return jsonify({"error": "unauthorized"}), 401

#             gid = ck or _resolve_guest()
#             g.actor["guest_id"] = gid

#             print("AUTH DEBUG:", {"mode": "guest", "guest_id": gid})

#             return func(*args, **kwargs)

#         return wrapper
#     return decorator



# # ===========================================================
# # LOGOUT
# # ===========================================================
# def perform_logout_response():
#     resp = make_response(jsonify({"status": "logged_out"}))
#     resp.delete_cookie(GUEST_COOKIE)

#     new_gid = str(uuid4())
#     g.guest_id = new_gid
#     g.user = None

#     # set new guest cookie (replace)
#     return _set_guest_cookie(resp, guest_id=new_gid, replace=True)


# # ===========================================================
# # ACCESS CURRENT ACTOR
# # ===========================================================
# def get_current_actor():
#     return getattr(g, "actor", {
#         "is_authenticated": False,
#         "user_id": None,
#         "guest_id": None,
#     })


# ------------------------------------------------------------------------------------------

# utils/auth.py
import logging
import os
import re
from functools import wraps
from uuid import uuid4

from flask import request, jsonify, g, make_response

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials


GUEST_COOKIE = "guest_id"
GUEST_COOKIE_MAX_AGE = 7 * 24 * 3600

# Accept guest id from frontend in these places (priority order):
# 1) X-Guest-Id header (client.js attaches this)
# 2) guest_id query param (client.js may append when no token)
# 3) guest_id cookie
_GUEST_ID_RE = re.compile(r"^[a-fA-F0-9-]{20,64}$")


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
    def __init__(self, code, message, status=401):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def _extract_bearer_token():
    header = request.headers.get("Authorization")
    if not header:
        return None

    parts = header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    return parts[1]


def verify_firebase_token(token: str, *, check_revoked: bool = True):
    """
    check_revoked=True:
      - catches revoked tokens (account disabled, password reset, etc.)
      - aligns with frontend expectation: revoked token should hard-fail
    """
    try:
        return firebase_auth.verify_id_token(token, check_revoked=check_revoked)
    except Exception as e:
        msg = str(e).lower()

        if "expired" in msg:
            raise AuthError("token_expired", "Firebase ID token expired", status=401)
        if "revoked" in msg:
            raise AuthError("token_revoked", "Firebase ID token revoked", status=401)
        if "disabled" in msg:
            raise AuthError("user_disabled", "Firebase user disabled", status=401)
        if "invalid" in msg:
            raise AuthError("invalid_token", "Invalid Firebase ID token", status=401)

        raise AuthError("auth_verification_failed", str(e), status=401)


# ===========================================================
# GUEST HANDLING
# ===========================================================
def _valid_guest_id(value: str) -> bool:
    if not value:
        return False
    return bool(_GUEST_ID_RE.fullmatch(value))


def _incoming_guest_id():
    """
    Resolve guest identity WITHOUT generating a new one.
    Priority:
      header -> query -> cookie
    """
    h = request.headers.get("X-Guest-Id")
    if _valid_guest_id(h):
        return h

    q = request.args.get("guest_id")
    if _valid_guest_id(q):
        return q

    ck = request.cookies.get(GUEST_COOKIE)
    if _valid_guest_id(ck):
        return ck

    return None


def _resolve_guest():
    """
    Resolve guest identity and generate a new one if missing/invalid.
    Writes g.guest_id and g.new_guest.
    """
    incoming = _incoming_guest_id()
    if incoming:
        g.guest_id = incoming
        g.new_guest = False
        return incoming

    gid = str(uuid4())
    g.guest_id = gid
    g.new_guest = True
    return gid


def _apply_guest_cookie(resp):
    """
    Conservative cookie setter. Does not overwrite unless caller used replace=True via _set_guest_cookie.
    """
    if getattr(g, "guest_cookie_written", False):
        return resp

    gid = getattr(g, "guest_id", None)
    if not gid:
        gid = str(uuid4())
        g.guest_id = gid

    resp.set_cookie(
        GUEST_COOKIE,
        gid,
        max_age=GUEST_COOKIE_MAX_AGE,
        httponly=True,
        samesite="None",
        secure=False,   # keep current behavior; change to True when HTTPS is enforced
        path="/",
    )

    g.guest_cookie_written = True
    resp.headers["Access-Control-Allow-Credentials"] = "true"
    resp.headers["Access-Control-Expose-Headers"] = "Set-Cookie"
    logging.info({"event": "guest_cookie_set", "guest_id": gid})
    return resp


def _set_guest_cookie(resp, guest_id=None, replace=False):
    """
    Compatibility wrapper:
      - If replace=True, always set cookie to provided guest_id
      - Otherwise, avoid resetting existing cookie unnecessarily
    """
    if request.method == "OPTIONS" or request.path.startswith("/static") or request.path.endswith(
        (".css", ".js", ".png", ".jpg", ".ico", ".svg")
    ):
        return resp

    if getattr(g, "guest_cookie_written", False):
        return resp

    current_cookie = request.cookies.get(GUEST_COOKIE)

    if guest_id and _valid_guest_id(guest_id):
        if not replace and current_cookie and current_cookie == guest_id:
            return resp
        g.guest_id = guest_id
        return _apply_guest_cookie(resp)

    # no explicit guest_id provided
    if replace:
        # force a new guest cookie
        g.guest_id = str(uuid4())
        return _apply_guest_cookie(resp)

    # if cookie already exists, do nothing
    if _valid_guest_id(current_cookie):
        g.guest_id = current_cookie
        g.new_guest = False
        return resp

    # otherwise create one
    _resolve_guest()
    return _apply_guest_cookie(resp)


# ===========================================================
# DECORATOR: REQUIRE AUTH
# ===========================================================
def require_auth(optional=False):
    """
    Contract:
      - If Authorization Bearer token is valid -> authenticated actor (Firebase-first)
      - If token missing or invalid and optional=True -> guest actor
      - If token missing or invalid and optional=False -> 401

    IMPORTANT:
      - This decorator MUST NOT create backend users.
      - It MAY attach existing backend user_id if present (read-only lookup).
        This remains backward compatible for services that use g.user['user_id'].
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            token = _extract_bearer_token()

            g.user = None
            g.actor = {
                "is_authenticated": False,
                "firebase_uid": None,
                "user_id": None,
                "guest_id": None,
            }

            # Always resolve incoming guest id (header/query/cookie) for continuity.
            # This does not generate a new guest unless we end up in guest mode and need one.
            incoming_guest = _incoming_guest_id()

            if token:
                try:
                    decoded = verify_firebase_token(token, check_revoked=True)

                    firebase_uid = decoded.get("uid")
                    g.user = {
                        "firebase_uid": firebase_uid,
                        "email": decoded.get("email"),
                        "name": decoded.get("name") or decoded.get("email"),
                        "email_verified": bool(decoded.get("email_verified", False)),
                        "user_id": None,
                    }

                    # Backward-compatible, read-only lookup:
                    # attach user_id if a users row already exists.
                    try:
                        from domain.users import repository as users_repo
                        u = users_repo.get_user_by_uid(firebase_uid)
                        if u and "user_id" in u:
                            g.user["user_id"] = u["user_id"]
                    except Exception:
                        u = None

                    g.actor["is_authenticated"] = True
                    g.actor["firebase_uid"] = firebase_uid
                    g.actor["user_id"] = g.user["user_id"]
                    g.actor["guest_id"] = incoming_guest  # keep for merge decisions later

                    return func(*args, **kwargs)

                except AuthError as e:
                    if not optional:
                        return jsonify({"error": e.code, "message": e.message}), e.status
                except Exception as e:
                    if not optional:
                        return jsonify({"error": "auth_failed", "message": str(e)}), 401

            # No valid token path
            if not optional:
                return jsonify({"error": "unauthorized", "message": "Authentication required"}), 401

            gid = incoming_guest or _resolve_guest()
            g.actor["is_authenticated"] = False
            g.actor["guest_id"] = gid

            return func(*args, **kwargs)

        return wrapper
    return decorator


# ===========================================================
# LOGOUT
# ===========================================================
def perform_logout_response():
    """
    Backend logout: rotates guest cookie only.
    Frontend performs Firebase signOut.
    """
    resp = make_response(jsonify({"status": "logged_out"}))
    resp.delete_cookie(GUEST_COOKIE)

    new_gid = str(uuid4())
    g.guest_id = new_gid
    g.user = None

    return _set_guest_cookie(resp, guest_id=new_gid, replace=True)


# ===========================================================
# ACCESS CURRENT ACTOR
# ===========================================================
def get_current_actor():
    return getattr(g, "actor", {
        "is_authenticated": False,
        "firebase_uid": None,
        "user_id": None,
        "guest_id": None,
    })
