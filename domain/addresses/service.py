# # domain/addresses/service.py

# from domain.addresses import repository as repo


# # -----------------------------
# # Service Layer — Business Logic
# # -----------------------------

# def normalize_address_data(data: dict) -> dict:
#     """Trim and normalize incoming address data."""
#     fields = ["name", "phone", "line1", "line2", "city", "state", "pincode"]
#     normalized = {}
#     for f in fields:
#         val = (data.get(f) or "").strip()
#         normalized[f] = val
#     normalized["state"] = normalized["state"].upper()
#     normalized["country"] = data.get("country", "IN").strip().upper()
#     normalized["type"] = data.get("type", "shipping")
#     normalized["is_default"] = int(data.get("is_default", 0))
#     return normalized


# def list_addresses(conn, user_id: int):
#     """Return all addresses for the user."""
#     return repo.get_all_addresses(conn, user_id)


# def get_address(conn, user_id: int, address_id: int):
#     """Fetch one address by id, validating ownership."""
#     address = repo.get_address_by_id(conn, user_id, address_id)
#     if not address:
#         raise ValueError("Address not found")
#     return address


# def create_address(conn, user_id: int, payload: dict):
#     """Validate, normalize, and create a new address."""
#     data = normalize_address_data(payload)

#     required = ["name", "phone", "line1", "city", "state", "pincode"]
#     missing = [f for f in required if not data.get(f)]
#     if missing:
#         raise ValueError(f"Missing required fields: {', '.join(missing)}")

#     addresses = repo.get_all_addresses(conn, user_id)
#     if not addresses:
#         data["is_default"] = 1

#     addr_id = repo.create_address(conn, user_id, data)
#     return repo.get_address_by_id(conn, user_id, addr_id)


# def update_address(conn, user_id: int, address_id: int, payload: dict):
#     """Update an existing address."""
#     existing = repo.get_address_by_id(conn, user_id, address_id)
#     if not existing:
#         raise ValueError("Address not found")

#     data = normalize_address_data(payload)
#     repo.update_address(conn, user_id, address_id, data)
#     return repo.get_address_by_id(conn, user_id, address_id)


# def delete_address(conn, user_id: int, address_id: int):
#     """Delete address and ensure default consistency."""
#     target = repo.get_address_by_id(conn, user_id, address_id)
#     if not target:
#         raise ValueError("Address not found")

#     repo.delete_address(conn, user_id, address_id)

#     if target["is_default"]:
#         remaining = repo.get_all_addresses(conn, user_id)
#         if remaining:
#             first_id = remaining[0]["address_id"]
#             repo.set_default_address(conn, user_id, first_id)


# def set_default(conn, user_id: int, address_id: int):
#     """Set one address as default."""
#     target = repo.get_address_by_id(conn, user_id, address_id)
#     if not target:
#         raise ValueError("Address not found")

#     repo.set_default_address(conn, user_id, address_id)
#     return repo.get_address_by_id(conn, user_id, address_id)


# domain/addresses/service.py
def validate_address(data):
    """
    Validate address payload for correctness and completeness.
    Returns (True, sanitized_data) or (False, error_message)
    """
    required = ["name", "phone", "line1", "city", "state", "pincode"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return False, f"Missing required fields: {', '.join(missing)}"

    result = {
        "name": data["name"].strip(),
        "phone": str(data["phone"]).strip(),
        "line1": data["line1"].strip(),
        "line2": (data.get("line2") or None),
        "city": data["city"].strip(),
        "state": data["state"].strip(),
        "pincode": str(data["pincode"]).strip(),
    }
    return True, result

