# # ------------- pgsql ---------------------------

# # domain/users/service.py
# import logging
# from domain.users import repository
# from domain.cart import service as cart_service
# from domain.wishlist import service as wishlist_service
# from domain.cart import repository as cart_repo
# from domain.wishlist import repository as wishlist_repo
# from db import transaction, get_db_connection


# def upsert_user_from_firebase(firebase_uid, email, name, conn=None):
#     internal = conn is None
#     if internal:
#         db = get_db_connection()
#         with db.cursor() as cur:
#             try:
#                 user = repository.get_user_by_uid(firebase_uid)
#                 if user:
#                     cur.execute(
#                         "UPDATE users SET last_login = NOW() WHERE user_id = %s",
#                         (user["user_id"],)
#                     )
#                     db.commit()
#                     return user

#                 cur.execute(
#                     """
#                     INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
#                     VALUES (%s, %s, %s, NOW(), NOW())
#                     ON CONFLICT(email) DO UPDATE
#                     SET firebase_uid = EXCLUDED.firebase_uid,
#                         name = EXCLUDED.name,
#                         updated_at = NOW()
#                     RETURNING user_id, firebase_uid, email, name;
#                     """,
#                     (firebase_uid, email, name),
#                 )
#                 user = cur.fetchone()

#                 cur.execute(
#                     "UPDATE users SET last_login = NOW() WHERE user_id = %s",
#                     (user["user_id"],)
#                 )

#                 db.commit()
#                 return user

#             except Exception as e:
#                 logging.exception(f"upsert_user_from_firebase failed for {email}: {e}")
#                 try:
#                     db.rollback()
#                 except Exception:
#                     pass
#                 return None

#     else:
#         cur = conn
#         try:
#             user = repository.get_user_by_uid(firebase_uid)
#             if user:
#                 cur.execute(
#                     "UPDATE users SET last_login = NOW() WHERE user_id = %s",
#                     (user["user_id"],)
#                 )
#                 return user

#             cur.execute(
#                 """
#                 INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
#                 VALUES (%s, %s, %s, NOW(), NOW())
#                 ON CONFLICT(email) DO UPDATE
#                 SET firebase_uid = EXCLUDED.firebase_uid,
#                     name = EXCLUDED.name,
#                     updated_at = NOW()
#                 RETURNING user_id, firebase_uid, email, name;
#                 """,
#                 (firebase_uid, email, name),
#             )
#             user = cur.fetchone()

#             cur.execute(
#                 "UPDATE users SET last_login = NOW() WHERE user_id = %s",
#                 (user["user_id"],)
#             )
#             return user
#         except Exception as e:
#             logging.exception(f"upsert_user_from_firebase failed for {email}: {e}")
#             return None


# def ensure_user_profile(user_id, conn=None):
#     internal = conn is None
#     if internal:
#         db = get_db_connection()
#         with db.cursor() as cur:
#             try:
#                 cur.execute(
#                     "SELECT profile_id FROM user_profiles WHERE user_id = %s",
#                     (user_id,)
#                 )
#                 row = cur.fetchone()

#                 if row:
#                     return repository.get_user_profile(user_id)

#                 cur.execute(
#                     """
#                     INSERT INTO user_profiles
#                         (user_id, dob, gender, avatar_url, created_at, updated_at)
#                     VALUES (%s, NULL, NULL, NULL, NOW(), NOW())
#                     """,
#                     (user_id,),
#                 )
#                 db.commit()
#                 return repository.get_user_profile(user_id)
#             except Exception:
#                 try:
#                     db.rollback()
#                 except Exception:
#                     pass
#                 raise

#     else:
#         cur = conn
#         cur.execute(
#             "SELECT profile_id FROM user_profiles WHERE user_id = %s",
#             (user_id,)
#         )
#         row = cur.fetchone()

#         if row:
#             return repository.get_user_profile(user_id)

#         cur.execute(
#             """
#             INSERT INTO user_profiles
#                 (user_id, dob, gender, avatar_url, created_at, updated_at)
#             VALUES (%s, NULL, NULL, NULL, NOW(), NOW())
#             """,
#             (user_id,),
#         )
#         return repository.get_user_profile(user_id)


