# # domain/users/service.py
# import logging
# from datetime import datetime
# from domain.users import repository
# from domain.cart import service as cart_service
# from domain.cart import repository as cart_repo
# from domain.wishlist import service as wishlist_service
# from domain.wishlist import repository as wishlist_repo
# from db import get_db_connection


# # ===========================================================
# # USER SERVICE (Business Logic Layer)
# # ===========================================================
# def upsert_user_from_firebase(firebase_uid, email, name):
#     # 1. existing by UID
#     user = repository.get_user_by_uid(firebase_uid)
#     if user:
#         repository.update_user_last_login(user["user_id"])
#         return user

#     # 2. existing by email
#     if email:
#         existing = repository.get_user_by_email(email)
#         if existing:
#             logging.info(f"Linking existing user {email} with Firebase UID")
#             repository.update_user_last_login(existing["user_id"])
#             return existing

#     # 3. attempt insert, fallback on duplicates
#     try:
#         repository.insert_user(firebase_uid, email, name)
#     except Exception as e:
#         if "UNIQUE constraint failed" in str(e):
#             logging.warning(f"Duplicate user insert attempt for {email}, fetching existing record.")
#             existing = repository.get_user_by_email(email)
#             if existing:
#                 repository.update_user_last_login(existing["user_id"])
#                 return existing
#         logging.exception(f"Insert failed for {email}")
#         return None

#     # 4. confirm creation
#     new_user = repository.get_user_by_uid(firebase_uid)
#     if new_user:
#         logging.info(f"Created new user {email}")
#         repository.update_user_last_login(new_user["user_id"])
#     else:
#         logging.error(f"Failed to fetch newly created user for {email}")
#     return new_user




# def ensure_user_profile(user_id):
#     repository.insert_user_profile(user_id)
#     return repository.get_user_profile(user_id)


# def update_profile(conn, firebase_uid, updates):
#     """Update profile by firebase_uid (align with route)"""
#     user = repository.get_user_by_uid(firebase_uid)
#     if not user:
#         return None

#     allowed = {"name", "dob", "gender", "avatar_url"}
#     fields = {k: v for k, v in updates.items() if k in allowed}

#     # Update users.name separately
#     if "name" in fields:
#         from db import execute
#         execute("UPDATE users SET name = ?, updated_at = datetime('now') WHERE user_id = ?",
#                 (fields["name"], user["user_id"]))
#         del fields["name"]

#     if fields:
#         repository.update_user_profile(user["user_id"], fields)

#     merged = repository.get_user_profile(user["user_id"]) or {}
#     return {**user, **merged}


# # ===========================================================
# # CORE LOGIN → MERGE LOGIC
# # ===========================================================

# def ensure_user_with_merge(conn, firebase_uid, email, name, avatar_url, guest_id, update_last_login=True):
#     """
#     Called on user login. Guarantees user record, profile,
#     and merges any guest cart/wishlist into the user's account
#     while performing audit normalization.
#     """
#     user = upsert_user_from_firebase(firebase_uid, email, name)
#     user_id = user["user_id"]

#     ensure_user_profile(user_id)
#     # cart_service.ensure_user_cart(user_id)

#     merge_result = {"cart": None, "wishlist": None}
#     if guest_id:
#         # perform atomic merges with audit normalization
#         merge_result["cart"] = merge_guest_cart_if_any(user_id, guest_id)
#         merge_result["wishlist"] = merge_guest_wishlist_if_any(user_id, guest_id)

#     if update_last_login:
#         repository.update_user_last_login(user_id)

#     return user, merge_result


# # ===========================================================
# # CART MERGE + AUDIT REASSIGNMENT
# # ===========================================================

# def merge_guest_cart_if_any(user_id, guest_id):
#     guest_cart = repository.find_guest_cart(guest_id)
#     if not guest_cart:
#         return {"merged_items": 0}

#     user_cart = repository.find_user_cart(user_id)
#     conn = get_db_connection()

