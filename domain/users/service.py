# domain/users/service.py
"""
Business logic + DB access for Users.
Assumed schema (adjust names if yours differ):

CREATE TABLE IF NOT EXISTS users (
  user_id      INTEGER PRIMARY KEY,
  firebase_uid TEXT UNIQUE NOT NULL,
  email        TEXT,
  display_name TEXT,
  photo_url    TEXT,
  phone        TEXT,
  role         TEXT DEFAULT 'user',
  status       TEXT DEFAULT 'active',
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id       INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  name          TEXT,
  dob           TEXT,
  gender        TEXT,
  avatar_url    TEXT,
  updated_at    TEXT DEFAULT (datetime('now'))
);

Ensure UNIQUE(firebase_uid) exists on users.
"""

from __future__ import annotations

from typing import Optional, Dict, Any, Iterable, Sequence
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
    row = db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
    return _to_dict(row)


def get_user_with_profile(user_id: int) -> Dict[str, Any]:
    """
    Returns merged user + profile fields.
    If profile row is missing, returns user fields only.
    """
    db = get_db_connection()
    row = db.execute(
        """
        SELECT
          u.user_id, u.firebase_uid, u.email, u.display_name, u.photo_url, u.phone,
          u.role, u.status, u.created_at, u.updated_at,
          p.name    AS profile_name,
          p.dob     AS profile_dob,
          p.gender  AS profile_gender,
          p.avatar_url AS profile_avatar_url,
          p.updated_at AS profile_updated_at
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.user_id
        WHERE u.user_id = ?
        """,
        (user_id,),
    ).fetchone()
    return _to_dict(row) or {}


# ---- Upsert / ensure ----
def ensure_user(
    firebase_uid: str,
    email: Optional[str],
    display_name: Optional[str],
    photo_url: Optional[str] = None,
    phone: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Idempotent: insert or update a user by firebase_uid.
    Ensures a user_profiles row exists.
    """
    db = get_db_connection()
    db.execute(
        """
        INSERT INTO users (firebase_uid, email, display_name, photo_url, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(firebase_uid) DO UPDATE SET
            email        = excluded.email,
            display_name = COALESCE(excluded.display_name, users.display_name),
            photo_url    = COALESCE(excluded.photo_url, users.photo_url),
            phone        = COALESCE(excluded.phone, users.phone),
            updated_at   = datetime('now');
        """,
        (firebase_uid, email, display_name, photo_url, phone),
    )
    # Ensure a profile row exists
    row = db.execute("SELECT user_id FROM users WHERE firebase_uid = ?", (firebase_uid,)).fetchone()
    user_id = row["user_id"]
    db.execute(
        """
        INSERT INTO user_profiles (user_id, name, avatar_url, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO NOTHING;
        """,
        (user_id, display_name or "", photo_url or ""),
    )
    db.commit()
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
        # nothing to update; return current
        return get_user_with_profile(user_id)

    params.extend([user_id])
    db = get_db_connection()
    db.execute(
        f"UPDATE user_profiles SET {', '.join(fields)}, updated_at = datetime('now') WHERE user_id = ?",
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
    db.execute(f"UPDATE users SET {', '.join(updates)}, updated_at = datetime('now') WHERE user_id = ?", tuple(params))
    db.commit()
    return get_user_with_profile(user_id)


def delete_user(user_id: int) -> None:
    db = get_db_connection()
    db.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
    db.commit()