# def update_profile(conn, firebase_uid, updates):
#     user = repository.get_user_by_uid(firebase_uid)
#     if not user:
#         return None

#     allowed = {"name", "dob", "gender", "avatar_url"}
#     fields = {k: v for k, v in updates.items() if k in allowed}
#     if not fields:
#         return repository.get_user_profile(user["user_id"])

#     if "name" in fields:
#         conn.execute(
#             "UPDATE users SET name = %s, updated_at = NOW() WHERE user_id = %s",
#             (fields["name"], user["user_id"])
#         )
#         del fields["name"]

#     if fields:
#         repository.update_user_profile(user["user_id"], fields)

#     profile = repository.get_user_profile(user["user_id"]) or {}
#     return {**user, **profile}


# def ensure_user_with_merge(conn, firebase_uid, email, name, avatar_url, guest_id, update_last_login=True):
#     internal = conn is None
#     if internal:
#         try:
#             with transaction() as tx:
#                 user = upsert_user_from_firebase(firebase_uid, email, name, conn=tx)
#                 if not user:
#                     return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}

#                 user_id = user["user_id"]
#                 ensure_user_profile(user_id, conn=tx)

#                 result = {"cart": {"status": "none"}, "wishlist": {"status": "none"}}

#                 if guest_id:
#                     try:
#                         result["cart"] = cart_service.merge_guest_cart_into_user(tx, user_id, guest_id)
#                     except Exception:
#                         result["cart"] = {"status": "error"}

#                     try:
#                         result["wishlist"] = wishlist_service.merge_guest_wishlist_into_user(tx, user_id, guest_id)
#                     except Exception:
#                         result["wishlist"] = {"status": "error"}

#                 if update_last_login:
#                     repository.update_user_last_login(user_id)

#             return user, result
#         except Exception as e:
#             logging.exception(f"ensure_user_with_merge failed: {e}")
#             return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}

#     else:
#         try:
#             user = upsert_user_from_firebase(firebase_uid, email, name, conn=conn)
#             if not user:
#                 return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}

#             user_id = user["user_id"]
#             ensure_user_profile(user_id, conn=conn)

#             result = {"cart": {"status": "none"}, "wishlist": {"status": "none"}}

#             if guest_id:
#                 try:
#                     result["cart"] = cart_service.merge_guest_cart_into_user(conn, user_id, guest_id)
#                 except Exception:
#                     result["cart"] = {"status": "error"}

#                 try:
#                     result["wishlist"] = wishlist_service.merge_guest_wishlist_into_user(conn, user_id, guest_id)
#                 except Exception:
#                     result["wishlist"] = {"status": "error"}

#             if update_last_login:
#                 repository.update_user_last_login(user_id)

#             return user, result

#         except Exception as e:
#             logging.exception(f"ensure_user_with_merge failed: {e}")
#             return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}


# def merge_guest_cart_if_any(conn, user_id, guest_id):
#     guest_cart = repository.find_guest_cart(guest_id)
#     if not guest_cart:
#         return {"merged_items": 0, "status": "none"}

#     user_cart = repository.find_user_cart(user_id)
#     if not user_cart:
#         repository.assign_cart_to_user(guest_cart["cart_id"], user_id)
#         try:
#             cart_repo.insert_audit_event(
#                 conn, guest_cart["cart_id"], user_id, guest_id,
#                 "update", f"Guest cart reassigned to user {user_id}"
#             )
#         except Exception:
#             pass
#         return {"merged_items": 0, "status": "reassigned"}

#     if cart_repo.is_cart_already_merged(guest_cart["cart_id"]):
#         return {"merged_items": 0, "status": "skipped"}

#     merge_result = cart_service.merge_guest_into_user(user_id, guest_id)

#     conn.execute(
#         "UPDATE cart_items SET user_id = %s WHERE cart_id = %s",
#         (user_id, guest_cart["cart_id"])
#     )
#     try:
#         conn.execute(
#             "UPDATE cart_audit_log SET user_id = %s, guest_id = NULL WHERE cart_id = %s",
#             (user_id, guest_cart["cart_id"])
#         )
#     except Exception:
#         pass