#     if not user_cart:
#         # assign guest cart directly to user
#         repository.assign_cart_to_user(guest_cart["cart_id"], user_id)
#         cart_repo.insert_audit_event(conn, guest_cart["cart_id"], user_id, guest_id,
#                                      "reassign", f"Guest cart reassigned to user {user_id}")
#         conn.commit()
#         conn.close()
#         logging.info(f"Assigned guest cart to user {user_id}")
#         return {"merged_items": 0}

#     # both exist -> merge via cart service
#     merge_result = cart_service.merge_guest_cart_if_any(user_id, guest_id)

#     # mark merged and reassign all ownership references
#     cart_repo.mark_cart_merged(conn, guest_cart["cart_id"])
#     conn.execute("""
#         UPDATE cart_items SET user_id = ? 
#         WHERE cart_id = ?;
#     """, (user_id, guest_cart["cart_id"]))
#     conn.execute("""
#         UPDATE cart_audit_log
#         SET user_id = ?, guest_id = NULL
#         WHERE cart_id = ?;
#     """, (user_id, guest_cart["cart_id"]))
#     cart_repo.insert_audit_event(conn, guest_cart["cart_id"], user_id, guest_id,
#                                  "reassign", f"Guest cart {guest_cart['cart_id']} merged and reassigned to user {user_id}")

#     repository.delete_guest_cart(guest_id)
#     conn.commit()
#     conn.close()
#     return merge_result


# # ===========================================================
# # WISHLIST MERGE + AUDIT REASSIGNMENT
# # ===========================================================

# def merge_guest_wishlist_if_any(user_id, guest_id):
#     guest_wishlist = wishlist_repo.get_wishlist_by_guest(guest_id)
#     if not guest_wishlist:
#         return {"merged_items": 0}

#     user_wishlist = wishlist_repo.get_wishlist_by_user(user_id)
#     conn = get_db_connection()

#     if not user_wishlist:
#         # direct reassignment
#         conn.execute("""
#             UPDATE wishlists
#             SET user_id = ?, guest_id = NULL, status = 'active', updated_at = datetime('now')
#             WHERE wishlist_id = ?;
#         """, (user_id, guest_wishlist["wishlist_id"]))
#         wishlist_repo.log_audit("merge", guest_wishlist["wishlist_id"],
#                                 user_id, guest_id, message=f"Guest wishlist reassigned to user {user_id}", con=conn)
#         conn.commit()
#         conn.close()
#         return {"merged_items": 0}

#     # both exist -> merge items
#     added = wishlist_repo.merge_wishlists(guest_wishlist["wishlist_id"], user_wishlist["wishlist_id"])
#     wishlist_repo.update_wishlist_status(guest_wishlist["wishlist_id"], "merged")

#     # reassign and normalize audit ownership
#     conn.execute("""
#         UPDATE wishlist_items SET user_id = ? 
#         WHERE wishlist_id = ?;
#     """, (user_id, guest_wishlist["wishlist_id"]))
#     conn.execute("""
#         UPDATE wishlist_audit
#         SET user_id = ?, guest_id = NULL
#         WHERE wishlist_id = ?;
#     """, (user_id, guest_wishlist["wishlist_id"]))
#     wishlist_repo.log_audit("merge", guest_wishlist["wishlist_id"], user_id, guest_id,
#                             message=f"Guest wishlist {guest_wishlist['wishlist_id']} merged and reassigned to user {user_id}", con=conn)

#     conn.commit()
#     conn.close()
#     return {"merged_items": added}


# def get_user_with_profile(conn, firebase_uid):
#     user = repository.get_user_by_uid(firebase_uid)
#     if not user:
#         return None

#     # Convert sqlite3.Row to dict
#     user = dict(user)
#     profile = repository.get_user_profile(user["user_id"])
#     profile = dict(profile) if profile else {}

#     return {
#         **user,
#         "dob": profile.get("dob"),
#         "gender": profile.get("gender"),
#         "avatar_url": profile.get("avatar_url"),
#     }


# domain/users/service.py 
import logging
from domain.users import repository
from domain.cart import service as cart_service
from domain.cart import repository as cart_repo
from domain.wishlist import repository as wishlist_repo
from db import transaction

# ===========================================================
# USER SERVICE (Business Logic Layer)
# ===========================================================

