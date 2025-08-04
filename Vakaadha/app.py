from flask import Flask, send_from_directory, jsonify,request
from flask_cors import CORS
import os
from db import get_db_connection, init_db
init_db()  # Initialize the database


# Initialize app
app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)

# Serve index.html
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

# Serve all static assets (CSS, JS, images)
@app.route('/<path:path>')
def serve_static_files(path):
    return send_from_directory(app.static_folder, path)

# Health check
@app.route('/health')
def health():
    return jsonify({"status": "VAKAADHA backend running"})

@app.route('/debug-inventory')
def debug_inventory():
    import sqlite3
    conn = sqlite3.connect('vakaadha.db')
    cur = conn.cursor()
    cur.execute("SELECT * FROM inventory")
    rows = cur.fetchall()
    conn.close()
    return jsonify(rows)

@app.route('/cart/remove', methods=['POST'])
def remove_from_cart():
    data = request.get_json()
    user_id = data.get('user_id')
    product_id = data.get('product_id')

    if not user_id or not product_id:
        return jsonify({'error': 'Missing user_id or product_id'}), 400

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM cart WHERE user_id = ? AND product_id = ?", (user_id, product_id))
        conn.commit()
        return jsonify({'message': 'Item removed from cart'}), 200
    except Exception as e:
        print("❌ DB Error:", e)
        return jsonify({'error': 'Failed to remove item'}), 500
    finally:
        conn.close()



# Register all blueprints
from routes.auth_routes import auth_bp
from routes.product_routes import product_bp
from routes.cart_routes import cart_bp
from routes.order_routes import order_bp
from routes.inventory_routes import inventory_bp
from routes.featured_routes import featured_bp
from routes.wishlist_routes import wishlist_bp

app.register_blueprint(auth_bp)
app.register_blueprint(product_bp)
app.register_blueprint(cart_bp)
app.register_blueprint(order_bp)
app.register_blueprint(inventory_bp)
app.register_blueprint(featured_bp)
app.register_blueprint(wishlist_bp)

# Run
if __name__ == '__main__':
    app.run(debug=True)