#     try:
#         cart_repo.insert_audit_event(
#             conn, guest_cart["cart_id"], user_id, guest_id,
#             "merge", f"Guest cart merged into user {user_id}"
#         )
#     except Exception:
#         pass

#     total = int(merge_result.get("added", 0)) + int(merge_result.get("updated", 0))
#     return {"merged_items": total, "status": "merged", **merge_result}


# def merge_guest_wishlist_if_any(conn, user_id, guest_id):
#     guest_wishlist = wishlist_repo.get_wishlist_by_guest(guest_id)
#     if not guest_wishlist:
#         return {"merged_items": 0, "status": "none"}

#     user_wishlist = wishlist_repo.get_wishlist_by_user(user_id)
#     if not user_wishlist:
#         conn.execute(
#             """
#             UPDATE wishlists
#             SET user_id = %s, guest_id = NULL, status = 'active', updated_at = NOW()
#             WHERE wishlist_id = %s
#             """,
#             (user_id, guest_wishlist["wishlist_id"]),
#         )
#         try:
#             wishlist_repo.log_audit(
#                 "update", guest_wishlist["wishlist_id"], user_id, guest_id,
#                 message=f"Guest wishlist reassigned to user {user_id}", con=conn
#             )
#         except Exception:
#             pass
#         return {"merged_items": 0, "status": "reassigned"}

#     if wishlist_repo.is_wishlist_already_merged(guest_wishlist["wishlist_id"]):
#         return {"merged_items": 0, "status": "skipped"}

#     added = wishlist_repo.merge_wishlists(
#         guest_wishlist["wishlist_id"], user_wishlist["wishlist_id"]
#     )
#     wishlist_repo.update_wishlist_status(guest_wishlist["wishlist_id"], "merged")

#     conn.execute(
#         "UPDATE wishlist_items SET user_id = %s WHERE wishlist_id = %s",
#         (user_id, guest_wishlist["wishlist_id"])
#     )
#     try:
#         conn.execute(
#             "UPDATE wishlist_audit SET user_id = %s, guest_id = NULL WHERE wishlist_id = %s",
#             (user_id, guest_wishlist["wishlist_id"])
#         )
#     except Exception:
#         pass

#     try:
#         wishlist_repo.log_audit(
#             "merge", guest_wishlist["wishlist_id"], user_id, guest_id,
#             message=f"Guest wishlist merged into user {user_id}", con=conn
#         )
#     except Exception:
#         pass

#     return {"merged_items": added or 0, "status": "merged"}


# def get_user_with_profile(conn, firebase_uid):
#     user = repository.get_user_by_uid(firebase_uid)
#     if not user:
#         return None

#     profile = repository.get_user_profile(user["user_id"]) or {}
#     return {**user, **profile}


# ------------------------------------------------------------------------------------------


# ------------- pgsql ---------------------------
# domain/users/service.py
#
# Updated to match your CURRENT DATABASE SCHEMA:
# - users: (user_id, firebase_uid, is_admin, last_login, created_at, updated_at)
# - user_profiles: (user_id UNIQUE, full_name, dob, gender, avatar_url, ...)
# - user_auth_identities: (user_id, provider, identifier, is_verified, is_primary, UNIQUE(provider, identifier))
#
# Key rules implemented:
# - Firebase UID is the only user join key.
# - Email/phone/google identifiers live in user_auth_identities.
# - This layer does NOT verify identifiers. It only mirrors verified state.
# - Guest merge happens only when explicitly requested (guest_id provided).
# - Safe to retry /api/auth/register: user upsert + identity upsert are idempotent.
#
# Notes about integration:
# - routes/users.py currently calls cart/wishlist merge again after ensure_user_with_merge.
#   After you update routes, remove the extra merges and rely on ensure_user_with_merge output.
# - update_profile accepts legacy payload field "name" and maps it to user_profiles.full_name.

import logging
from typing import Any, Dict, Optional, Tuple, List

from db import transaction, get_db_connection
from domain.cart import service as cart_service
from domain.wishlist import service as wishlist_service


class IdentityConflictError(Exception):
    pass


# ------------------------------------------------------------
# Low-level helpers compatible with your transaction() cursor
# ------------------------------------------------------------

