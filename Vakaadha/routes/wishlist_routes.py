from flask import Blueprint, request, jsonify
import sqlite3
from utils.auth import require_auth

wishlist_bp = Blueprint('wishlist', __name__)

def get_db_connection():
    conn = sqlite3.connect('vakaadha.db')
    conn.row_factory = sqlite3.Row
    return conn

@wishlist_bp.route('/wishlist', methods=['GET'])
def get_wishlist():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT product_id FROM wishlist WHERE user_id = ?", (user_id,))
    rows = cursor.fetchall()
    conn.close()

    product_ids = [row['product_id'] for row in rows]
    return jsonify(product_ids)

@wishlist_bp.route('/wishlist', methods=['POST'])
def add_to_wishlist():
    data = request.get_json()
    user_id = data.get('user_id')
    product_id = data.get('product_id')

    if not user_id or not product_id:
        return jsonify({'error': 'Missing fields'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    # Check if item already exists
    cursor.execute("SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ?", (user_id, product_id))
    exists = cursor.fetchone()
    if exists:
        conn.close()
        return jsonify({'message': 'Already in wishlist'}), 200

    cursor.execute("INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)", (user_id, product_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Added to wishlist'}), 201

@wishlist_bp.route('/wishlist', methods=['DELETE'])
def remove_from_wishlist():
    user_id = request.args.get('user_id')
    product_id = request.args.get('product_id')

    if not user_id or not product_id:
        return jsonify({'error': 'Missing fields'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?", (user_id, product_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Removed from wishlist'})
