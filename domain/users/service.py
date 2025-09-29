# domain/users/service.py
from typing import Optional, Dict, Any
import sqlite3
from datetime import datetime


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """Convert sqlite3.Row into plain dict."""
    return dict(row) if row else None


# ------------------------------------------------
# User Management
# ------------------------------------------------

def ensure_user(
    firebase_uid: str,
    email: Optional[str] = None,
    name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    update_last_login: bool = False,
) -> Dict[str, Any]:
    """
    Ensure a user exists for this firebase_uid.
    - If not exists, create one with provided data.
    - If exists, return it (optionally update last_login and name/email/avatar).
    """
    from db import get_db_connection
    con = get_db_connection()
    con.row_factory = sqlite3.Row

    cur = con.execute("SELECT * FROM users WHERE firebase_uid = ?", (firebase_uid,))
    row = cur.fetchone()

    if row:
        updates = []
        params = []
        if name and not row["name"]:
            updates.append("name = ?")
            params.append(name)
        if email and not row["email"]:
            updates.append("email = ?")
            params.append(email)
        if update_last_login:
            updates.append("last_login = ?")
            params.append(datetime.utcnow().isoformat())
        if updates:
            sql = f"UPDATE users SET {', '.join(updates)} WHERE firebase_uid = ?"
            params.append(firebase_uid)
            con.execute(sql, tuple(params))
            con.commit()
        # return refreshed row
        cur = con.execute("SELECT * FROM users WHERE firebase_uid = ?", (firebase_uid,))
        return _row_to_dict(cur.fetchone())

    # User not found → create
    cur = con.execute(
        """
        INSERT INTO users (firebase_uid, email, name, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (firebase_uid, email, name, datetime.utcnow().isoformat()),
    )
    con.commit()
    cur = con.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,))
    return _row_to_dict(cur.fetchone())


def get_user_with_profile(con: sqlite3.Connection, firebase_uid: str) -> Optional[Dict[str, Any]]:
    """
    Fetch user with profile data merged in.
    """
    cur = con.execute(
        """
        SELECT u.id AS user_id,
               u.firebase_uid,
               u.email,
               u.name,
               u.role,
               u.status,
               u.last_login,
               u.created_at,
               p.dob,
               p.gender,
               p.avatar_url
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.firebase_uid = ?
        """,
        (firebase_uid,),
    )
    return _row_to_dict(cur.fetchone())


def update_profile(
    con: sqlite3.Connection,
    firebase_uid: str,
    name: Optional[str] = None,
    dob: Optional[str] = None,
    gender: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Update both users and user_profiles tables.
    """
    cur = con.execute("SELECT id FROM users WHERE firebase_uid = ?", (firebase_uid,))
    row = cur.fetchone()
    if not row:
        raise ValueError("User not found")
    user_id = row["id"]

    # Update name if provided
    if name is not None:
        con.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))

    # Upsert profile
    cur = con.execute("SELECT id FROM user_profiles WHERE user_id = ?", (user_id,))
    prof_row = cur.fetchone()
    if prof_row:
        con.execute(
            """
            UPDATE user_profiles
            SET dob = COALESCE(?, dob),
                gender = COALESCE(?, gender),
                avatar_url = COALESCE(?, avatar_url)
            WHERE user_id = ?
            """,
            (dob, gender, avatar_url, user_id),
        )
    else:
        con.execute(
            """
            INSERT INTO user_profiles (user_id, dob, gender, avatar_url)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, dob, gender, avatar_url),
        )

    con.commit()
    return get_user_with_profile(con, firebase_uid)
