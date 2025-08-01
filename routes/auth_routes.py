# routes/auth_routes.py
from flask import Blueprint, request, jsonify, g
from utils.auth import require_auth
from models.user import get_or_create_user

auth_bp = Blueprint('auth', __name__)

# @auth_bp.route('/login', methods=['POST'])
# @require_auth
# def login():
#     firebase_user = request.user
#     name = firebase_user.get('name', '')
#     email = firebase_user.get('email', '')
#     uid = firebase_user.get('uid')

#     user = get_or_create_user(uid, name, email)
#     return jsonify({
#         "message": "Login successful",
#         "user": user
#     })

@auth_bp.route('/login', methods=['POST'])
@require_auth
def login():
    firebase_user = g.user
    email = firebase_user.get('email', '')
    uid = firebase_user.get('uid')

    data = request.get_json()
    name = data.get('name', 'User')

    # 🔁 Get or create user and internal user_id
    user = get_or_create_user(uid, name, email)

    return jsonify({
        "message": "Login successful",
        "user": {
            "user_id": user['user_id'],  # ✅ This is the internal INT ID
            "name": user['name'],
            "email": user['email']
        }
    })

