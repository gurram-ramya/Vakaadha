# __init__.py

# __init__.py
import logging
from flask import Flask, g, jsonify, send_from_directory
from flask_cors import CORS
from pathlib import Path
from sqlite3 import Error as DBError

# ✅ Local imports for dev mode
from db import get_db_connection
from utils.auth import initialize_firebase

# -------------------------------------------------------------
# Paths
# -------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
DB_PATH = BASE_DIR.parent / "vakaadha.db"

# -------------------------------------------------------------
# Flask Application Factory
# -------------------------------------------------------------
def create_app():
    # Initialize Firebase once
    initialize_firebase()

    # Create Flask app and set static folder to frontend/
    app = Flask(
        __name__,
        static_folder=str(FRONTEND_DIR),
        static_url_path=""
    )

    # ---------------------------------------------------------
    # CORS Configuration
    # ---------------------------------------------------------
    CORS(
        app,
        supports_credentials=True,
        origins=[
            "http://127.0.0.1:5000",  # local dev
            "https://vakaadha.com",
            "https://www.vakaadha.com",
        ],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Set-Cookie"],
    )

    # ---------------------------------------------------------
    # Logging Setup
    # ---------------------------------------------------------
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    logging.info("✅ Vakaadha Flask App initialized")

    # ---------------------------------------------------------
    # Database Lifecycle
    # ---------------------------------------------------------
    @app.before_request
    def before_request():
        g.user = None
        try:
            g.db = get_db_connection()
        except DBError as e:
            logging.error(f"Database connection failed: {e}")
            g.db = None

    @app.teardown_request
    def teardown_request(exception):
        db = getattr(g, "db", None)
        if db is not None:
            db.close()

    # ---------------------------------------------------------
    # Error Handlers
    # ---------------------------------------------------------
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({"error": "not_found"}), 404

    @app.errorhandler(500)
    def internal_error(error):
        logging.error(f"Internal server error: {error}")
        return jsonify({"error": "server_error"}), 500

    @app.errorhandler(DBError)
    def database_error_handler(error):
        logging.error(f"Database error: {error}")
        return jsonify({"error": "database_error"}), 500

    # ---------------------------------------------------------
    # Health Endpoint
    # ---------------------------------------------------------
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok"}), 200

    # ---------------------------------------------------------
    # Blueprints (API)
    # ---------------------------------------------------------
    from routes.users import users_bp
    from routes.cart import cart_bp
    from routes.catalog import catalog_bp
    from routes.orders import orders_bp
    from routes.addresses import addresses_bp
    from routes.wishlist import wishlist_bp

    app.register_blueprint(users_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(catalog_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(addresses_bp)
    app.register_blueprint(wishlist_bp)

    logging.info("Blueprints registered: users, cart, catalog, orders, addresses, wishlist")

    # ---------------------------------------------------------
    # Frontend Routes (Serve HTML, JS, CSS)
    # ---------------------------------------------------------
    @app.route("/")
    def serve_index():
        """Serve homepage (frontend/index.html)"""
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/<path:path>")
    def serve_static_file(path):
        """Serve static files from frontend directory"""
        full_path = FRONTEND_DIR / path
        if full_path.exists():
            return send_from_directory(FRONTEND_DIR, path)
        # fallback for deep links
        return send_from_directory(FRONTEND_DIR, "index.html")

    return app