def upsert_user_from_firebase(firebase_uid, email, name):
    """
    Ensure a user exists for the given Firebase UID.
    Updates last_login and returns the record.
    """
    try:
        user = repository.get_user_by_uid(firebase_uid)
        if user:
            repository.update_user_last_login(user["user_id"])
            return user

        if email:
            existing = repository.get_user_by_email(email)
            if existing:
                # Link existing user if email already exists
                repository.link_firebase_uid(existing["user_id"], firebase_uid)
                repository.update_user_last_login(existing["user_id"])
                return existing

        new_user = repository.insert_user(firebase_uid, email, name)
        if not new_user:
            logging.error(f"User insert failed for {email}")
            return None

        repository.update_user_last_login(new_user["user_id"])
        logging.info(f"Created new user {email}")
        return new_user

    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            logging.warning(f"Duplicate user insert attempt for {email}, fetching existing record.")
            existing = repository.get_user_by_email(email)
            if existing:
                repository.update_user_last_login(existing["user_id"])
                return existing
        logging.exception(f"upsert_user_from_firebase failed for {email}")
        return None


def ensure_user_profile(user_id):
    """Guarantee that a user profile exists and return it."""
    try:
        repository.insert_user_profile(user_id)
    except Exception:
        # ignore constraint errors (already exists)
        pass
    return repository.get_user_profile(user_id)


def update_profile(conn, firebase_uid, updates):
    """Update user and profile fields by firebase_uid."""
    user = repository.get_user_by_uid(firebase_uid)
    if not user:
        return None

    allowed = {"name", "dob", "gender", "avatar_url"}
    fields = {k: v for k, v in updates.items() if k in allowed}

    if not fields:
        return repository.get_user_profile(user["user_id"])

    # name lives in users table, others in profile
    if "name" in fields:
        from db import execute
        execute(
            "UPDATE users SET name = ?, updated_at = datetime('now') WHERE user_id = ?",
            (fields["name"], user["user_id"]),
        )
        del fields["name"]

    if fields:
        repository.update_user_profile(user["user_id"], fields)

    merged = repository.get_user_profile(user["user_id"]) or {}
    return {**user, **merged}


# ===========================================================
# CORE LOGIN → MERGE LOGIC (Atomic and Commit-Safe)
# ===========================================================
def ensure_user_with_merge(conn, firebase_uid, email, name, avatar_url, guest_id, update_last_login=True):
    """
    Called on user login. Guarantees user record, profile,
    and merges any guest cart/wishlist into the user's account.
    Entire block executes atomically.
    """
    try:
        with transaction():
            user = upsert_user_from_firebase(firebase_uid, email, name)
            if not user:
                logging.error("User creation failed; aborting merge.")
                return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}

            user_id = user["user_id"]
            ensure_user_profile(user_id)

            merge_result = {"cart": {"status": "none"}, "wishlist": {"status": "none"}}

            # Skip redundant merges if no guest_id or same-session merge already done
            if guest_id:
                merge_result["cart"] = merge_guest_cart_if_any(conn, user_id, guest_id)
                merge_result["wishlist"] = merge_guest_wishlist_if_any(conn, user_id, guest_id)

            if update_last_login:
                repository.update_user_last_login(user_id)

        return user, merge_result

    except Exception as e:
        logging.exception(f"ensure_user_with_merge failed: {e}")
        return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}


