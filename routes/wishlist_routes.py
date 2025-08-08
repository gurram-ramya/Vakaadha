# from flask import Blueprint, request, jsonify
# from database import wishlist_db  # Use your existing DB logic (mock or real)
# import sqlite3
# from utils.auth import require_auth

# wishlist_bp = Blueprint('wishlist', __name__)

# # In-memory structure for demo
# # wishlist_db = [{'user_id': 'user@email.com', 'product_id': 123}, ...]

# @wishlist_bp.route('/wishlist', methods=['GET'])
# def get_wishlist():
#     user_id = request.args.get('user_id')
#     if not user_id:
#         return jsonify({'error': 'user_id required'}), 400

#     wishlist_items = [item for item in wishlist_db if item['user_id'] == user_id]
#     return jsonify(wishlist_items)

# @wishlist_bp.route('/wishlist', methods=['POST'])
# def add_to_wishlist():
#     data = request.get_json()
#     user_id = data.get('user_id')
#     product_id = data.get('product_id')

#     if not user_id or not product_id:
#         return jsonify({'error': 'Missing fields'}), 400

#     # Avoid duplicates
#     exists = any(item for item in wishlist_db if item['user_id'] == user_id and item['product_id'] == product_id)
#     if exists:
#         return jsonify({'message': 'Already in wishlist'}), 200

#     wishlist_db.append({'user_id': user_id, 'product_id': product_id})
#     return jsonify({'message': 'Added to wishlist'}), 201

# @wishlist_bp.route('/wishlist', methods=['DELETE'])
# def remove_from_wishlist():
#     user_id = request.args.get('user_id')
#     product_id = request.args.get('product_id')

#     global wishlist_db
#     wishlist_db = [item for item in wishlist_db if not (item['user_id'] == user_id and str(item['product_id']) == product_id)]
#     return jsonify({'message': 'Removed from wishlist'})
from flask import Blueprint, request, jsonify
from models.wishlist import get_wishlist_by_user, add_to_wishlist, remove_from_wishlist

wishlist_bp = Blueprint('wishlist', __name__)

@wishlist_bp.route('/wishlist', methods=['GET'])
def get_wishlist():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    return jsonify(get_wishlist_by_user(user_id))


@wishlist_bp.route('/wishlist', methods=['POST'])
def add_item():
    data = request.get_json()
    return jsonify(add_to_wishlist(data['user_id'], data['product_id']))


@wishlist_bp.route('/wishlist', methods=['DELETE'])
def remove_item():
    user_id = request.args.get('user_id')
    product_id = request.args.get('product_id')
    return jsonify(remove_from_wishlist(user_id, product_id))
