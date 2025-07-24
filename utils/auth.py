import firebase_admin
from firebase_admin import auth, credentials
from flask import request, jsonify
from functools import wraps
import os

# Absolute path to the JSON file (safe and portable)
FIREBASE_KEY_PATH = os.path.join(os.path.dirname(__file__), '..', 'firebase-adminsdk.json')
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
        if not auth_header:
            return jsonify({'error': 'Authorization header missing'}), 401

        try:
            token = auth_header.split(' ')[1]
            decoded_token = verify_firebase_token(token)
            if not decoded_token:
                return jsonify({'error': 'Invalid token'}), 401
            request.user = decoded_token
        except Exception:
            return jsonify({'error': 'Unauthorized'}), 403

        return f(*args, **kwargs)
    return decorated
