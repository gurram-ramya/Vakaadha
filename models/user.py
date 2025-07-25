# models/user.py
from db import get_db_connection

def get_or_create_user(firebase_uid, name, email):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cur.fetchone()

    if user:
        conn.close()
        return dict(user)

    # Create new user if not found
    cur.execute(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        (name, email)
    )
    conn.commit()
    user_id = cur.lastrowid
    conn.close()

    return {
        "user_id": user_id,
        "name": name,
        "email": email,
        "is_admin": 0
    }
