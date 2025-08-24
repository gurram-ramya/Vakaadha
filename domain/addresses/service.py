from db import get_db_connection

def list_addresses(user_id: int):
    con = get_db_connection(); cur = con.cursor()
    cur.execute("""
      SELECT address_id, full_name, phone, type, line1, line2, city, state, zip, country
      FROM addresses
      WHERE user_id=?
      ORDER BY created_at DESC
    """, [user_id])
    rows = cur.fetchall()
    return [
        {
            "address_id": r[0],
            "full_name": r[1],
            "phone": r[2],
            "type": r[3],
            "line1": r[4],
            "line2": r[5],
            "city": r[6],
            "state": r[7],
            "zip": r[8],
            "country": r[9]
        }
        for r in rows
    ]

def add_address(user_id: int, data: dict):
    con = get_db_connection(); cur = con.cursor()
    cur.execute("""
      INSERT INTO addresses (user_id, full_name, phone, type, line1, line2, city, state, zip, country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        user_id,
        data["full_name"],
        data["phone"],
        data.get("type", "shipping"),
        data["line1"],
        data.get("line2"),
        data["city"],
        data.get("state"),
        data["zip"],
        data.get("country", "India")
    ])
    con.commit()
    return {"address_id": cur.lastrowid}
