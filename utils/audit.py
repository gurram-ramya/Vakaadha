# utils/audit.py
import logging
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError
from flask import g
from db import db

# -------------------------------------------------------------
# Unified Audit Writer
# -------------------------------------------------------------

def insert_audit_event(table_name, event_type, entity_id=None, details=None, user_id=None, guest_id=None):
    """
    Standardized audit insert function for all domains.

    Args:
        table_name:  str  → 'cart_audit_log', 'wishlist_audit_log', etc.
        event_type:  str  → 'item_added', 'item_removed', 'merge_success', etc.
        entity_id:   int  → e.g., cart_id, wishlist_id, order_id.
        details:     dict → Optional JSON details for debugging or analytics.
        user_id:     int  → optional, overrides g.user
        guest_id:    str  → optional, overrides g.guest_id
    """
    try:
        uid = user_id or getattr(g, "user_id", None)
        gid = guest_id or getattr(g, "guest_id", None)

        payload = {
            "event_type": event_type,
            "entity_id": entity_id,
            "details": details or {},
            "user_id": uid,
            "guest_id": gid,
            "created_at": datetime.utcnow(),
        }

        db.session.execute(
            f"""
            INSERT INTO {table_name}
                (event_type, entity_id, details, user_id, guest_id, created_at)
            VALUES
                (:event_type, :entity_id, CAST(:details AS JSON), :user_id, :guest_id, :created_at)
            """,
            payload,
        )
        db.session.commit()

        logging.info({
            "event": "audit_write",
            "table": table_name,
            "event_type": event_type,
            "user_id": uid,
            "guest_id": gid,
            "entity_id": entity_id,
            "timestamp": payload["created_at"].isoformat(),
        })

    except SQLAlchemyError as e:
        db.session.rollback()
        logging.error({
            "event": "audit_write_failed",
            "table": table_name,
            "error": str(e),
            "user_id": uid,
            "guest_id": gid,
        })
    except Exception as e:
        logging.exception(f"[AuditWriter] Unexpected error writing audit: {e}")
