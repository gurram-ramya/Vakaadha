# routes/wishlist_routes.py

from flask import Blueprint, request, jsonify
from utils.auth import require_auth
from db import get_db_connection

wishlist_bp = Blueprint('wishlist', __name__)

# 🔹 GET /wishlist?user_id=email@example.com
@wishlist_bp.route('/wishlist', methods=['GET'])
@require_auth
def get_wishlist():
    user_email = request.args.get('user_id')
    if not user_email:
        return jsonify({"error": "Missing user_id"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    # Get user ID from email
    cur.execute("SELECT id FROM users WHERE email = ?", (user_email,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify([])  # Empty wishlist if user doesn't exist

    user_id = row['id']
    cur.execute("SELECT product_id FROM wishlist WHERE user_id = ?", (user_id,))
    product_ids = [r['product_id'] for r in cur.fetchall()]
    conn.close()

    return jsonify(product_ids)


# 🔹 POST /wishlist { user_id: ..., product_id: ... }
@wishlist_bp.route('/wishlist', methods=['POST'])
@require_auth
def add_to_wishlist():
    data = request.get_json()
    user_email = data.get('user_id')
    product_id = data.get('product_id')

    if not user_email or not product_id:
        return jsonify({"error": "Missing fields"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    # Get user ID from email
    cur.execute("SELECT id FROM users WHERE email = ?", (user_email,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "User not found"}), 404

    user_id = row['id']

    # Check if already in wishlist
    cur.execute("SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?", (user_id, product_id))
    if cur.fetchone():
        conn.close()
        return jsonify({"message": "Already in wishlist"}), 200

    cur.execute("INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)", (user_id, product_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Added to wishlist"}), 201


# 🔹 DELETE /wishlist?user_id=...&product_id=...
@wishlist_bp.route('/wishlist', methods=['DELETE'])
@require_auth
def remove_from_wishlist():
    user_email = request.args.get('user_id')
    product_id = request.args.get('product_id')

    if not user_email or not product_id:
        return jsonify({"error": "Missing parameters"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    # Get user ID
    cur.execute("SELECT id FROM users WHERE email = ?", (user_email,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "User not found"}), 404

    user_id = row['id']

    cur.execute("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?", (user_id, product_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Removed from wishlist"}), 200
