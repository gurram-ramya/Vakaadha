# # domain/payments/service.py
# import logging
# import razorpay
# import json
# from datetime import datetime

# from domain.payments import repository as payments_repo
# from domain.orders import service as orders_service
# from db import get_db_connection

# from flask import current_app


# # ============================================================
# # Payment Service — business logic layer
# # ============================================================

# def _get_razorpay_client():
#     """Initialize and return Razorpay client from config."""
#     key_id = current_app.config.get("RAZORPAY_KEY_ID")
#     key_secret = current_app.config.get("RAZORPAY_KEY_SECRET")
#     if not key_id or not key_secret:
#         raise RuntimeError("Razorpay API keys missing in configuration")
#     return razorpay.Client(auth=(key_id, key_secret))


# def create_payment_order(user_id, address_id, payment_method="UPI"):
#     """
#     Create a payment order.
#     For COD: skip Razorpay and mark payment as 'created'.
#     For online payments: create a Razorpay order and record it in DB.
#     """
#     conn = get_db_connection()
#     try:
#         # Step 1: Create internal order from cart
#         order = orders_service.create_order_from_cart(conn, user_id, address_id, payment_method)
#         order_id = order["order_id"]
#         total_amount = order["total_amount_cents"]

#         provider = "razorpay"
#         email = order.get("email")
#         contact = order.get("phone")

#         # Step 2: Handle COD separately
#         if payment_method.upper() == "COD":
#             payment = payments_repo.create_payment(
#                 conn=conn,
#                 order_id=order_id,
#                 user_id=user_id,
#                 provider=provider,
#                 amount_cents=total_amount,
#                 method="COD",
#                 email=email,
#                 contact=contact,
#             )
#             logging.info(f"[payment.service] COD order created order_id={order_id}")
#             return {
#                 "order_id": order_id,
#                 "payment_method": "COD",
#                 "payment_status": "pending",
#                 "razorpay_order_id": None,
#             }

#         # Step 3: Online Payment (Razorpay)
#         client = _get_razorpay_client()
#         razorpay_order = client.order.create({
#             "amount": total_amount,      # amount in paise
#             "currency": "INR",
#             "payment_capture": "1",
#             "notes": {
#                 "user_id": user_id,
#                 "order_id": order_id,
#             }
#         })

#         razorpay_order_id = razorpay_order.get("id")
#         payments_repo.create_payment(
#             conn=conn,
#             order_id=order_id,
#             user_id=user_id,
#             provider=provider,
#             amount_cents=total_amount,
#             method=payment_method,
#             razorpay_order_id=razorpay_order_id,
#             email=email,
#             contact=contact,
#         )

#         logging.info(f"[payment.service] Razorpay order created: {razorpay_order_id}")
#         return {
#             "order_id": order_id,
#             "razorpay_order_id": razorpay_order_id,
#             "amount": total_amount,
#             "currency": "INR",
#             "key_id": current_app.config.get("RAZORPAY_KEY_ID"),
#         }

#     except Exception as e:
#         logging.exception("Failed to create payment order")
#         raise
#     finally:
#         conn.close()


# def verify_payment(razorpay_order_id, razorpay_payment_id, razorpay_signature):
#     """
#     Verify Razorpay payment signature and update payment + order status.
#     """
#     conn = get_db_connection()
#     try:
#         client = _get_razorpay_client()
#         params_dict = {
#             "razorpay_order_id": razorpay_order_id,
#             "razorpay_payment_id": razorpay_payment_id,
#             "razorpay_signature": razorpay_signature,
#         }

#         # Step 1: Verify the signature
#         try:
#             client.utility.verify_payment_signature(params_dict)
#             verified = True
#         except razorpay.errors.SignatureVerificationError:
#             verified = False

#         # Step 2: Update payment record
#         if verified:
#             payments_repo.update_payment_status(
#                 conn=conn,
#                 razorpay_order_id=razorpay_order_id,
#                 status="captured",
#                 razorpay_payment_id=razorpay_payment_id,
#                 signature=razorpay_signature,
#                 raw_response=json.dumps(params_dict),
#             )

#             # Get order_id from payment record
#             payment = payments_repo.get_payment_by_razorpay_order_id(conn, razorpay_order_id)
#             if payment:
#                 orders_service.update_payment_status(conn, payment["order_id"], "paid")
#                 orders_service.update_order_status(conn, payment["order_id"], "confirmed")

#             logging.info(f"[payment.service] Payment verified and captured for {razorpay_order_id}")
#             return {"status": "success", "message": "Payment verified successfully"}
#         else:
#             payments_repo.update_payment_status(conn, razorpay_order_id, status="failed")
#             logging.warning(f"[payment.service] Payment verification failed for {razorpay_order_id}")
#             return {"status": "failed", "message": "Invalid payment signature"}

#     except Exception as e:
#         logging.exception("Error verifying payment")
#         raise
#     finally:
#         conn.close()

import logging
import razorpay
import json

from domain.payments import repository as payments_repo
from domain.orders import service as orders_service
from db import get_db_connection

from flask import current_app


# ============================================================
# Payment Service — business logic layer
# ============================================================