def _fetchone_dict(cur):
    row = cur.fetchone()
    return row if row else None


def _fetchall_dict(cur):
    rows = cur.fetchall()
    return rows if rows else []


def _ensure_user_row(firebase_uid: str, cur, update_last_login: bool = True) -> Dict[str, Any]:
    cur.execute(
        """
        INSERT INTO users (firebase_uid, created_at, updated_at, last_login)
        VALUES (%s, NOW(), NOW(), CASE WHEN %s THEN NOW() ELSE NULL END)
        ON CONFLICT (firebase_uid)
        DO UPDATE SET
          updated_at = NOW(),
          last_login = CASE WHEN %s THEN NOW() ELSE users.last_login END
        RETURNING user_id, firebase_uid, is_admin, last_login, created_at, updated_at;
        """,
        (firebase_uid, bool(update_last_login), bool(update_last_login)),
    )
    u = _fetchone_dict(cur)
    if not u:
        raise RuntimeError("Failed to ensure users row")
    return u


def _ensure_profile_row(user_id: int, cur) -> None:
    cur.execute(
        """
        INSERT INTO user_profiles (user_id, created_at, updated_at)
        VALUES (%s, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING;
        """,
        (user_id,),
    )


def _get_profile_row(user_id: int, cur) -> Optional[Dict[str, Any]]:
    cur.execute(
        """
        SELECT profile_id, user_id, full_name, dob, gender, avatar_url, created_at, updated_at
        FROM user_profiles
        WHERE user_id = %s;
        """,
        (user_id,),
    )
    return _fetchone_dict(cur)


def _get_identities(user_id: int, cur) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT identity_id, user_id, provider, identifier, is_verified, is_primary, created_at, updated_at
        FROM user_auth_identities
        WHERE user_id = %s
        ORDER BY is_primary DESC, updated_at DESC, identity_id DESC;
        """,
        (user_id,),
    )
    return _fetchall_dict(cur)


def _identity_exists_elsewhere(provider: str, identifier: str, user_id: int, cur) -> Optional[Dict[str, Any]]:
    cur.execute(
        """
        SELECT identity_id, user_id, provider, identifier, is_verified, is_primary
        FROM user_auth_identities
        WHERE provider = %s AND identifier = %s;
        """,
        (provider, identifier),
    )
    row = _fetchone_dict(cur)
    if row and int(row["user_id"]) != int(user_id):
        return row
    return None


def _has_primary_for_provider(user_id: int, provider: str, cur) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM user_auth_identities
        WHERE user_id = %s AND provider = %s AND is_primary = TRUE
        LIMIT 1;
        """,
        (user_id, provider),
    )
    return bool(_fetchone_dict(cur))


def _upsert_identity(
    user_id: int,
    provider: str,
    identifier: str,
    is_verified: bool,
    make_primary_if_none: bool,
    cur,
) -> Dict[str, Any]:
    if not identifier:
        raise ValueError("identifier required for identity upsert")

    conflict = _identity_exists_elsewhere(provider, identifier, user_id, cur)
    if conflict:
        raise IdentityConflictError(
            f"Identity already linked to another user (provider={provider}, identifier={identifier})"
        )

    is_primary = False
    if make_primary_if_none and not _has_primary_for_provider(user_id, provider, cur):
        is_primary = True

    # Never downgrade is_verified; once true it stays true.
    cur.execute(
        """
        INSERT INTO user_auth_identities
          (user_id, provider, identifier, is_verified, is_primary, created_at, updated_at)
        VALUES
          (%s, %s, %s, %s, %s, NOW(), NOW())
        ON CONFLICT (provider, identifier)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          is_verified = (user_auth_identities.is_verified OR EXCLUDED.is_verified),
          is_primary = CASE
            WHEN user_auth_identities.user_id = EXCLUDED.user_id
              THEN (user_auth_identities.is_primary OR EXCLUDED.is_primary)
            ELSE user_auth_identities.is_primary
          END,
          updated_at = NOW()
        RETURNING identity_id, user_id, provider, identifier, is_verified, is_primary, created_at, updated_at;
        """,
        (user_id, provider, identifier, bool(is_verified), bool(is_primary)),
    )
    row = _fetchone_dict(cur)
    if not row:
        raise RuntimeError("Failed to upsert identity")
    return row


