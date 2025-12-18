# # -------------------- {pgsql} -----------------

# # domain/users/repository.py
# from typing import Optional, Dict, Any
# from db import query_one, query_all, execute, get_db_connection


# # -------------------------
# # USER LOOKUPS / MUTATIONS
# # -------------------------

# def get_user_by_uid(firebase_uid: str) -> Optional[Dict[str, Any]]:
#     return query_one(
#         "SELECT * FROM users WHERE firebase_uid = %s",
#         (firebase_uid,),
#     )



# def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
#     return query_one(
#         "SELECT * FROM users WHERE email = %s",
#         (email,),
#     )


# def insert_or_update_user(firebase_uid: str, email: str, name: str) -> Dict[str, Any]:
#     db = get_db_connection()
#     with db.cursor() as cur:
#         cur.execute(
#             """
#             INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
#             VALUES (%s, %s, %s, NOW(), NOW())
#             ON CONFLICT (email)
#             DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid,
#                           name = EXCLUDED.name,
#                           updated_at = NOW()
#             RETURNING user_id, firebase_uid, email, name, last_login;
#             """,
#             (firebase_uid, email, name),
#         )
#         row = cur.fetchone()
#         db.commit()

#     user_cache.pop(firebase_uid, None)
#     user_cache.pop(email, None)
#     return row


# def link_firebase_uid(user_id: int, firebase_uid: str) -> None:
#     execute(
#         """
#         UPDATE users
#         SET firebase_uid = %s, updated_at = NOW()
#         WHERE user_id = %s
#           AND (firebase_uid IS NULL OR firebase_uid = '')
#         """,
#         (firebase_uid, user_id),
#     )
#     user_cache.pop(firebase_uid, None)


# def update_user_last_login(user_id: int) -> None:
#     execute(
#         "UPDATE users SET last_login = NOW() WHERE user_id = %s",
#         (user_id,),
#     )


# # -------------------------
# # USER PROFILE
# # -------------------------

# def get_user_profile(user_id: int) -> Optional[Dict[str, Any]]:
#     return query_one(
#         "SELECT * FROM user_profiles WHERE user_id = %s",
#         (user_id,),
#     )


# def insert_user_profile(user_id: int) -> None:
#     execute(
#         """
#         INSERT INTO user_profiles (user_id, created_at, updated_at)
#         VALUES (%s, NOW(), NOW())
#         ON CONFLICT (user_id) DO NOTHING
#         """,
#         (user_id,),
#     )
#     profile_cache.pop(user_id, None)


# def update_user_profile(user_id: int, fields: dict) -> None:
#     if not fields:
#         return

#     set_clause = ", ".join(f"{k} = %s" for k in fields.keys())
#     params = list(fields.values()) + [user_id]

#     execute(
#         f"""
#         UPDATE user_profiles
#         SET {set_clause}, updated_at = NOW()
#         WHERE user_id = %s
#         """,
#         params,
#     )
#     profile_cache.pop(user_id, None)


# # -------------------------
# # CART / WISHLIST HELPERS
# # -------------------------
# def find_guest_cart(guest_id: str) -> Optional[Dict[str, Any]]:
#     return query_one(
#         "SELECT * FROM carts WHERE guest_id = %s AND status = 'active' LIMIT 1",
#         (guest_id,),
#     )


# def find_user_cart(user_id: int) -> Optional[Dict[str, Any]]:
#     return query_one(
#         "SELECT * FROM carts WHERE user_id = %s AND status = 'active' LIMIT 1",
#         (user_id,),
#     )


# def assign_cart_to_user(cart_id: int, user_id: int) -> None:
#     execute(
#         """
#         UPDATE carts
#         SET user_id = %s, guest_id = NULL, updated_at = NOW()
#         WHERE cart_id = %s
#         """,
#         (user_id, cart_id),
#     )


# def delete_guest_cart(guest_id: str) -> None:
#     execute(
#         "DELETE FROM carts WHERE guest_id = %s",
#         (guest_id,),
#     )


# def is_cart_already_merged(cart_id: int) -> bool:
#     row = query_one(
#         "SELECT merged_at FROM carts WHERE cart_id = %s",
#         (cart_id,),
#     )
#     return bool(row and row.get("merged_at"))


