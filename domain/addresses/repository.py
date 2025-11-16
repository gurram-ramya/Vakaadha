# # domain/addresses/repository.py — data access layer for user addresses
# import logging
# from typing import Any
# from db import query_all, query_one, execute, to_dict, to_dicts

# # ==============================================================
# # READ OPERATIONS
# # ==============================================================

# def list_addresses(user_id: int) -> list[dict[str, Any]]:
#     """
#     Return all addresses for a given user_id, ordered by default first then recent.
#     """
#     sql = """
#         SELECT
#             address_id, user_id, name, phone, line1, line2,
#             city, state, pincode, country, type, is_default,
#             created_at, updated_at
#         FROM addresses
#         WHERE user_id = ?
#         ORDER BY is_default DESC, updated_at DESC;
#     """
#     rows = query_all(sql, (user_id,))
#     return to_dicts(rows)


# def get_address_by_id(user_id: int, address_id: int) -> dict[str, Any] | None:
#     """
#     Return a single address belonging to this user.
#     """
#     sql = """
#         SELECT
#             address_id, user_id, name, phone, line1, line2,
#             city, state, pincode, country, type, is_default,
#             created_at, updated_at
#         FROM addresses
#         WHERE user_id = ? AND address_id = ?;
#     """
#     row = query_one(sql, (user_id, address_id))
#     return to_dict(row)


# # ==============================================================
# # WRITE OPERATIONS
# # ==============================================================

# def create_address(user_id: int, data: dict[str, Any]) -> dict[str, Any]:
#     """
#     Insert new address for user. If no address exists yet, mark it default.
#     """
#     # Check if user has any address yet
#     has_existing = query_one("SELECT 1 FROM addresses WHERE user_id = ? LIMIT 1;", (user_id,))
#     is_default = 1 if not has_existing else int(bool(data.get("is_default", False)))

#     sql = """
#         INSERT INTO addresses (
#             user_id, name, phone, line1, line2,
#             city, state, pincode, country, type, is_default
#         )
#         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
#     """
#     params = (
#         user_id,
#         data["name"],
#         data["phone"],
#         data["line1"],
#         data.get("line2"),
#         data["city"],
#         data["state"],
#         data["pincode"],
#         data.get("country", "IN"),
#         data.get("type", "shipping"),
#         is_default,
#     )

#     new_id = execute(sql, params)

#     # If it was created as default, clear others
#     if is_default:
#         _clear_other_defaults(user_id, new_id)

#     created = get_address_by_id(user_id, new_id)
#     return created


# def update_address(user_id: int, address_id: int, data: dict[str, Any]) -> dict[str, Any]:
#     """
#     Update fields of an existing address for this user.
#     """
#     sql = """
#         UPDATE addresses
#         SET
#             name = ?,
#             phone = ?,
#             line1 = ?,
#             line2 = ?,
#             city = ?,
#             state = ?,
#             pincode = ?,
#             country = ?,
#             type = ?,
#             updated_at = datetime('now')
#         WHERE user_id = ? AND address_id = ?;
#     """
#     params = (
#         data["name"],
#         data["phone"],
#         data["line1"],
#         data.get("line2"),
#         data["city"],
#         data["state"],
#         data["pincode"],
#         data.get("country", "IN"),
#         data.get("type", "shipping"),
#         user_id,
#         address_id,
#     )

#     execute(sql, params)
#     updated = get_address_by_id(user_id, address_id)
#     return updated


# def delete_address(user_id: int, address_id: int) -> bool:
#     """
#     Delete an address belonging to user. Returns True if deleted.
#     """
#     sql = "DELETE FROM addresses WHERE user_id = ? AND address_id = ?;"
#     affected = execute(sql, (user_id, address_id))
#     return affected > 0


# def set_default_address(user_id: int, address_id: int) -> None:
#     """
#     Mark one address as default, clear all others for this user.
#     """
#     _clear_all_defaults(user_id)
#     sql = "UPDATE addresses SET is_default = 1, updated_at = datetime('now') WHERE user_id = ? AND address_id = ?;"
#     execute(sql, (user_id, address_id))