def _select_primary_identity(identities: List[Dict[str, Any]], provider: str) -> Optional[str]:
    # Prefer verified + primary; fallback verified; fallback any.
    filtered = [i for i in identities if i.get("provider") == provider]
    if not filtered:
        return None

    def score(i):
        return (1 if i.get("is_verified") else 0) * 10 + (1 if i.get("is_primary") else 0) * 5

    filtered.sort(key=score, reverse=True)
    return filtered[0].get("identifier")


def _compute_profile_complete(profile: Optional[Dict[str, Any]], identities: List[Dict[str, Any]]) -> bool:
    full_name = (profile or {}).get("full_name")
    has_name = bool(full_name and str(full_name).strip())
    has_verified_identity = any(bool(i.get("is_verified")) for i in identities)
    return bool(has_name and has_verified_identity)


# ------------------------------------------------------------
# Public API used by routes/users.py
# ------------------------------------------------------------

def ensure_user_with_merge(
    conn,
    firebase_uid: str,
    email: Optional[str],
    name: Optional[str],
    avatar_url: Optional[str],
    guest_id: Optional[str],
    update_last_login: bool = True,
    firebase_phone: Optional[str] = None,
    firebase_provider_google_uid: Optional[str] = None,
    email_verified: bool = False,
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
    """
    Reconciliation entry used by /api/auth/register.
    Assumes Firebase token is valid and already verified on Firebase side.

    Inputs:
      - firebase_uid: required
      - email/email_verified: from token (may be absent)
      - firebase_phone: if you later add it to g.user (may be absent now)
      - firebase_provider_google_uid: optional (if you later supply it)
      - name/avatar_url are ignored for users table (profile lives in user_profiles)
      - guest_id triggers merges (cart/wishlist)

    Returns:
      (user_row, result)
    """
    if not firebase_uid:
        return None, {"error": "missing_firebase_uid"}

    internal = conn is None

    def _run(cur):
        user = _ensure_user_row(firebase_uid, cur, update_last_login=update_last_login)
        user_id = int(user["user_id"])

        _ensure_profile_row(user_id, cur)

        identities_result = {"status": "none", "updated": []}

        # Mirror identities ONLY if you have evidence they are verified on Firebase.
        # Email: only treat as verified if token says email_verified True.
        try:
            if email and bool(email_verified):
                row = _upsert_identity(
                    user_id=user_id,
                    provider="email",
                    identifier=email.strip().lower(),
                    is_verified=True,
                    make_primary_if_none=True,
                    cur=cur,
                )
                identities_result["updated"].append({"provider": "email", "identifier": row["identifier"]})
                identities_result["status"] = "updated"

            # Phone: you must supply E.164 from Firebase token (not from frontend input).
            if firebase_phone:
                row = _upsert_identity(
                    user_id=user_id,
                    provider="phone",
                    identifier=str(firebase_phone).strip(),
                    is_verified=True,
                    make_primary_if_none=True,
                    cur=cur,
                )
                identities_result["updated"].append({"provider": "phone", "identifier": row["identifier"]})
                identities_result["status"] = "updated"

            # Google: if you later supply provider UID, mirror it.
            if firebase_provider_google_uid:
                row = _upsert_identity(
                    user_id=user_id,
                    provider="google",
                    identifier=str(firebase_provider_google_uid).strip(),
                    is_verified=True,
                    make_primary_if_none=True,
                    cur=cur,
                )
                identities_result["updated"].append({"provider": "google", "identifier": row["identifier"]})
                identities_result["status"] = "updated"

        except IdentityConflictError as e:
            # Do not create a second user. Surface error to route.
            raise

        merge_result = {
            "cart": {"status": "none"},
            "wishlist": {"status": "none"},
        }

        if guest_id:
            try:
                merge_result["cart"] = cart_service.merge_guest_cart_into_user(cur, user_id, guest_id)
            except Exception:
                merge_result["cart"] = {"status": "error"}

            try:
                merge_result["wishlist"] = wishlist_service.merge_guest_wishlist_into_user(cur, user_id, guest_id)
            except Exception:
                merge_result["wishlist"] = {"status": "error"}

        result = {
            "identities": identities_result,
            "merge": merge_result,
        }

        return user, result

    try:
        if internal:
            with transaction() as tx:
                return _run(tx)
        else:
            return _run(conn)
    except IdentityConflictError as e:
        logging.exception("ensure_user_with_merge identity conflict")
        return None, {"error": "identity_conflict", "message": str(e)}
    except Exception as e:
        logging.exception("ensure_user_with_merge failed")
        return None, {"error": "internal_error", "message": str(e)}


def update_profile(conn, firebase_uid: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Updates user_profiles only.
    Accepts legacy 'name' field and maps to user_profiles.full_name.
    """
    if not firebase_uid:
        return None

    allowed = {"name", "full_name", "dob", "gender", "avatar_url"}
    data = {k: v for k, v in (updates or {}).items() if k in allowed}

    # Map old field used by frontend routes/users.py
    if "name" in data and "full_name" not in data:
        data["full_name"] = data["name"]
    data.pop("name", None)

    internal = conn is None

    def _run(cur):
        # Resolve user by firebase_uid
        cur.execute(
            "SELECT user_id, firebase_uid, is_admin, last_login, created_at, updated_at FROM users WHERE firebase_uid = %s;",
            (firebase_uid,),
        )
        user = _fetchone_dict(cur)
        if not user:
            return None

        user_id = int(user["user_id"])
        _ensure_profile_row(user_id, cur)

        # Apply profile updates
        if data:
            set_parts = []
            params = []
            for k in ("full_name", "dob", "gender", "avatar_url"):
                if k in data:
                    set_parts.append(f"{k} = %s")
                    params.append(data[k])

            if set_parts:
                params.append(user_id)
                cur.execute(
                    f"""
                    UPDATE user_profiles
                    SET {", ".join(set_parts)}, updated_at = NOW()
                    WHERE user_id = %s;
                    """,
                    tuple(params),
                )

        profile = _get_profile_row(user_id, cur) or {}
        identities = _get_identities(user_id, cur)

        email = _select_primary_identity(identities, "email")
        phone = _select_primary_identity(identities, "phone")

        out = {
            "user_id": user_id,
            "firebase_uid": firebase_uid,
            "is_admin": user.get("is_admin", False),
            "last_login": user.get("last_login"),
            "full_name": profile.get("full_name"),
            "dob": profile.get("dob"),
            "gender": profile.get("gender"),
            "avatar_url": profile.get("avatar_url"),
            "email": email,
            "mobile": phone,
            "auth_identities": identities,
            "profile_complete": _compute_profile_complete(profile, identities),
        }
        return out

    if internal:
        with transaction() as tx:
            return _run(tx)
    return _run(conn)


def get_user_with_profile(conn, firebase_uid: str) -> Optional[Dict[str, Any]]:
    """
    Canonical backend view for /api/users/me.
    Includes identities, profile_complete, and convenience email/mobile fields.
    """
    if not firebase_uid:
        return None

    internal = conn is None

    def _run(cur):
        cur.execute(
            "SELECT user_id, firebase_uid, is_admin, last_login, created_at, updated_at FROM users WHERE firebase_uid = %s;",
            (firebase_uid,),
        )
        user = _fetchone_dict(cur)
        if not user:
            return None

        user_id = int(user["user_id"])
        _ensure_profile_row(user_id, cur)

        profile = _get_profile_row(user_id, cur) or {}
        identities = _get_identities(user_id, cur)

        email = _select_primary_identity(identities, "email")
        phone = _select_primary_identity(identities, "phone")

        return {
            "user_id": user_id,
            "firebase_uid": firebase_uid,
            "is_admin": user.get("is_admin", False),
            "last_login": user.get("last_login"),
            "full_name": profile.get("full_name"),
            "dob": profile.get("dob"),
            "gender": profile.get("gender"),
            "avatar_url": profile.get("avatar_url"),
            "email": email,
            "mobile": phone,
            "auth_identities": identities,
            "profile_complete": _compute_profile_complete(profile, identities),
        }

    if internal:
        with get_db_connection() as db:
            with db.cursor() as cur:
                return _run(cur)
    return _run(conn)
