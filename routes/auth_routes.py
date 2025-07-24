# routes/auth_routes.py
from flask import Blueprint, request, jsonify
from utils.auth import require_auth
from models.user import get_or_create_user

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
@require_auth
def login():
    firebase_user = request.user
    name = firebase_user.get('name', '')
    email = firebase_user.get('email', '')
    uid = firebase_user.get('uid')

    user = get_or_create_user(uid, name, email)
    return jsonify({
        "message": "Login successful",
        "user": user
    })