# def has_cart_for_user(user_id: int) -> bool:
#     row = query_one(
#         "SELECT 1 FROM carts WHERE user_id = %s AND status = 'active' LIMIT 1",
#         (user_id,),
#     )
#     return bool(row)


# def create_user_cart(user_id: int) -> None:
#     execute(
#         """
#         INSERT INTO carts (user_id, status, created_at, updated_at)
#         VALUES (%s, 'active', NOW(), NOW())
#         """,
#         (user_id,),
#     )


# # -------------------------
# # WISHLIST HELPERS
# # -------------------------
# def is_wishlist_already_merged(wishlist_id: int) -> bool:
#     row = query_one(
#         "SELECT status FROM wishlists WHERE wishlist_id = %s",
#         (wishlist_id,),
#     )
#     return bool(row and row.get("status") == "merged")


# def has_wishlist_for_user(user_id: int) -> bool:
#     row = query_one(
#         "SELECT 1 FROM wishlists WHERE user_id = %s AND status = 'active' LIMIT 1",
#         (user_id,),
#     )
#     return bool(row)


# def create_user_wishlist(user_id: int) -> None:
#     execute(
#         """
#         INSERT INTO wishlists (user_id, status, created_at, updated_at)
#         VALUES (%s, 'active', NOW(), NOW())
#         """,
#         (user_id,),
#     )


# def find_guest_wishlist(guest_id: str) -> Optional[Dict[str, Any]]:
#     return query_one(
#         "SELECT * FROM wishlists WHERE guest_id = %s AND status = 'active' LIMIT 1",
#         (guest_id,),
#     )


# def assign_wishlist_to_user(wishlist_id: int, user_id: int) -> None:
#     execute(
#         """
#         UPDATE wishlists
#         SET user_id = %s, guest_id = NULL, updated_at = NOW()
#         WHERE wishlist_id = %s
#         """,
#         (user_id, wishlist_id),
#     )


# # -------------------------
# # USER AUDIT (optional)
# # -------------------------
# def record_user_merge_audit(user_id: int, guest_id: str, message: str) -> None:
#     execute(
#         """
#         INSERT INTO user_audit_log (user_id, guest_id, event_type, message, created_at)
#         VALUES (%s, %s, 'merge', %s, NOW())
#         """,
#         (user_id, guest_id, message),
#     )

# -----------------------------------------------------------------------------------

# -------------------- {pgsql} -----------------
# domain/users/repository.py
#
# Repository contract (strict):
# - SQL-only. No business rules. No Firebase logic. No redirect logic.
# - Firebase UID is the ONLY user anchor.
# - Email/phone/google identities live in user_auth_identities (provider, identifier).
# - Profiles live in user_profiles.
# - All writes are idempotent where required by /api/auth/register retry semantics.

from __future__ import annotations

from typing import Optional, Dict, Any, List

from db import query_one, query_all, execute, get_db_connection


# ============================================================
# USERS (core)
# ============================================================

def get_user_by_uid(firebase_uid: str) -> Optional[Dict[str, Any]]:
    if not firebase_uid:
        return None
    return query_one(
        "SELECT * FROM users WHERE firebase_uid = %s",
        (firebase_uid,),
    )


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    if not user_id:
        return None
    return query_one(
        "SELECT * FROM users WHERE user_id = %s",
        (user_id,),
    )


def ensure_user(firebase_uid: str, update_last_login: bool = False) -> Dict[str, Any]:
    """
    Ensure a users row exists for firebase_uid (idempotent).
    Never writes email/name here (not in schema).
    Optionally updates last_login in the same statement.
    Returns the canonical user row.
    """
    if not firebase_uid:
        raise ValueError("firebase_uid required")

    db = get_db_connection()
    with db.cursor() as cur:
        if update_last_login:
            cur.execute(
                """
                INSERT INTO users (firebase_uid, last_login, created_at, updated_at)
                VALUES (%s, NOW(), NOW(), NOW())
                ON CONFLICT (firebase_uid)
                DO UPDATE SET last_login = NOW(),
                              updated_at = NOW()
                RETURNING user_id, firebase_uid, is_admin, last_login, created_at, updated_at;
                """,
                (firebase_uid,),
            )
        else:
            cur.execute(
                """
                INSERT INTO users (firebase_uid, created_at, updated_at)
                VALUES (%s, NOW(), NOW())
                ON CONFLICT (firebase_uid)
                DO UPDATE SET updated_at = NOW()
                RETURNING user_id, firebase_uid, is_admin, last_login, created_at, updated_at;
                """,
                (firebase_uid,),
            )

        row = cur.fetchone()
        db.commit()

    return row


