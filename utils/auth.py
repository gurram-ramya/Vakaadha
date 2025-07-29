# utils/auth.py

import firebase_admin
from firebase_admin import auth, credentials
from flask import request, jsonify, g
from functools import wraps
import os

# 🔐 Load Firebase credentials from service account
FIREBASE_KEY_PATH = os.path.join(os.path.dirname(__file__), '..', 'firebase-adminsdk.json')
if not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_KEY_PATH)
    firebase_admin.initialize_app(cred)

def verify_firebase_token(id_token):
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        print("Firebase Token Error:", e)
        return None

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({'error': 'Authorization header missing or malformed'}), 401

        token = auth_header.split(' ')[1]
        decoded_token = verify_firebase_token(token)
        if not decoded_token:
            return jsonify({'error': 'Invalid Firebase token'}), 401

        # ✅ Set user info into flask.g
        g.user = {
            "uid": decoded_token.get("uid"),
            "email": decoded_token.get("email"),
            "name": decoded_token.get("name", "")  # Optional name from Firebase (if available)
        }

        return f(*args, **kwargs)
    return decorated
