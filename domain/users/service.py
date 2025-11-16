# # domain/users/service.py 
# import logging
# from domain.users import repository
# from domain.cart import service as cart_service
# from domain.wishlist import service as wishlist_service
# from domain.cart import repository as cart_repo
# from domain.wishlist import repository as wishlist_repo
# from db import transaction
# from db import get_db_connection

# # ===========================================================
# # USER SERVICE (Business Logic Layer)
# # ===========================================================

# # domain/users/service.py
# def upsert_user_from_firebase(firebase_uid, email, name, conn=None):
#     """
#     Ensure a user exists for the given Firebase UID.
#     Uses provided connection if available to stay within transaction.
#     Safely handles duplicates via UPSERT on email.
#     """
#     c = conn or get_db_connection()
#     internal = conn is None

#     try:
#         # Check existing by Firebase UID first
#         user = repository.get_user_by_uid(firebase_uid)
#         if user:
#             if conn:
#                 c.execute("UPDATE users SET last_login = datetime('now') WHERE user_id = ?", (user["user_id"],))
#             else:
#                 repository.update_user_last_login(user["user_id"])
#             return user

#         # Perform UPSERT by email
#         cur = c.execute(
#             """
#             INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
#             VALUES (?, ?, ?, datetime('now'), datetime('now'))
#             ON CONFLICT(email) DO UPDATE
#                 SET firebase_uid = excluded.firebase_uid,
#                     name = excluded.name,
#                     updated_at = datetime('now');
#             """,
#             (firebase_uid, email, name),
#         )

#         # Resolve user_id
#         row = c.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
#         if not row:
#             raise RuntimeError("User insert or update failed unexpectedly")

#         user_id = row["user_id"]

#         # Update last_login atomically
#         c.execute("UPDATE users SET last_login = datetime('now') WHERE user_id = ?", (user_id,))

#         if internal:
#             c.commit()

#         return dict(row)

#     except Exception as e:
#         logging.exception(f"upsert_user_from_firebase failed for {email}: {e}")
#         if internal:
#             c.rollback()
#         return None

#     finally:
#         if internal:
#             c.close()





# # def ensure_user_profile(user_id):
# #     """Guarantee that a user profile exists and return it."""
# #     try:
# #         repository.insert_user_profile(user_id)
# #     except Exception:
# #         # ignore constraint errors (already exists)
# #         pass
# #     return repository.get_user_profile(user_id)

# def ensure_user_profile(user_id, conn=None):
#     """
#     Guarantee that a user profile exists for this user.
#     Uses provided connection if available; otherwise opens its own.
#     """
#     # from db import get_db_connection
#     internal_conn = False
#     if conn is None:
#         conn = get_db_connection()
#         internal_conn = True

#     try:
#         row = conn.execute(
#             "SELECT profile_id FROM user_profiles WHERE user_id = ?;",
#             (user_id,),
#         ).fetchone()
#         if row:
#             if internal_conn:
#                 conn.close()
#             return repository.get_user_profile(user_id)

#         conn.execute(
#             """
#             INSERT INTO user_profiles (user_id, dob, gender, avatar_url)
#             VALUES (?, NULL, NULL, NULL);
#             """,
#             (user_id,),
#         )

#         if internal_conn:
#             conn.commit()
#             conn.close()

#         return repository.get_user_profile(user_id)

#     except Exception as e:
#         if internal_conn:
#             conn.rollback()
#             conn.close()
#         raise e



# def update_profile(conn, firebase_uid, updates):
#     """Update user and profile fields by firebase_uid."""
#     user = repository.get_user_by_uid(firebase_uid)
#     if not user:
#         return None

#     allowed = {"name", "dob", "gender", "avatar_url"}
#     fields = {k: v for k, v in updates.items() if k in allowed}

#     if not fields:
#         return repository.get_user_profile(user["user_id"])

#     # name lives in users table, others in profile
#     if "name" in fields:
#         from db import execute
#         execute(
#             "UPDATE users SET name = ?, updated_at = datetime('now') WHERE user_id = ?",
#             (fields["name"], user["user_id"]),
#         )
#         del fields["name"]

#     if fields:
#         repository.update_user_profile(user["user_id"], fields)

#     merged = repository.get_user_profile(user["user_id"]) or {}
#     return {**user, **merged}


