# domain/users/service.py

import logging
import sqlite3
from datetime import datetime
from ...db import get_db_connection             # corrected import
from ...domain.cart import service as cart_service  # corrected import

# -------------------------------------------------------------
# Exception Classes
# -------------------------------------------------------------
class UserNotFoundError(Exception):
    pass

class DuplicateUserError(Exception):
    pass

class TokenExpiredError(Exception):
    pass

class InvalidTokenError(Exception):
    pass

class DBError(Exception):
    pass

class GuestCartNotFoundError(Exception):
    pass

class MergeConflictError(Exception):
    pass


# -------------------------------------------------------------
# Core User Lifecycle Functions
# -------------------------------------------------------------
def upsert_user_from_firebase(conn, firebase_uid, email, name=None, avatar_url=None, update_last_login=True):
    if not firebase_uid or not isinstance(firebase_uid, str):
        raise InvalidTokenError("Invalid or missing Firebase UID")
    if not email or "@" not in email:
        raise InvalidTokenError("Invalid or missing email")

    cursor = conn.cursor()
    try:
        conn.execute("BEGIN IMMEDIATE")

        # Check existing by firebase_uid
        cursor.execute("SELECT user_id, firebase_uid, email, name, is_admin FROM users WHERE firebase_uid = ?", (firebase_uid,))
        existing = cursor.fetchone()
        if existing:
            user = {
                "user_id": existing[0],
                "firebase_uid": existing[1],
                "email": existing[2],
                "name": existing[3],
                "is_admin": bool(existing[4])
            }
            if update_last_login:
                cursor.execute("UPDATE users SET last_login = ? WHERE user_id = ?", (datetime.utcnow().isoformat(), user["user_id"]))
                conn.commit()
            return user

        # Check if email exists but UID not linked
        cursor.execute("SELECT user_id FROM users WHERE email = ? AND firebase_uid IS NULL", (email,))
        row = cursor.fetchone()
        if row:
            user_id = row[0]
            cursor.execute(
                "UPDATE users SET firebase_uid = ?, name = COALESCE(name, ?), last_login = ? WHERE user_id = ?",
                (firebase_uid, name or "New User", datetime.utcnow().isoformat(), user_id)
            )
            conn.commit()
            logging.info({"event": "user_link", "firebase_uid": firebase_uid, "email": email, "user_id": user_id})
        else:
            # Insert new user
            cursor.execute(
                "INSERT INTO users (firebase_uid, email, name, is_admin, last_login) VALUES (?, ?, ?, ?, ?)",
                (firebase_uid, email, name or "New User", 0, datetime.utcnow().isoformat())
            )
            user_id = cursor.lastrowid
            conn.commit()
            logging.info({"event": "user_create", "firebase_uid": firebase_uid, "email": email, "user_id": user_id})

        # Return unified record
        return {
            "user_id": user_id,
            "firebase_uid": firebase_uid,
            "email": email,
            "name": name or "New User",
            "is_admin": False
        }

    except sqlite3.IntegrityError as e:
        conn.rollback()
        raise DuplicateUserError(str(e))
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))


def ensure_user_cart(user_id):
    conn = get_db_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        cursor.execute("SELECT cart_id FROM carts WHERE user_id = ?", (user_id,))
        existing = cursor.fetchone()
        if existing:
            cart_id = existing[0]
        else:
            cursor.execute("INSERT INTO carts (user_id, created_at) VALUES (?, ?)", (user_id, datetime.utcnow().isoformat()))
            cart_id = cursor.lastrowid
            conn.commit()
        return {"cart_id": cart_id}
    except Exception as e:
        conn.rollback()
        raise DBError(str(e))
    finally:
        conn.close()


def merge_guest_cart_if_any(user_id, guest_id):
    if not guest_id:
        return None
    try:
        merge_result = cart_service.merge_guest_cart(user_id, guest_id)
        logging.info({
            "event": "merge_guest_cart",
            "user_id": user_id,
            "guest_id": guest_id,
            "merge_result": merge_result
        })
        return merge_result
    except cart_service.GuestCartNotFoundError:
        raise GuestCartNotFoundError("Guest cart not found")
    except cart_service.MergeConflictError:
        raise MergeConflictError("Conflict during guest cart merge")
    except Exception as e:
        raise DBError(str(e))


def ensure_user_with_merge(conn, firebase_uid, email, name, avatar_url, guest_id=None, update_last_login=True):
    user = upsert_user_from_firebase(
        conn=conn,
        firebase_uid=firebase_uid,
        email=email,
        name=name,
        avatar_url=avatar_url,
        update_last_login=update_last_login
    )

    # Ensure user profile exists
    ensure_user_profile(conn, user["user_id"], name=name, avatar_url=avatar_url)

    # Ensure user cart
    ensure_user_cart(user["user_id"])

    # Merge guest cart if applicable
    merge_result = None
    if guest_id:
        merge_result = merge_guest_cart_if_any(user["user_id"], guest_id)

    return user, merge_result


# -------------------------------------------------------------
# Profile Management
# -------------------------------------------------------------
def ensure_user_profile(conn, user_id, name=None, avatar_url=None):
    cursor = conn.cursor()
    cursor.execute("SELECT profile_id FROM user_profiles WHERE user_id = ?", (user_id,))
    existing = cursor.fetchone()
    if existing:
        return

    cursor.execute(
        "INSERT INTO user_profiles (user_id, name, dob, gender, avatar_url) VALUES (?, ?, ?, ?, ?)",
        (user_id, name or "New User", None, "other", avatar_url)
    )
    conn.commit()
    logging.info({"event": "profile_create", "user_id": user_id})


def get_user_with_profile(conn, firebase_uid):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.user_id, u.firebase_uid, u.email, u.name, u.is_admin,
               p.dob, p.gender, p.avatar_url
        FROM users u
        LEFT JOIN user_profiles p ON u.user_id = p.user_id
        WHERE u.firebase_uid = ?
    """, (firebase_uid,))
    row = cursor.fetchone()
    if not row:
        raise UserNotFoundError("User not found")

    return {
        "user_id": row[0],
        "firebase_uid": row[1],
        "email": row[2],
        "name": row[3],
        "is_admin": bool(row[4]),
        "dob": row[5],
        "gender": row[6],
        "avatar_url": row[7]
    }


def update_profile(conn, firebase_uid, data):
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM users WHERE firebase_uid = ?", (firebase_uid,))
    row = cursor.fetchone()
    if not row:
        raise UserNotFoundError("User not found")
    user_id = row[0]

    fields = []
    values = []
    for k, v in data.items():
        if k in ["name", "dob", "gender", "avatar_url"]:
            fields.append(f"{k} = ?")
            values.append(v)
    if not fields:
        return get_user_with_profile(conn, firebase_uid)

    values.append(user_id)
    query = f"UPDATE user_profiles SET {', '.join(fields)} WHERE user_id = ?"
    cursor.execute(query, tuple(values))
    conn.commit()
    logging.info({"event": "profile_update", "user_id": user_id, "fields": list(data.keys())})
    return get_user_with_profile(conn, firebase_uid)
