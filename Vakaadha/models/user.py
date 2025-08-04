# models/user.py
from db import get_db_connection

def get_or_create_user(firebase_uid, name, email):
    conn = get_db_connection()
    try:
        conn.row_factory = lambda cursor, row: {
            "user_id": row[0],
            "name": row[1],
            "email": row[2],
            "is_admin": row[3],
            "created_at": row[4]
        }
        cur = conn.cursor()

        # 🔍 Check if user already exists
        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cur.fetchone()

        if user:
            return user

        # ➕ Create new user
        cur.execute(
            "INSERT INTO users (name, email) VALUES (?, ?)",
            (name, email)
        )
        conn.commit()

        # 🔁 Fetch new user to return complete row
        cur.execute("SELECT * FROM users WHERE email = ?", (email,))
        new_user = cur.fetchone()
        return new_user

    finally:
        cur.close()
        conn.close()