# ===========================================================
# CART MERGE + AUDIT REASSIGNMENT
# ===========================================================
def merge_guest_cart_if_any(conn, user_id, guest_id):
    guest_cart = repository.find_guest_cart(guest_id)
    if not guest_cart:
        return {"merged_items": 0, "status": "none"}

    user_cart = repository.find_user_cart(user_id)
    if not user_cart:
        repository.assign_cart_to_user(guest_cart["cart_id"], user_id)
        cart_repo.insert_audit_event(
            conn, guest_cart["cart_id"], user_id, guest_id,
            "reassign", f"Guest cart reassigned to user {user_id}"
        )
        logging.info(f"Guest cart {guest_cart['cart_id']} reassigned to user {user_id}")
        return {"merged_items": 0, "status": "reassigned"}

    # Prevent duplicate merges
    if cart_repo.is_cart_already_merged(guest_cart["cart_id"]):
        logging.info(f"Guest cart {guest_cart['cart_id']} already merged; skipping.")
        return {"merged_items": 0, "status": "skipped"}

    merge_result = cart_service.merge_guest_into_user(user_id, guest_id)
    cart_repo.mark_cart_merged(conn, guest_cart["cart_id"])

    conn.execute(
        "UPDATE cart_items SET user_id = ? WHERE cart_id = ?;",
        (user_id, guest_cart["cart_id"])
    )
    conn.execute(
        "UPDATE cart_audit_log SET user_id = ?, guest_id = NULL WHERE cart_id = ?;",
        (user_id, guest_cart["cart_id"])
    )
    cart_repo.insert_audit_event(
        conn, guest_cart["cart_id"], user_id, guest_id,
        "merge", f"Guest cart {guest_cart['cart_id']} merged into user {user_id}"
    )
    logging.info(f"Merged guest cart {guest_cart['cart_id']} into user {user_id}")

    return {
        "merged_items": int(merge_result.get("added", 0)) + int(merge_result.get("updated", 0)),
        "status": "merged",
        **merge_result,
    }


# ===========================================================
# WISHLIST MERGE + AUDIT REASSIGNMENT
# ===========================================================
def merge_guest_wishlist_if_any(conn, user_id, guest_id):
    guest_wishlist = wishlist_repo.get_wishlist_by_guest(guest_id)
    if not guest_wishlist:
        return {"merged_items": 0, "status": "none"}

    user_wishlist = wishlist_repo.get_wishlist_by_user(user_id)
    if not user_wishlist:
        conn.execute(
            """
            UPDATE wishlists
               SET user_id = ?, guest_id = NULL, status = 'active', updated_at = datetime('now')
             WHERE wishlist_id = ?;
            """,
            (user_id, guest_wishlist["wishlist_id"]),
        )
        wishlist_repo.log_audit(
            "reassign",
            guest_wishlist["wishlist_id"],
            user_id,
            guest_id,
            message=f"Guest wishlist reassigned to user {user_id}",
            con=conn,
        )
        logging.info(f"Guest wishlist {guest_wishlist['wishlist_id']} reassigned to user {user_id}")
        return {"merged_items": 0, "status": "reassigned"}

    # Prevent duplicate merges
    if wishlist_repo.is_wishlist_already_merged(guest_wishlist["wishlist_id"]):
        logging.info(f"Guest wishlist {guest_wishlist['wishlist_id']} already merged; skipping.")
        return {"merged_items": 0, "status": "skipped"}

    added = wishlist_repo.merge_wishlists(
        guest_wishlist["wishlist_id"], user_wishlist["wishlist_id"]
    )
    wishlist_repo.update_wishlist_status(guest_wishlist["wishlist_id"], "merged")

    conn.execute(
        "UPDATE wishlist_items SET user_id = ? WHERE wishlist_id = ?;",
        (user_id, guest_wishlist["wishlist_id"])
    )
    conn.execute(
        "UPDATE wishlist_audit SET user_id = ?, guest_id = NULL WHERE wishlist_id = ?;",
        (user_id, guest_wishlist["wishlist_id"])
    )
    wishlist_repo.log_audit(
        "merge",
        guest_wishlist["wishlist_id"],
        user_id,
        guest_id,
        message=f"Guest wishlist {guest_wishlist['wishlist_id']} merged into user {user_id}",
        con=conn,
    )
    logging.info(f"Merged guest wishlist {guest_wishlist['wishlist_id']} into user {user_id}")

    return {"merged_items": int(added or 0), "status": "merged"}


# ===========================================================
# PROFILE FETCH
# ===========================================================
def get_user_with_profile(conn, firebase_uid):
    """Return user merged with profile attributes."""
    user = repository.get_user_by_uid(firebase_uid)
    if not user:
        return None

    profile = repository.get_user_profile(user["user_id"]) or {}
    return {**user, **profile}