# # ==============================================================
# # INTERNAL HELPERS
# # ==============================================================

# def _clear_all_defaults(user_id: int) -> None:
#     """Unset all default flags for user."""
#     execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?;", (user_id,))


# def _clear_other_defaults(user_id: int, keep_address_id: int) -> None:
#     """Unset default on all addresses except the specified one."""
#     execute(
#         "UPDATE addresses SET is_default = 0 WHERE user_id = ? AND address_id != ?;",
#         (user_id, keep_address_id),
#     )

# ---------- pgsql ----------------

# domain/addresses/repository.py
from typing import Any
from db import query_all, query_one, execute

def list_addresses(user_id: int) -> list[dict[str, Any]]:
    rows = query_all(
        """
        SELECT
            address_id, user_id, name, phone, line1, line2,
            city, state, pincode, country, type, is_default,
            created_at, updated_at
        FROM addresses
        WHERE user_id = %s
        ORDER BY is_default DESC, updated_at DESC
        """,
        (user_id,),
    )
    return rows or []

def get_address_by_id(user_id: int, address_id: int):
    row = query_one(
        """
        SELECT
            address_id, user_id, name, phone, line1, line2,
            city, state, pincode, country, type, is_default,
            created_at, updated_at
        FROM addresses
        WHERE user_id = %s AND address_id = %s
        """,
        (user_id, address_id),
    )
    return row if row else None

def create_address(user_id: int, data: dict[str, Any]):
    has_existing = query_one(
        "SELECT 1 FROM addresses WHERE user_id = %s LIMIT 1",
        (user_id,),
    )

    is_default = False
    if not has_existing:
        is_default = True
    else:
        is_default = bool(data.get("is_default"))

    new_id = execute(
        """
        INSERT INTO addresses (
            user_id, name, phone, line1, line2,
            city, state, pincode, country, type, is_default,
            created_at, updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING address_id
        """,
        (
            user_id,
            data["name"],
            data["phone"],
            data["line1"],
            data.get("line2"),
            data["city"],
            data["state"],
            data["pincode"],
            data.get("country", "IN"),
            data.get("type", "shipping"),
            is_default,
        ),
        commit=False,
    )

    row = query_one("SELECT currval(pg_get_serial_sequence('addresses','address_id'))")
    address_id = row["currval"]

    if is_default:
        _clear_other_defaults(user_id, address_id)

    return get_address_by_id(user_id, address_id)

def update_address(user_id: int, address_id: int, data: dict[str, Any]):
    execute(
        """
        UPDATE addresses
        SET
            name = %s,
            phone = %s,
            line1 = %s,
            line2 = %s,
            city = %s,
            state = %s,
            pincode = %s,
            country = %s,
            type = %s,
            updated_at = NOW()
        WHERE user_id = %s AND address_id = %s
        """,
        (
            data["name"],
            data["phone"],
            data["line1"],
            data.get("line2"),
            data["city"],
            data["state"],
            data["pincode"],
            data.get("country", "IN"),
            data.get("type", "shipping"),
            user_id,
            address_id,
        ),
    )
    return get_address_by_id(user_id, address_id)

def delete_address(user_id: int, address_id: int) -> bool:
    affected = execute(
        "DELETE FROM addresses WHERE user_id = %s AND address_id = %s",
        (user_id, address_id),
    )
    return affected > 0

def set_default_address(user_id: int, address_id: int):
    execute(
        "UPDATE addresses SET is_default = FALSE WHERE user_id = %s",
        (user_id,),
    )
    execute(
        """
        UPDATE addresses
        SET is_default = TRUE, updated_at = NOW()
        WHERE user_id = %s AND address_id = %s
        """,
        (user_id, address_id),
    )


def _clear_all_defaults(user_id: int):
    execute(
        "UPDATE addresses SET is_default = FALSE WHERE user_id = %s",
        (user_id,),
    )


def _clear_other_defaults(user_id: int, keep_address_id: int):
    execute(
        """
        UPDATE addresses
        SET is_default = FALSE
        WHERE user_id = %s AND address_id != %s
        """,
        (user_id, keep_address_id),
    )
