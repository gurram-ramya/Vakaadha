# domain/users/service.py
# domain/users/service.py
"""
Business logic + DB access for Users.

Schema:

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  firebase_uid  TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE,
  password_hash TEXT,
  role          TEXT DEFAULT 'customer',
  status        TEXT DEFAULT 'active',
  last_login    DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT,
  dob          TEXT,
  gender       TEXT,
  avatar_url   TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""


from __future__ import annotations
from typing import Optional, Dict, Any
import sqlite3

from db import get_db_connection, to_dict


# ---- Row helpers ----
def _to_dict(row: sqlite3.Row | None) -> Optional[Dict[str, Any]]:
    return to_dict(row) if row is not None else None


# ---- Core getters ----
def get_user_by_firebase_uid(uid: str) -> Optional[Dict[str, Any]]:
    db = get_db_connection()
    row = db.execute("SELECT * FROM users WHERE firebase_uid = ?", (uid,)).fetchone()
    return _to_dict(row)


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    db = get_db_connection()
    row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _to_dict(row)


def get_user_with_profile(user_id: int) -> Dict[str, Any]:
    """
    Returns merged user + profile fields.
    """
    db = get_db_connection()
    row = db.execute(
        """
        SELECT
          u.id          AS user_id,
          u.firebase_uid,
          u.email,
          u.role,
          u.status,
          u.last_login,
          u.created_at,
          p.name        AS profile_name,
          p.dob         AS profile_dob,
          p.gender      AS profile_gender,
          p.avatar_url  AS profile_avatar_url,
          p.updated_at  AS profile_updated_at
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = ?
        """,
        (user_id,),
    ).fetchone()
    return _to_dict(row) or {}


# ---- Upsert / ensure ----
def ensure_user(
    firebase_uid,
    email=None,
    name=None,
    avatar_url=None,
    role="customer",
    status="active",
    update_last_login=False,
):
    """
    Ensure a user exists in the DB, creating or updating as needed.
    If a row exists with the same email but no firebase_uid, link it.
    """
    conn = get_db()
    cur = conn.cursor()

    # 1. Try find by firebase_uid
    cur.execute("SELECT * FROM users WHERE firebase_uid = ?", (firebase_uid,))
    user = cur.fetchone()

    if not user and email:
        # 2. Try find by email
        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cur.fetchone()
        if user:
            # attach firebase_uid to existing user
            cur.execute(
                "UPDATE users SET firebase_uid = ?, last_login = CURRENT_TIMESTAMP WHERE email = ?",
                (firebase_uid, email),
            )
            conn.commit()

    if user:
        if update_last_login:
            cur.execute(
                "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE firebase_uid = ?",
                (firebase_uid,),
            )
            conn.commit()
    else:
        # 3. Insert new user
        cur.execute(
            """
            INSERT INTO users (firebase_uid, email, name, role, status, last_login, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (firebase_uid, email, name, role, status),
        )
        conn.commit()

    # 4. Get user_id
    cur.execute("SELECT id FROM users WHERE firebase_uid = ?", (firebase_uid,))
    user_row = cur.fetchone()
    if not user_row:
        return None
    user_id = user_row["id"]

    # 5. Ensure profile exists
    cur.execute("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,))
    profile = cur.fetchone()
    if not profile:
        cur.execute(
            "INSERT INTO user_profiles (user_id, name, avatar_url) VALUES (?, ?, ?)",
            (user_id, name, avatar_url),
        )
        conn.commit()

    return get_user_with_profile(user_id)

# ---- Profile update ----
_ALLOWED_PROFILE_FIELDS = {"name", "dob", "gender", "avatar_url"}

def update_profile(user_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates user_profiles fields from allowed set and touches updated_at.
    """
    fields = []
    params: list[Any] = []
    for k in _ALLOWED_PROFILE_FIELDS:
        if k in data:
            fields.append(f"{k} = ?")
            params.append(data[k])

    if not fields:
        return get_user_with_profile(user_id)

    params.append(user_id)
    db = get_db_connection()
    db.execute(
        f"""
        UPDATE user_profiles
        SET {', '.join(fields)}, updated_at = datetime('now')
        WHERE user_id = ?
        """,
        tuple(params),
    )
    db.commit()
    return get_user_with_profile(user_id)


# ---- Role / status (optional admin helpers) ----
def set_role_status(user_id: int, role: Optional[str] = None, status: Optional[str] = None) -> Dict[str, Any]:
    db = get_db_connection()
    updates = []
    params: list[Any] = []
    if role is not None:
        updates.append("role = ?")
        params.append(role)
    if status is not None:
        updates.append("status = ?")
        params.append(status)
    if not updates:
        return get_user_with_profile(user_id)
    params.append(user_id)
    db.execute(
        f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
        tuple(params),
    )
    db.commit()
    return get_user_with_profile(user_id)


def delete_user(user_id: int) -> None:
    db = get_db_connection()
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