# # ===========================================================
# # CORE LOGIN → MERGE LOGIC (Atomic and Commit-Safe)
# # ===========================================================
# # def ensure_user_with_merge(conn, firebase_uid, email, name, avatar_url, guest_id, update_last_login=True):
# #     """
# #     Called on user login. Guarantees user record, profile,
# #     and merges any guest cart/wishlist into the user's account.
# #     Entire block executes atomically.
# #     """
# #     try:
# #         with transaction():
# #             user = upsert_user_from_firebase(firebase_uid, email, name)
# #             if not user:
# #                 logging.error("User creation failed; aborting merge.")
# #                 return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}

# #             user_id = user["user_id"]
# #             ensure_user_profile(user_id)

# #             merge_result = {"cart": {"status": "none"}, "wishlist": {"status": "none"}}

# #             # Skip redundant merges if no guest_id or same-session merge already done
# #             if guest_id:
# #                 merge_result["cart"] = merge_guest_cart_if_any(conn, user_id, guest_id)
# #                 merge_result["wishlist"] = merge_guest_wishlist_if_any(conn, user_id, guest_id)

# #             if update_last_login:
# #                 repository.update_user_last_login(user_id)

# #         return user, merge_result

# #     except Exception as e:
# #         logging.exception(f"ensure_user_with_merge failed: {e}")
# #         return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}

# # ===========================================================
# # CORE LOGIN → MERGE LOGIC (FIXED CONNECTION + ATOMIC MERGE)
# # ===========================================================


# def ensure_user_with_merge(conn, firebase_uid, email, name, avatar_url, guest_id, update_last_login=True):
#     """
#     Guarantees user record, profile, and merges guest data atomically.
#     Simplified: removes audit merge, conflict reconciliation, and legacy merge tracking.
#     Runs both cart and wishlist merges in the same transaction context.
#     """

#     if conn is None:
#         conn = get_db_connection()

#     try:
#         with transaction() as tx:
#             # Step 1: ensure user exists
#             user = upsert_user_from_firebase(firebase_uid, email, name, conn=tx)
#             if not user:
#                 logging.error("User creation failed; aborting merge.")
#                 return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}

#             user_id = user["user_id"]
#             ensure_user_profile(user_id, conn=tx)

#             merge_result = {"cart": {"status": "none"}, "wishlist": {"status": "none"}}

#             # Step 2: run simplified guest→user merges
#             if guest_id:

#                 try:
#                     merge_result["cart"] = cart_service.merge_guest_cart_into_user(tx, user_id, guest_id)
#                 except Exception as e:
#                     logging.warning(f"Cart merge failed: {e}")
#                     merge_result["cart"] = {"status": "error"}

#                 try:
#                     merge_result["wishlist"] = wishlist_service.merge_guest_wishlist_into_user(tx, user_id, guest_id)
#                 except Exception as e:
#                     logging.warning(f"Wishlist merge failed: {e}")
#                     merge_result["wishlist"] = {"status": "error"}

#             # Step 3: update login timestamp
#             if update_last_login:
#                 repository.update_user_last_login(user_id)

#         # Step 4: return consolidated result
#         return user, merge_result

#     except Exception as e:
#         logging.exception(f"ensure_user_with_merge failed: {e}")
#         return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}


# # ===========================================================
# # CART MERGE + AUDIT REASSIGNMENT
# # ===========================================================
# def merge_guest_cart_if_any(conn, user_id, guest_id):
#     guest_cart = repository.find_guest_cart(guest_id)
#     if not guest_cart:
#         return {"merged_items": 0, "status": "none"}

#     user_cart = repository.find_user_cart(user_id)
#     if not user_cart:
#         repository.assign_cart_to_user(guest_cart["cart_id"], user_id)
#         cart_repo.insert_audit_event(
#             conn, guest_cart["cart_id"], user_id, guest_id,
#             "update", f"Guest cart reassigned to user {user_id}"
#         )
#         logging.info(f"Guest cart {guest_cart['cart_id']} reassigned to user {user_id}")
#         return {"merged_items": 0, "status": "reassigned"}

#     # Prevent duplicate merges
#     if cart_repo.is_cart_already_merged(guest_cart["cart_id"]):
#         logging.info(f"Guest cart {guest_cart['cart_id']} already merged; skipping.")
#         return {"merged_items": 0, "status": "skipped"}

#     merge_result = cart_service.merge_guest_into_user(user_id, guest_id)
#     # cart_repo.mark_cart_merged(conn, guest_cart["cart_id"])