def update_user_last_login(user_id: int) -> None:
    if not user_id:
        return
    execute(
        "UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE user_id = %s",
        (user_id,),
    )


# ============================================================
# AUTH IDENTITIES (mirror of Firebase verified state)
# ============================================================

def get_identity(provider: str, identifier: str) -> Optional[Dict[str, Any]]:
    if not provider or not identifier:
        return None
    return query_one(
        """
        SELECT *
        FROM user_auth_identities
        WHERE provider = %s AND identifier = %s
        """,
        (provider, identifier),
    )


def list_identities_for_user(user_id: int) -> List[Dict[str, Any]]:
    if not user_id:
        return []
    rows = query_all(
        """
        SELECT identity_id, user_id, provider, identifier, is_verified, is_primary, created_at, updated_at
        FROM user_auth_identities
        WHERE user_id = %s
        ORDER BY is_primary DESC, updated_at DESC, identity_id DESC
        """,
        (user_id,),
    )
    return rows or []


def upsert_identity(
    user_id: int,
    provider: str,
    identifier: str,
    *,
    is_verified: bool = True,
    is_primary: bool = False,
) -> Dict[str, Any]:
    """
    Idempotent upsert for (provider, identifier).
    Rules:
    - Never downgrade is_verified (once true, stays true).
    - user_id is set/updated to the current user_id (unique provider+identifier enforces global uniqueness).
    - is_primary can be promoted, but not automatically demoted here.
    """
    if not user_id:
        raise ValueError("user_id required")
    if not provider:
        raise ValueError("provider required")
    if not identifier:
        raise ValueError("identifier required")

    db = get_db_connection()
    with db.cursor() as cur:
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
              is_primary = (user_auth_identities.is_primary OR EXCLUDED.is_primary),
              updated_at = NOW()
            RETURNING identity_id, user_id, provider, identifier, is_verified, is_primary, created_at, updated_at;
            """,
            (user_id, provider, identifier, bool(is_verified), bool(is_primary)),
        )
        row = cur.fetchone()
        db.commit()

    return row


def clear_primary_identities(user_id: int) -> None:
    """
    Utility for service-layer primary selection.
    Repository does not decide which is primary; it only executes the requested change.
    """
    if not user_id:
        return
    execute(
        """
        UPDATE user_auth_identities
        SET is_primary = FALSE, updated_at = NOW()
        WHERE user_id = %s AND is_primary = TRUE
        """,
        (user_id,),
    )


def set_primary_identity(user_id: int, identity_id: int) -> None:
    """
    Mark one identity as primary for this user (service decides which).
    """
    if not user_id or not identity_id:
        return
    execute(
        """
        UPDATE user_auth_identities
        SET is_primary = TRUE, updated_at = NOW()
        WHERE user_id = %s AND identity_id = %s
        """,
        (user_id, identity_id),
    )


# ============================================================
# USER PROFILE (user_profiles)
# ============================================================

def get_user_profile(user_id: int) -> Optional[Dict[str, Any]]:
    if not user_id:
        return None
    return query_one(
        "SELECT * FROM user_profiles WHERE user_id = %s",
        (user_id,),
    )


def ensure_user_profile_row(user_id: int) -> None:
    """
    Ensure a profile row exists for this user (idempotent).
    """
    if not user_id:
        return
    execute(
        """
        INSERT INTO user_profiles (user_id, created_at, updated_at)
        VALUES (%s, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
        """,
        (user_id,),
    )


def update_user_profile(user_id: int, fields: Dict[str, Any]) -> None:
    """
    Update profile fields on user_profiles.
    The service layer must validate allowed keys. Repository only executes.
    """
    if not user_id:
        return
    if not fields:
        return

    set_clause = ", ".join(f"{k} = %s" for k in fields.keys())
    params = list(fields.values()) + [user_id]

    execute(
        f"""
        UPDATE user_profiles
        SET {set_clause}, updated_at = NOW()
        WHERE user_id = %s
        """,
        params,
    )


# ============================================================
# CART HELPERS (guest merge support; invoked by service)
# ============================================================

def find_guest_cart(guest_id: str) -> Optional[Dict[str, Any]]:
    if not guest_id:
        return None
    return query_one(
        "SELECT * FROM carts WHERE guest_id = %s AND status = 'active' LIMIT 1",
        (guest_id,),
    )


def find_user_cart(user_id: int) -> Optional[Dict[str, Any]]:
    if not user_id:
        return None
    return query_one(
        "SELECT * FROM carts WHERE user_id = %s AND status = 'active' LIMIT 1",
        (user_id,),
    )


def assign_cart_to_user(cart_id: int, user_id: int) -> None:
    if not cart_id or not user_id:
        return
    execute(
        """
        UPDATE carts
        SET user_id = %s, guest_id = NULL, updated_at = NOW()
        WHERE cart_id = %s
        """,
        (user_id, cart_id),
    )


def delete_guest_cart(guest_id: str) -> None:
    if not guest_id:
        return
    execute(
        "DELETE FROM carts WHERE guest_id = %s",
        (guest_id,),
    )


def is_cart_already_merged(cart_id: int) -> bool:
    if not cart_id:
        return False
    row = query_one(
        "SELECT merged_at FROM carts WHERE cart_id = %s",
        (cart_id,),
    )
    return bool(row and row.get("merged_at"))


def has_cart_for_user(user_id: int) -> bool:
    if not user_id:
        return False
    row = query_one(
        "SELECT 1 FROM carts WHERE user_id = %s AND status = 'active' LIMIT 1",
        (user_id,),
    )
    return bool(row)


def create_user_cart(user_id: int) -> None:
    if not user_id:
        return
    execute(
        """
        INSERT INTO carts (user_id, status, created_at, updated_at)
        VALUES (%s, 'active', NOW(), NOW())
        """,
        (user_id,),
    )


# ============================================================
# WISHLIST HELPERS (guest merge support; invoked by service)
# ============================================================

def is_wishlist_already_merged(wishlist_id: int) -> bool:
    if not wishlist_id:
        return False
    row = query_one(
        "SELECT status FROM wishlists WHERE wishlist_id = %s",
        (wishlist_id,),
    )
    return bool(row and row.get("status") == "merged")


def has_wishlist_for_user(user_id: int) -> bool:
    if not user_id:
        return False
    row = query_one(
        "SELECT 1 FROM wishlists WHERE user_id = %s AND status = 'active' LIMIT 1",
        (user_id,),
    )
    return bool(row)


def create_user_wishlist(user_id: int) -> None:
    if not user_id:
        return
    execute(
        """
        INSERT INTO wishlists (user_id, status, created_at, updated_at)
        VALUES (%s, 'active', NOW(), NOW())
        """,
        (user_id,),
    )


def find_guest_wishlist(guest_id: str) -> Optional[Dict[str, Any]]:
    if not guest_id:
        return None
    return query_one(
        "SELECT * FROM wishlists WHERE guest_id = %s AND status = 'active' LIMIT 1",
        (guest_id,),
    )


def assign_wishlist_to_user(wishlist_id: int, user_id: int) -> None:
    if not wishlist_id or not user_id:
        return
    execute(
        """
        UPDATE wishlists
        SET user_id = %s, guest_id = NULL, updated_at = NOW()
        WHERE wishlist_id = %s
        """,
        (user_id, wishlist_id),
    )


# ============================================================
# USER AUDIT (optional)
# ============================================================

def record_user_merge_audit(user_id: int, guest_id: str, message: str) -> None:
    if not user_id or not guest_id or not message:
        return
    execute(
        """
        INSERT INTO user_audit_log (user_id, guest_id, event_type, message, created_at)
        VALUES (%s, %s, 'merge', %s, NOW())
        """,
        (user_id, guest_id, message),
    )
