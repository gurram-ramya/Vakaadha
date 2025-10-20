# domain/users/repository.py
from db import query_one, query_all, execute, transaction
from utils.cache import cached, user_cache, profile_cache, lock

# ===========================================================
# USER REPOSITORY (with caching)
# ===========================================================

@cached(cache=user_cache, lock=lock)
def get_user_by_uid(uid):
    """Fetch a user record by Firebase UID (cached)."""
    return query_one("SELECT * FROM users WHERE firebase_uid = ?", (uid,))

@cached(cache=user_cache, lock=lock)
def get_user_by_email(email):
    """Fetch a user record by email (cached)."""
    return query_one("SELECT * FROM users WHERE email = ?", (email,))

def insert_user(firebase_uid, email, name):
    """Insert new user and invalidate cache."""
    execute("""
        INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
    """, (firebase_uid, email, name))
    # Cache invalidation
    user_cache.pop(firebase_uid, None)
    if email:
        user_cache.pop(email, None)
    return get_user_by_uid(firebase_uid)

def update_user_last_login(user_id):
    """Update last login timestamp."""
    execute("UPDATE users SET last_login = datetime('now') WHERE user_id = ?", (user_id,))

@cached(cache=profile_cache, lock=lock)
def get_user_profile(user_id):
    """Fetch a user's profile (cached)."""
    return query_one("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,))

def insert_user_profile(user_id):
    """Ensure a profile exists for the given user."""
    execute("INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)", (user_id,))
    profile_cache.pop(user_id, None)

def update_user_profile(user_id, fields):
    """Update a user's profile and invalidate cache."""
    if not fields:
        return
    set_clause = ", ".join(f"{k} = ?" for k in fields.keys())
    values = list(fields.values()) + [user_id]
    execute(f"""
        UPDATE user_profiles
        SET {set_clause}, updated_at = datetime('now')
        WHERE user_id = ?
    """, values)
    profile_cache.pop(user_id, None)

# ===========================================================
# CART / GUEST MERGE HELPERS (unchanged)
# ===========================================================

def find_guest_cart(guest_id):
    """Find a guest cart by guest_id."""
    return query_one("SELECT * FROM carts WHERE guest_id = ?", (guest_id,))

def find_user_cart(user_id):
    """Find an existing cart for a user."""
    return query_one("SELECT * FROM carts WHERE user_id = ?", (user_id,))

def assign_cart_to_user(cart_id, user_id):
    """Reassign a guest cart to a user."""
    execute("UPDATE carts SET user_id = ?, guest_id = NULL WHERE cart_id = ?", (user_id, cart_id))

def delete_guest_cart(guest_id):
    """Delete a guest cart once merged."""
    execute("DELETE FROM carts WHERE guest_id = ?", (guest_id,))