def _get_razorpay_client():
    """Initialize and return Razorpay client from config."""
    key_id = current_app.config.get("RAZORPAY_KEY_ID")
    key_secret = current_app.config.get("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise RuntimeError("Razorpay API keys missing in configuration")
    return razorpay.Client(auth=(key_id, key_secret))


# ============================================================
# Create Payment Order (both COD + Razorpay)
# ============================================================

def create_payment_order(user_id, address_id, payment_method="UPI"):
    """
    Create a payment order.
    - Creates internal ecommerce order FIRST.
    - If COD → no Razorpay involved.
    - If Online → generates Razorpay order_id and saves payment row.
    """
    conn = get_db_connection()
    try:
        # Step 1: Create internal order
        order = orders_service.create_order_from_cart(conn, user_id, address_id, payment_method)
        order_id = order["order_id"]
        total_amount = order["total_amount_cents"]

        provider = "razorpay"
        email = order.get("email")
        contact = order.get("phone")

        # Step 2: COD — simple pending payment
        if payment_method.upper() == "COD":
            payments_repo.create_payment(
                conn=conn,
                order_id=order_id,
                user_id=user_id,
                provider=provider,
                amount_cents=total_amount,
                method="COD",
                email=email,
                contact=contact
            )

            logging.info(f"[payment.service] COD order created order_id={order_id}")

            return {
                "order_id": order_id,
                "payment_method": "COD",
                "payment_status": "pending",
                "razorpay_order_id": None,
            }

        # Step 3: Online payment — create Razorpay order
        client = _get_razorpay_client()

        razorpay_order = client.order.create({
            "amount": total_amount,
            "currency": "INR",
            "payment_capture": "1",
            "notes": {
                "user_id": user_id,
                "order_id": order_id,
            }
        })

        razorpay_order_id = razorpay_order.get("id")

        # Create payment DB record
        payments_repo.create_payment(
            conn=conn,
            order_id=order_id,
            user_id=user_id,
            provider=provider,
            amount_cents=total_amount,
            method=payment_method,
            razorpay_order_id=razorpay_order_id,
            email=email,
            contact=contact
        )

        logging.info(f"[payment.service] Razorpay order created: {razorpay_order_id}")

        return {
            "order_id": order_id,
            "razorpay_order_id": razorpay_order_id,
            "amount": total_amount,
            "currency": "INR",
            "key_id": current_app.config.get("RAZORPAY_KEY_ID"),
        }

    except Exception as e:
        logging.exception("Failed to create payment order")
        raise
    finally:
        conn.close()


# ============================================================
# Verify Razorpay Signature
# ============================================================

def verify_payment(razorpay_order_id, razorpay_payment_id, razorpay_signature):
    """
    Verify Razorpay payment and update:
    - payment.status
    - order.payment_status
    - order.order_status

    REQUIRED for:
    Case 1 → Success
    Case 2 → Failure (with order_id returned)
    """
    conn = get_db_connection()
    try:
        client = _get_razorpay_client()

        params_dict = {
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        }

        # Step 1: Verify signature
        try:
            client.utility.verify_payment_signature(params_dict)
            verified = True
        except razorpay.errors.SignatureVerificationError:
            verified = False

        # Step 2: Fetch payment row (we need order_id)
        payment_row = payments_repo.get_payment_by_razorpay_order_id(conn, razorpay_order_id)

        if not payment_row:
            logging.error(f"[payment.service] No payment found for razorpay_order_id={razorpay_order_id}")
            return {
                "status": "error",
                "message": "No matching payment record",
                "order_id": None
            }

        order_id = payment_row["order_id"]

        # ============================================================
        # SUCCESS CASE
        # ============================================================
        if verified:
            payments_repo.update_payment_status(
                conn=conn,
                razorpay_order_id=razorpay_order_id,
                status="captured",
                razorpay_payment_id=razorpay_payment_id,
                signature=razorpay_signature,
                raw_response=json.dumps(params_dict),
            )

            orders_service.update_payment_status(conn, order_id, "paid")
            orders_service.update_order_status(conn, order_id, "confirmed")

            logging.info(f"[payment.service] Payment verified and captured order_id={order_id}")

            return {
                "status": "success",
                "message": "Payment verified",
                "order_id": order_id
            }

        # ============================================================
        # FAILURE CASE
        # ============================================================
        else:
            # Update payment status
            payments_repo.update_payment_status(conn, razorpay_order_id, status="failed")

            # Update order as failed so user can retry
            orders_service.update_payment_status(conn, order_id, "failed")
            orders_service.update_order_status(conn, order_id, "pending")

            logging.warning(f"[payment.service] Payment verification FAILED for order_id={order_id}")

            return {
                "status": "failed",
                "message": "Invalid payment signature",
                "order_id": order_id
            }

    except Exception as e:
        logging.exception("Error verifying payment")
        raise
    finally:
        conn.close()


# ============================================================
# Abandoned Checkout Cleanup (Case 3)
# ============================================================

def delete_payment_for_order(order_id):
    """
    Delete payment record when user leaves checkout without attempting payment.
    """
    conn = get_db_connection()
    try:
        payments_repo.delete_payment_by_order(conn, order_id)
        return True
    except Exception:
        return False
    finally:
        conn.close()


# ============================================================
# Cancel Payment (Case 4)
# ============================================================

def cancel_payment(order_id):
    """
    Mark payment + order as cancelled when user cancels after failure or retry.
    """
    conn = get_db_connection()
    try:
        payments_repo.update_payment_status_by_order(conn, order_id, "cancelled")
        orders_service.update_payment_status(conn, order_id, "cancelled")
        orders_service.update_order_status(conn, order_id, "cancelled")
        return True
    except Exception:
        logging.exception("Failed to cancel payment")
        return False
    finally:
        conn.close()
