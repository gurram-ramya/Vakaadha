# domain/users/repository.py
from db import query_one, query_all, execute, transaction
from utils.cache import cached, user_cache, profile_cache, lock
from db import get_db_connection
# ===========================================================
# USER REPOSITORY (cached and atomic-safe)
# ===========================================================

@cached(cache=user_cache, lock=lock)
def get_user_by_uid(firebase_uid):
    """Fetch a user record by Firebase UID (cached)."""
    row = query_one("SELECT * FROM users WHERE firebase_uid = ?", (firebase_uid,))
    return dict(row) if row else None


@cached(cache=user_cache, lock=lock)
def get_user_by_email(email):
    """Fetch a user record by email (cached)."""
    return query_one("SELECT * FROM users WHERE email = ?", (email,))


# def insert_user(firebase_uid, email, name):
#     """
#     Insert a new user, return created record.
#     Ensures transaction safety and cache invalidation.
#     """
#     with transaction():
#         execute("""
#             INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
#             VALUES (?, ?, ?, datetime('now'), datetime('now'))
#         """, (firebase_uid, email, name))
#     try:
#         user_cache.pop(firebase_uid, None)
#         if email:
#             user_cache.pop(email, None)
#     except Exception:
#         pass
#     return get_user_by_uid(firebase_uid)


# def insert_user(firebase_uid, email, name):
#     con = get_db_connection()
#     con.execute(
#         """
#         INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
#         VALUES (?, ?, ?, datetime('now'), datetime('now'))
#         """,
#         (firebase_uid, email, name),
#     )
#     return get_user_by_uid(firebase_uid)

def insert_user(firebase_uid, email, name):
    con = get_db_connection()
    cur = con.cursor()
    # Try insert or fetch existing
    cur.execute(
        """
        INSERT INTO users (firebase_uid, email, name)
        VALUES (?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET name=excluded.name
        RETURNING user_id;
        """,
        (firebase_uid, email, name),
    )
    row = cur.fetchone()
    user_id = row[0] if row else cur.lastrowid
    con.commit()
    con.close()
    return {"user_id": user_id, "email": email, "name": name}


def link_firebase_uid(user_id, firebase_uid):
    """Attach a Firebase UID to an existing user record (e.g., from email match)."""
    execute("""
        UPDATE users
           SET firebase_uid = ?, updated_at = datetime('now')
         WHERE user_id = ?
           AND (firebase_uid IS NULL OR firebase_uid = '')
    """, (firebase_uid, user_id))
    try:
        user_cache.pop(firebase_uid, None)
    except Exception:
        pass


def update_user_last_login(user_id):
    """Update last login timestamp."""
    execute("UPDATE users SET last_login = datetime('now') WHERE user_id = ?", (user_id,))


# ===========================================================
# USER PROFILE REPOSITORY
# ===========================================================

@cached(cache=profile_cache, lock=lock)
def get_user_profile(user_id):
    """Fetch a user's profile (cached)."""
    return query_one("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,))


def insert_user_profile(user_id):
    """Ensure a profile exists for the given user."""
    execute("""
        INSERT OR IGNORE INTO user_profiles (user_id, created_at, updated_at)
        VALUES (?, datetime('now'), datetime('now'))
    """, (user_id,))
    try:
        profile_cache.pop(user_id, None)
    except Exception:
        pass


def update_user_profile(user_id, fields):
    """Update a user's profile fields and invalidate cache."""
    if not fields:
        return
    set_clause = ", ".join(f"{k} = ?" for k in fields.keys())
    values = list(fields.values()) + [user_id]
    execute(f"""
        UPDATE user_profiles
           SET {set_clause}, updated_at = datetime('now')
         WHERE user_id = ?
    """, values)
    try:
        profile_cache.pop(user_id, None)
    except Exception:
        pass


# ===========================================================
# CART / GUEST MERGE HELPERS
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


# def is_cart_already_merged(cart_id):
#     """Return True if a cart has been marked merged to prevent duplicate merges."""
#     row = query_one("SELECT merged_at FROM carts WHERE cart_id = ?", (cart_id,))
#     return bool(row and row.get("merged_at"))
def is_cart_already_merged(cart_id):
    con = get_db_connection()
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    row = cur.execute(
        "SELECT merged_at FROM carts WHERE cart_id = ?;", 
        (cart_id,)
    ).fetchone()
    result = bool(row and row["merged_at"]) if row else False
    con.close()
    return result

def has_cart_for_user(user_id):
    """Return True if user already has an active cart."""
    row = query_one("SELECT 1 FROM carts WHERE user_id = ? AND status = 'active' LIMIT 1;", (user_id,))
    return bool(row)


def create_user_cart(user_id):
    """Create an active cart for the given user."""
    execute("""
        INSERT INTO carts (user_id, status, created_at, updated_at)
        VALUES (?, 'active', datetime('now'), datetime('now'))
    """, (user_id,))


# ===========================================================
# WISHLIST MERGE HELPERS
# ===========================================================

def is_wishlist_already_merged(wishlist_id):
    """Return True if a wishlist has already been marked as merged."""
    row = query_one("SELECT status FROM wishlists WHERE wishlist_id = ?", (wishlist_id,))
    return row and row.get("status") == "merged"


def has_wishlist_for_user(user_id):
    """Return True if user already has an active wishlist."""
    row = query_one("SELECT 1 FROM wishlists WHERE user_id = ? AND status = 'active' LIMIT 1;", (user_id,))
    return bool(row)


def create_user_wishlist(user_id):
    """Create an active wishlist for the given user."""
    execute("""
        INSERT INTO wishlists (user_id, status, created_at, updated_at)
        VALUES (?, 'active', datetime('now'), datetime('now'))
    """, (user_id,))


def find_guest_wishlist(guest_id):
    """Return guest wishlist by guest_id if active."""
    return query_one("SELECT * FROM wishlists WHERE guest_id = ? AND status = 'active';", (guest_id,))


def assign_wishlist_to_user(wishlist_id, user_id):
    """Reassign a guest wishlist to a user after merge."""
    execute("""
        UPDATE wishlists
           SET user_id = ?, guest_id = NULL, updated_at = datetime('now')
         WHERE wishlist_id = ?;
    """, (user_id, wishlist_id))


# ===========================================================
# USER AUDIT HELPERS
# ===========================================================

def record_user_merge_audit(user_id, guest_id, message):
    """Record user merge events for observability."""
    execute("""
        INSERT INTO user_audit_log (user_id, guest_id, event_type, message, created_at)
        VALUES (?, ?, 'merge', ?, datetime('now'));
    """, (user_id, guest_id, message))
