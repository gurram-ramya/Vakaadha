# domain/addresses/service.py
import logging

# -------------------------------------------------------------
# Fetch all addresses for a user
# -------------------------------------------------------------
def list_addresses(conn, user_id):
    cur = conn.cursor()
    cur.execute("""
        SELECT address_id, name, line1, line2, city, state, pincode, phone, is_default
        FROM user_addresses
        WHERE user_id = ?
        ORDER BY is_default DESC, created_at DESC
    """, (user_id,))
    rows = cur.fetchall()
    return [dict(r) for r in rows]


# -------------------------------------------------------------
# Add a new address
# -------------------------------------------------------------
def add_address(conn, user_id, data):
    required = ["name", "line1", "city", "state", "pincode", "phone"]
    for key in required:
        if not data.get(key):
            raise ValueError(f"Missing required field: {key}")

    is_default = 1 if data.get("is_default") else 0
    cur = conn.cursor()

    # If marking as default, unset others
    if is_default:
        cur.execute("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?", (user_id,))

    cur.execute("""
        INSERT INTO user_addresses (user_id, name, line1, line2, city, state, pincode, phone, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        data["name"],
        data["line1"],
        data.get("line2"),
        data["city"],
        data["state"],
        data["pincode"],
        data["phone"],
        is_default,
    ))

    address_id = cur.lastrowid
    logging.info({
        "event": "address_add",
        "user_id": user_id,
        "address_id": address_id
    })
    return get_address(conn, user_id, address_id)


# -------------------------------------------------------------
# Get a single address
# -------------------------------------------------------------
def get_address(conn, user_id, address_id):
    cur = conn.cursor()
    cur.execute("""
        SELECT address_id, name, line1, line2, city, state, pincode, phone, is_default
        FROM user_addresses
        WHERE user_id = ? AND address_id = ?
    """, (user_id, address_id))
    row = cur.fetchone()
    return dict(row) if row else None


# -------------------------------------------------------------
# Update existing address
# -------------------------------------------------------------
def update_address(conn, user_id, address_id, data):
    addr = get_address(conn, user_id, address_id)
    if not addr:
        return None

    fields = ["name", "line1", "line2", "city", "state", "pincode", "phone"]
    updates = []
    values = []
    for f in fields:
        if f in data:
            updates.append(f"{f} = ?")
            values.append(data[f])

    if not updates and "is_default" not in data:
        return addr  # nothing to update

    # Handle default toggle
    if data.get("is_default"):
        cur = conn.cursor()
        cur.execute("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?", (user_id,))
        cur.execute("UPDATE user_addresses SET is_default = 1 WHERE user_id = ? AND address_id = ?", (user_id, address_id))
    else:
        if updates:
            query = f"UPDATE user_addresses SET {', '.join(updates)} WHERE user_id = ? AND address_id = ?"
            values.extend([user_id, address_id])
            cur = conn.cursor()
            cur.execute(query, tuple(values))

    logging.info({
        "event": "address_update",
        "user_id": user_id,
        "address_id": address_id
    })
    return get_address(conn, user_id, address_id)


# -------------------------------------------------------------
# Delete address
# -------------------------------------------------------------
def delete_address(conn, user_id, address_id):
    cur = conn.cursor()
    cur.execute("""
        DELETE FROM user_addresses
        WHERE user_id = ? AND address_id = ?
    """, (user_id, address_id))
    deleted = cur.rowcount > 0
    logging.info({
        "event": "address_delete",
        "user_id": user_id,
        "address_id": address_id,
        "deleted": deleted
    })
    return deleted