#     conn.execute(
#         "UPDATE cart_items SET user_id = ? WHERE cart_id = ?;",
#         (user_id, guest_cart["cart_id"])
#     )
#     conn.execute(
#         "UPDATE cart_audit_log SET user_id = ?, guest_id = NULL WHERE cart_id = ?;",
#         (user_id, guest_cart["cart_id"])
#     )
#     cart_repo.insert_audit_event(
#         conn, guest_cart["cart_id"], user_id, guest_id,
#         "merge", f"Guest cart {guest_cart['cart_id']} merged into user {user_id}"
#     )
#     logging.info(f"Merged guest cart {guest_cart['cart_id']} into user {user_id}")

#     return {
#         "merged_items": int(merge_result.get("added", 0)) + int(merge_result.get("updated", 0)),
#         "status": "merged",
#         **merge_result,
#     }


# # ===========================================================
# # WISHLIST MERGE + AUDIT REASSIGNMENT
# # ===========================================================
# def merge_guest_wishlist_if_any(conn, user_id, guest_id):
#     guest_wishlist = wishlist_repo.get_wishlist_by_guest(guest_id)
#     if not guest_wishlist:
#         return {"merged_items": 0, "status": "none"}

#     user_wishlist = wishlist_repo.get_wishlist_by_user(user_id)
#     if not user_wishlist:
#         conn.execute(
#             """
#             UPDATE wishlists
#                SET user_id = ?, guest_id = NULL, status = 'active', updated_at = datetime('now')
#              WHERE wishlist_id = ?;
#             """,
#             (user_id, guest_wishlist["wishlist_id"]),
#         )
#         wishlist_repo.log_audit(
#             "update",
#             guest_wishlist["wishlist_id"],
#             user_id,
#             guest_id,
#             message=f"Guest wishlist reassigned to user {user_id}",
#             con=conn,
#         )
#         logging.info(f"Guest wishlist {guest_wishlist['wishlist_id']} reassigned to user {user_id}")
#         return {"merged_items": 0, "status": "reassigned"}

#     # Prevent duplicate merges
#     if wishlist_repo.is_wishlist_already_merged(guest_wishlist["wishlist_id"]):
#         logging.info(f"Guest wishlist {guest_wishlist['wishlist_id']} already merged; skipping.")
#         return {"merged_items": 0, "status": "skipped"}

#     added = wishlist_repo.merge_wishlists(
#         guest_wishlist["wishlist_id"], user_wishlist["wishlist_id"]
#     )
#     wishlist_repo.update_wishlist_status(guest_wishlist["wishlist_id"], "merged")

#     conn.execute(
#         "UPDATE wishlist_items SET user_id = ? WHERE wishlist_id = ?;",
#         (user_id, guest_wishlist["wishlist_id"])
#     )
#     conn.execute(
#         "UPDATE wishlist_audit SET user_id = ?, guest_id = NULL WHERE wishlist_id = ?;",
#         (user_id, guest_wishlist["wishlist_id"])
#     )
#     wishlist_repo.log_audit(
#         "merge",
#         guest_wishlist["wishlist_id"],
#         user_id,
#         guest_id,
#         message=f"Guest wishlist {guest_wishlist['wishlist_id']} merged into user {user_id}",
#         con=conn,
#     )
#     logging.info(f"Merged guest wishlist {guest_wishlist['wishlist_id']} into user {user_id}")

#     return {"merged_items": int(added or 0), "status": "merged"}


# # ===========================================================
# # PROFILE FETCH
# # ===========================================================
# def get_user_with_profile(conn, firebase_uid):
#     """Return user merged with profile attributes."""
#     user = repository.get_user_by_uid(firebase_uid)
#     if not user:
#         return None

#     profile = repository.get_user_profile(user["user_id"]) or {}
#     return {**user, **profile}


# ------------- pgsql ---------------------------

# domain/users/service.py
import logging
from domain.users import repository
from domain.cart import service as cart_service
from domain.wishlist import service as wishlist_service
from domain.cart import repository as cart_repo
from domain.wishlist import repository as wishlist_repo
from db import transaction, get_db_connection


