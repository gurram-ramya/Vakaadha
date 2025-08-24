# domain/users/service.py
"""
Business logic + DB access for Users service.
"""

from typing import Optional, Dict, Any
from db import get_db_connection


# --------- User core ---------

def get_user_by_firebase_uid(uid: str) -> Optional[Dict[str, Any]]:
    db = get_db_connection()
    return db.execute("SELECT * FROM users WHERE firebase_uid=?", (uid,)).fetchone()


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    db = get_db_connection()
    return db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()


def create_user_from_firebase(uid: str, email: str, name: str = "", phone: str = None) -> Dict[str, Any]:
    """
    Insert a new user (from Firebase identity) into DB.
    Also creates a blank profile row.
    """
    db = get_db_connection()
    cur = db.execute(
        """
        INSERT INTO users (firebase_uid, email, phone, name, role, status)
        VALUES (?, ?, ?, ?, 'customer', 'active')
        """,
        (uid, email, phone, name),
    )
    user_id = cur.lastrowid

    db.execute("INSERT INTO user_profiles (user_id) VALUES (?)", (user_id,))
    db.commit()

    return get_user_with_profile(user_id)


def update_last_login(user_id: int) -> None:
    db = get_db_connection()
    db.execute("UPDATE users SET last_login=datetime('now') WHERE user_id=?", (user_id,))
    db.commit()


def get_user_with_profile(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Return user row joined with profile info.
    """
    db = get_db_connection()
    user = db.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()
    if not user:
        return None
    profile = db.execute("SELECT * FROM user_profiles WHERE user_id=?", (user_id,)).fetchone()
    return {**dict(user), "profile": dict(profile) if profile else {}}


# --------- Profile ---------

def update_user_profile(user_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update fields in users + user_profiles.
    Supports: name, dob, gender, avatar_url, phone
    """
    db = get_db_connection()

    # Update core user table
    if "name" in data or "phone" in data:
        db.execute(
            "UPDATE users SET name=COALESCE(?, name), phone=COALESCE(?, phone) WHERE user_id=?",
            (data.get("name"), data.get("phone"), user_id),
        )

    # Update profile table
    if "dob" in data or "gender" in data or "avatar_url" in data:
        db.execute(
            """
            UPDATE user_profiles
            SET dob=COALESCE(?, dob),
                gender=COALESCE(?, gender),
                avatar_url=COALESCE(?, avatar_url)
            WHERE user_id=?
            """,
            (data.get("dob"), data.get("gender"), data.get("avatar_url"), user_id),
        )

    db.commit()
    return get_user_with_profile(user_id)


# --------- Admin operations ---------

def list_users() -> list[Dict[str, Any]]:
    db = get_db_connection()
    rows = db.execute("SELECT * FROM users").fetchall()
    return [dict(r) for r in rows]


def update_user_role_status(user_id: int, role: Optional[str], status: Optional[str]) -> Optional[Dict[str, Any]]:
    db = get_db_connection()
    db.execute(
        "UPDATE users SET role=COALESCE(?, role), status=COALESCE(?, status) WHERE user_id=?",
        (role, status, user_id),
    )
    db.commit()
    return get_user_with_profile(user_id)


def delete_user(user_id: int) -> None:
    """
    Cascade delete user + profile.
    Addresses table should also have ON DELETE CASCADE if set up.
    """
    db = get_db_connection()
    db.execute("DELETE FROM users WHERE user_id=?", (user_id,))
    db.commit()
