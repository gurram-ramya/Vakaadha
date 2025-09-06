# domain/users/service.py
from __future__ import annotations
from typing import Optional, Dict, Any

from db import get_db

DEFAULT_ROLE = "user"   # enforce role = 'user' for new users
DEFAULT_STATUS = "active"


def _row_to_dict(row) -> Dict[str, Any]:
    if row is None:
        return {}
    # sqlite3.Row is mapping-like
    d = dict(row)
    # Provide both keys during transition so callers using either will work
    if "id" in d and "user_id" not in d:
        d["user_id"] = d["id"]
    return d


def ensure_user(
    *,
    firebase_uid: str,
    email: Optional[str],
    name: Optional[str],
    avatar_url: Optional[str],
    update_last_login: bool = True,
) -> Dict[str, Any]:
    """
    Idempotent: create or update a local user row for the given Firebase UID.
    - Always creates a user with role='user' if not present.
    - If Firebase supplies a name/picture, we update those (but never overwrite with empty).
    - Ensures a user_profiles row exists for the user.
    - Optionally updates last_login timestamp.
    Returns the user row as dict (includes both 'id' and 'user_id').
    """
    con = get_db()
    cur = con.execute(
        "SELECT * FROM users WHERE firebase_uid = ?",
        (firebase_uid,)
    )
    row = cur.fetchone()

    if row:
        user = dict(row)
        updates = []
        params = []

        # Normalize role if missing/empty
        if not user.get("role"):
            updates.append("role = ?")
            params.append(DEFAULT_ROLE)

        # Email may change (e.g., provider linked) — update if provided and different
        if email and email != user.get("email"):
            updates.append("email = ?")
            params.append(email)

        # Name & avatar: update if Firebase gives a non-empty string and it's different
        if name and name.strip() and name.strip() != (user.get("name") or "").strip():
            updates.append("name = ?")
            params.append(name.strip())

        if avatar_url and avatar_url.strip():
            # Optional: add avatar_url column if you keep it in users; or store in profile
            # If you store it in profile, handle it below in profile ensuring.
            pass  # no-op unless you add users.avatar_url

        if update_last_login:
            updates.append("last_login = datetime('now')")

        if updates:
            params.append(firebase_uid)
            con.execute(f"UPDATE users SET {', '.join(updates)} WHERE firebase_uid = ?", params)

        user_id = user["id"]
    else:
        # Insert new user
        con.execute(
            """
            INSERT INTO users (email, firebase_uid, password_hash, name, role, status, last_login)
            VALUES (?, ?, NULL, ?, ?, ?, datetime('now'))
            """,
            (email, firebase_uid, (name or (email.split("@")[0] if email else None)), DEFAULT_ROLE, DEFAULT_STATUS)
        )
        user_id = con.execute("SELECT last_insert_rowid()").fetchone()[0]

    # Ensure profile exists (minimal)
    con.execute(
        """
        INSERT INTO user_profiles (user_id)
        SELECT ? WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = ?)
        """,
        (user_id, user_id)
    )
    con.commit()

    # Return the fresh row
    row = con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _row_to_dict(row)


def get_user_by_firebase_uid(firebase_uid: str) -> Dict[str, Any]:
    con = get_db()
    row = con.execute("SELECT * FROM users WHERE firebase_uid = ?", (firebase_uid,)).fetchone()
    return _row_to_dict(row)


def get_user_with_profile(user_id: int) -> Dict[str, Any]:
    con = get_db()
    row = con.execute(
        """
        SELECT
          u.id, u.email, u.firebase_uid, u.name, u.role, u.status, u.last_login, u.created_at,
          p.dob    AS profile_dob,
          p.gender AS profile_gender,
          p.avatar_url AS profile_avatar_url
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = ?
        """,
        (user_id,)
    ).fetchone()
    return _row_to_dict(row)


def update_profile(user_id: int, *, name: Optional[str], dob: Optional[str], gender: Optional[str], avatar_url: Optional[str]) -> Dict[str, Any]:
    """
    Update user name (if provided) and profile fields.
    Returns merged user + profile dict.
    """
    con = get_db()

    # Update name if provided (trim + non-empty)
    if name is not None:
        nm = name.strip()
        con.execute("UPDATE users SET name = ? WHERE id = ?", (nm if nm else None, user_id))

    # Ensure profile exists, then update selective fields
    con.execute(
        "INSERT INTO user_profiles (user_id) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = ?)",
        (user_id, user_id)
    )

    updates = []
    params = []
    if dob is not None:
        updates.append("dob = ?"); params.append(dob if dob else None)
    if gender is not None:
        updates.append("gender = ?"); params.append(gender if gender else None)
    if avatar_url is not None:
        updates.append("avatar_url = ?"); params.append(avatar_url if avatar_url else None)

    if updates:
        params.extend([user_id])
        con.execute(f"UPDATE user_profiles SET {', '.join(updates)} WHERE user_id = ?", params)

    con.commit()
    return get_user_with_profile(user_id)
