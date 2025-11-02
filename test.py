# test.py
from app import app
from domain.users import repository

if __name__ == "__main__":
    with app.app_context():
        user = repository.get_user_by_uid("V2vPN42Sq8bnNI1xqTA5Ba8n1PH2")
        print(user)
