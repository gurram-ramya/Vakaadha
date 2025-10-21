# domain/users/service.py
import logging
from datetime import datetime
from domain.users import repository
from domain.cart import service as cart_service
from domain.wishlist import service as wishlist_service


# ===========================================================
# USER SERVICE (Business Logic Layer)
# ===========================================================

def upsert_user_from_firebase(firebase_uid, email, name):
    user = repository.get_user_by_uid(firebase_uid)
    if user:
        repository.update_user_last_login(user["user_id"])
        return user

    # user doesn't exist, try by email to link existing record
    if email:
        existing = repository.get_user_by_email(email)
        if existing:
            logging.info(f"Linking existing user {email} with Firebase UID")
            repository.update_user_last_login(existing["user_id"])
            return existing

    repository.insert_user(firebase_uid, email, name)
    new_user = repository.get_user_by_uid(firebase_uid)
    logging.info(f"Created new user {email}")
    return new_user


def ensure_user_profile(user_id):
    repository.insert_user_profile(user_id)
    return repository.get_user_profile(user_id)


def update_profile(user_id, updates):
    allowed = {"dob", "gender", "avatar_url"}
    fields = {k: v for k, v in updates.items() if k in allowed}
    repository.update_user_profile(user_id, fields)
    return repository.get_user_profile(user_id)


# def ensure_user_with_merge(conn, firebase_uid, email, name, avatar_url, guest_id, update_last_login=True):
#     user = upsert_user_from_firebase(firebase_uid, email, name)
#     user_id = user["user_id"]

#     # create profile if missing
#     ensure_user_profile(user_id)

#     # ensure user cart exists
#     cart_service.ensure_user_cart(user_id)

#     # merge guest cart if any
#     merge_result = None
#     if guest_id:
#         merge_result = merge_guest_cart_if_any(user_id, guest_id)

#     if update_last_login:
#         repository.update_user_last_login(user_id)

#     return user, merge_result

def ensure_user_with_merge(conn, firebase_uid, email, name, avatar_url, guest_id, update_last_login=True):
    user = upsert_user_from_firebase(firebase_uid, email, name)
    user_id = user["user_id"]

    # create profile if missing
    ensure_user_profile(user_id)

    # ensure user cart exists
    cart_service.ensure_user_cart(user_id)

    # merge guest cart and wishlist
    merge_result = {"cart": None, "wishlist": None}
    if guest_id:
        # Merge cart first (atomic)
        merge_result["cart"] = merge_guest_cart_if_any(user_id, guest_id)
        
        # Merge wishlist next (separate transaction)
        from domain.wishlist import service as wishlist_service
        merge_result["wishlist"] = wishlist_service.merge_guest_wishlist(user_id, guest_id)

    if update_last_login:
        repository.update_user_last_login(user_id)

    return user, merge_result


def merge_guest_cart_if_any(user_id, guest_id):
    guest_cart = repository.find_guest_cart(guest_id)
    if not guest_cart:
        return {"merged_items": 0}

    user_cart = repository.find_user_cart(user_id)
    if not user_cart:
        # assign guest cart directly to user
        repository.assign_cart_to_user(guest_cart["cart_id"], user_id)
        logging.info(f"Assigned guest cart to user {user_id}")
        return {"merged_items": 0}

    # both exist -> merge via cart service
    merge_result = cart_service.merge_guest_cart_if_any(user_id, guest_id)
    repository.delete_guest_cart(guest_id)
    return merge_result
