# domain/users/preferences_service.py
from db import query_all, query_one, execute

# ==============================================================
# USER PREFERENCES SERVICE
# ==============================================================

def list_preferences(user_id):
    """Return all preferences for a user."""
    rows = query_all("SELECT key, value FROM user_preferences WHERE user_id = ?", (user_id,))
    return {r["key"]: r["value"] for r in rows}

def get_preference(user_id, key):
    """Return a single preference value."""
    row = query_one("SELECT value FROM user_preferences WHERE user_id = ? AND key = ?", (user_id, key))
    return row["value"] if row else None

def set_preference(user_id, key, value):
    """Insert or update a user preference."""
    execute("""
        INSERT INTO user_preferences (user_id, key, value, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(user_id, key)
        DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    """, (user_id, key, value))

def delete_preference(user_id, key):
    execute("DELETE FROM user_preferences WHERE user_id = ? AND key = ?", (user_id, key))
