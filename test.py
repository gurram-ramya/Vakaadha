# # test.py
# from app import app
# from domain.users import repository

# if __name__ == "__main__":
#     with app.app_context():
#         user = repository.get_user_by_uid("V2vPN42Sq8bnNI1xqTA5Ba8n1PH2")
#         print(user)

from __init__ import create_app
from db import get_db_connection
from domain.users import repository

app = create_app()

with app.app_context():
    conn = get_db_connection()
    result = repository.get_user_by_uid("OyyN0AoOEPR6LqB5PknPhcTjCEH2")
    print("🔍 get_user_by_uid result:\n", result)
