# # domain/addresses/service.py
# def validate_address(data):
#     """
#     Validate address payload for correctness and completeness.
#     Returns (True, sanitized_data) or (False, error_message)
#     """
#     required = ["name", "phone", "line1", "city", "state", "pincode"]
#     missing = [f for f in required if not data.get(f)]
#     if missing:
#         return False, f"Missing required fields: {', '.join(missing)}"

#     result = {
#         "name": data["name"].strip(),
#         "phone": str(data["phone"]).strip(),
#         "line1": data["line1"].strip(),
#         "line2": (data.get("line2") or None),
#         "city": data["city"].strip(),
#         "state": data["state"].strip(),
#         "pincode": str(data["pincode"]).strip(),
#     }
#     return True, result



# ---------- pgsql ---------------

def validate_address(data):
    required = ["name", "phone", "line1", "city", "state", "pincode"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return False, f"Missing required fields: {', '.join(missing)}"

    sanitized = {
        "name": data["name"].strip(),
        "phone": str(data["phone"]).strip(),
        "line1": data["line1"].strip(),
        "line2": (data.get("line2") or None),
        "city": data["city"].strip(),
        "state": data["state"].strip(),
        "pincode": str(data["pincode"]).strip(),
        "country": data.get("country", "IN"),
        "type": data.get("type", "shipping"),
        "is_default": data.get("is_default", False),
    }

    return True, sanitized
