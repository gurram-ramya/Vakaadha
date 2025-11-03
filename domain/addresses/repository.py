# domain/addresses/repository.py

import sqlite3

# -----------------------------
# Repository Layer — Direct SQL
# -----------------------------
def get_all_addresses(conn: sqlite3.Connection, user_id: int):
    cur = conn.execute(
        """SELECT address_id, user_id, name, phone, line1, line2, city, state, pincode, country, type, is_default
           FROM addresses
           WHERE user_id = ?
           ORDER BY is_default DESC, updated_at DESC""",
        (user_id,),
    )
    return [dict(row) for row in cur.fetchall()]


def get_address_by_id(conn: sqlite3.Connection, user_id: int, address_id: int):
    cur = conn.execute(
        """SELECT address_id, user_id, name, phone, line1, line2, city, state, pincode, country, type, is_default
           FROM addresses
           WHERE user_id = ? AND address_id = ?""",
        (user_id, address_id),
    )
    row = cur.fetchone()
    return dict(row) if row else None


def create_address(conn: sqlite3.Connection, user_id: int, data: dict):
    cur = conn.execute(
        """INSERT INTO addresses (user_id, name, phone, line1, line2, city, state, pincode, country, type, is_default)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            user_id,
            data.get("name"),
            data.get("phone"),
            data.get("line1"),
            data.get("line2"),
            data.get("city"),
            data.get("state"),
            data.get("pincode"),
            data.get("country", "IN"),
            data.get("type", "shipping"),
            data.get("is_default", 0),
        ),
    )
    conn.commit()
    return cur.lastrowid


def update_address(conn: sqlite3.Connection, user_id: int, address_id: int, data: dict):
    conn.execute(
        """UPDATE addresses
           SET name=?, phone=?, line1=?, line2=?, city=?, state=?, pincode=?, updated_at=datetime('now')
           WHERE user_id=? AND address_id=?""",
        (
            data.get("name"),
            data.get("phone"),
            data.get("line1"),
            data.get("line2"),
            data.get("city"),
            data.get("state"),
            data.get("pincode"),
            user_id,
            address_id,
        ),
    )
    conn.commit()


def delete_address(conn: sqlite3.Connection, user_id: int, address_id: int):
    conn.execute(
        "DELETE FROM addresses WHERE user_id = ? AND address_id = ?",
        (user_id, address_id),
    )
    conn.commit()


def set_default_address(conn: sqlite3.Connection, user_id: int, address_id: int):
    conn.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", (user_id,))
    conn.execute(
        "UPDATE addresses SET is_default = 1 WHERE user_id = ? AND address_id = ?",
        (user_id, address_id),
    )
    conn.commit()