def upsert_user_from_firebase(firebase_uid, email, name, conn=None):
    internal = conn is None
    if internal:
        db = get_db_connection()
        with db.cursor() as cur:
            try:
                user = repository.get_user_by_uid(firebase_uid)
                if user:
                    cur.execute(
                        "UPDATE users SET last_login = NOW() WHERE user_id = %s",
                        (user["user_id"],)
                    )
                    db.commit()
                    return user

                cur.execute(
                    """
                    INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
                    VALUES (%s, %s, %s, NOW(), NOW())
                    ON CONFLICT(email) DO UPDATE
                    SET firebase_uid = EXCLUDED.firebase_uid,
                        name = EXCLUDED.name,
                        updated_at = NOW()
                    RETURNING user_id, firebase_uid, email, name;
                    """,
                    (firebase_uid, email, name),
                )
                user = cur.fetchone()

                cur.execute(
                    "UPDATE users SET last_login = NOW() WHERE user_id = %s",
                    (user["user_id"],)
                )

                db.commit()
                return user

            except Exception as e:
                logging.exception(f"upsert_user_from_firebase failed for {email}: {e}")
                try:
                    db.rollback()
                except Exception:
                    pass
                return None

    else:
        cur = conn
        try:
            user = repository.get_user_by_uid(firebase_uid)
            if user:
                cur.execute(
                    "UPDATE users SET last_login = NOW() WHERE user_id = %s",
                    (user["user_id"],)
                )
                return user

            cur.execute(
                """
                INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
                VALUES (%s, %s, %s, NOW(), NOW())
                ON CONFLICT(email) DO UPDATE
                SET firebase_uid = EXCLUDED.firebase_uid,
                    name = EXCLUDED.name,
                    updated_at = NOW()
                RETURNING user_id, firebase_uid, email, name;
                """,
                (firebase_uid, email, name),
            )
            user = cur.fetchone()

            cur.execute(
                "UPDATE users SET last_login = NOW() WHERE user_id = %s",
                (user["user_id"],)
            )
            return user
        except Exception as e:
            logging.exception(f"upsert_user_from_firebase failed for {email}: {e}")
            return None


def ensure_user_profile(user_id, conn=None):
    internal = conn is None
    if internal:
        db = get_db_connection()
        with db.cursor() as cur:
            try:
                cur.execute(
                    "SELECT profile_id FROM user_profiles WHERE user_id = %s",
                    (user_id,)
                )
                row = cur.fetchone()

                if row:
                    return repository.get_user_profile(user_id)

                cur.execute(
                    """
                    INSERT INTO user_profiles
                        (user_id, dob, gender, avatar_url, created_at, updated_at)
                    VALUES (%s, NULL, NULL, NULL, NOW(), NOW())
                    """,
                    (user_id,),
                )
                db.commit()
                return repository.get_user_profile(user_id)
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
                raise

    else:
        cur = conn
        cur.execute(
            "SELECT profile_id FROM user_profiles WHERE user_id = %s",
            (user_id,)
        )
        row = cur.fetchone()

        if row:
            return repository.get_user_profile(user_id)

        cur.execute(
            """
            INSERT INTO user_profiles
                (user_id, dob, gender, avatar_url, created_at, updated_at)
            VALUES (%s, NULL, NULL, NULL, NOW(), NOW())
            """,
            (user_id,),
        )
        return repository.get_user_profile(user_id)


def update_profile(conn, firebase_uid, updates):
    user = repository.get_user_by_uid(firebase_uid)
    if not user:
        return None

    allowed = {"name", "dob", "gender", "avatar_url"}
    fields = {k: v for k, v in updates.items() if k in allowed}
    if not fields:
        return repository.get_user_profile(user["user_id"])

    if "name" in fields:
        conn.execute(
            "UPDATE users SET name = %s, updated_at = NOW() WHERE user_id = %s",
            (fields["name"], user["user_id"])
        )
        del fields["name"]

    if fields:
        repository.update_user_profile(user["user_id"], fields)

    profile = repository.get_user_profile(user["user_id"]) or {}
    return {**user, **profile}


def ensure_user_with_merge(conn, firebase_uid, email, name, avatar_url, guest_id, update_last_login=True):
    internal = conn is None
    if internal:
        try:
            with transaction() as tx:
                user = upsert_user_from_firebase(firebase_uid, email, name, conn=tx)
                if not user:
                    return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}

                user_id = user["user_id"]
                ensure_user_profile(user_id, conn=tx)

                result = {"cart": {"status": "none"}, "wishlist": {"status": "none"}}

                if guest_id:
                    try:
                        result["cart"] = cart_service.merge_guest_cart_into_user(tx, user_id, guest_id)
                    except Exception:
                        result["cart"] = {"status": "error"}

                    try:
                        result["wishlist"] = wishlist_service.merge_guest_wishlist_into_user(tx, user_id, guest_id)
                    except Exception:
                        result["wishlist"] = {"status": "error"}

                if update_last_login:
                    repository.update_user_last_login(user_id)

            return user, result
        except Exception as e:
            logging.exception(f"ensure_user_with_merge failed: {e}")
            return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}

    else:
        try:
            user = upsert_user_from_firebase(firebase_uid, email, name, conn=conn)
            if not user:
                return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}

            user_id = user["user_id"]
            ensure_user_profile(user_id, conn=conn)

            result = {"cart": {"status": "none"}, "wishlist": {"status": "none"}}

            if guest_id:
                try:
                    result["cart"] = cart_service.merge_guest_cart_into_user(conn, user_id, guest_id)
                except Exception:
                    result["cart"] = {"status": "error"}

                try:
                    result["wishlist"] = wishlist_service.merge_guest_wishlist_into_user(conn, user_id, guest_id)
                except Exception:
                    result["wishlist"] = {"status": "error"}

            if update_last_login:
                repository.update_user_last_login(user_id)

            return user, result

        except Exception as e:
            logging.exception(f"ensure_user_with_merge failed: {e}")
            return None, {"cart": {"status": "error"}, "wishlist": {"status": "error"}}


def merge_guest_cart_if_any(conn, user_id, guest_id):
    guest_cart = repository.find_guest_cart(guest_id)
    if not guest_cart:
        return {"merged_items": 0, "status": "none"}

    user_cart = repository.find_user_cart(user_id)
    if not user_cart:
        repository.assign_cart_to_user(guest_cart["cart_id"], user_id)
        try:
            cart_repo.insert_audit_event(
                conn, guest_cart["cart_id"], user_id, guest_id,
                "update", f"Guest cart reassigned to user {user_id}"
            )
        except Exception:
            pass
        return {"merged_items": 0, "status": "reassigned"}

    if cart_repo.is_cart_already_merged(guest_cart["cart_id"]):
        return {"merged_items": 0, "status": "skipped"}

    merge_result = cart_service.merge_guest_into_user(user_id, guest_id)

    conn.execute(
        "UPDATE cart_items SET user_id = %s WHERE cart_id = %s",
        (user_id, guest_cart["cart_id"])
    )
    try:
        conn.execute(
            "UPDATE cart_audit_log SET user_id = %s, guest_id = NULL WHERE cart_id = %s",
            (user_id, guest_cart["cart_id"])
        )
    except Exception:
        pass

    try:
        cart_repo.insert_audit_event(
            conn, guest_cart["cart_id"], user_id, guest_id,
            "merge", f"Guest cart merged into user {user_id}"
        )
    except Exception:
        pass

    total = int(merge_result.get("added", 0)) + int(merge_result.get("updated", 0))
    return {"merged_items": total, "status": "merged", **merge_result}


def merge_guest_wishlist_if_any(conn, user_id, guest_id):
    guest_wishlist = wishlist_repo.get_wishlist_by_guest(guest_id)
    if not guest_wishlist:
        return {"merged_items": 0, "status": "none"}

    user_wishlist = wishlist_repo.get_wishlist_by_user(user_id)
    if not user_wishlist:
        conn.execute(
            """
            UPDATE wishlists
            SET user_id = %s, guest_id = NULL, status = 'active', updated_at = NOW()
            WHERE wishlist_id = %s
            """,
            (user_id, guest_wishlist["wishlist_id"]),
        )
        try:
            wishlist_repo.log_audit(
                "update", guest_wishlist["wishlist_id"], user_id, guest_id,
                message=f"Guest wishlist reassigned to user {user_id}", con=conn
            )
        except Exception:
            pass
        return {"merged_items": 0, "status": "reassigned"}

    if wishlist_repo.is_wishlist_already_merged(guest_wishlist["wishlist_id"]):
        return {"merged_items": 0, "status": "skipped"}

    added = wishlist_repo.merge_wishlists(
        guest_wishlist["wishlist_id"], user_wishlist["wishlist_id"]
    )
    wishlist_repo.update_wishlist_status(guest_wishlist["wishlist_id"], "merged")

    conn.execute(
        "UPDATE wishlist_items SET user_id = %s WHERE wishlist_id = %s",
        (user_id, guest_wishlist["wishlist_id"])
    )
    try:
        conn.execute(
            "UPDATE wishlist_audit SET user_id = %s, guest_id = NULL WHERE wishlist_id = %s",
            (user_id, guest_wishlist["wishlist_id"])
        )
    except Exception:
        pass

    try:
        wishlist_repo.log_audit(
            "merge", guest_wishlist["wishlist_id"], user_id, guest_id,
            message=f"Guest wishlist merged into user {user_id}", con=conn
        )
    except Exception:
        pass

    return {"merged_items": added or 0, "status": "merged"}


def get_user_with_profile(conn, firebase_uid):
    user = repository.get_user_by_uid(firebase_uid)
    if not user:
        return None

    profile = repository.get_user_profile(user["user_id"]) or {}
    return {**user, **profile}
