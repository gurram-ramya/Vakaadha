# __init__.py

import logging
from flask import Flask, g, jsonify
from flask_cors import CORS
from pathlib import Path
from .db import get_db_connection
from .utils.auth import initialize_firebase
from sqlite3 import Error as DBError

# -------------------------------------------------------------
# Database Default Path
# -------------------------------------------------------------
default_db_path = str(Path(__file__).resolve().parents[1] / "vakaadha.db")


# -------------------------------------------------------------
# Application Factory
# -------------------------------------------------------------
def create_app():
    # Initialize Firebase once at startup
    initialize_firebase()

    # Create Flask app
    app = Flask(__name__)

    # CORS configuration (update domain before deployment)
    CORS(
        app,
        supports_credentials=True,
        origins=[
            "https://vakaadha.com",
            "https://www.vakaadha.com"
        ],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Set-Cookie"]
    )

    # ---------------------------------------------------------
    # Logging Setup
    # ---------------------------------------------------------
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )
    logging.info("Vakaadha Flask App initialized.")

    # ---------------------------------------------------------
    # Database Connection Lifecycle
    # ---------------------------------------------------------
    @app.before_request
    def before_request():
        g.user = None  # Initialize user context for all requests
        try:
            g.db = get_db_connection()
        except DBError as e:
            logging.error(f"Database connection failed: {str(e)}")
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
        logging.error(f"Internal server error: {str(error)}")
        return jsonify({"error": "server_error"}), 500

    @app.errorhandler(DBError)
    def database_error_handler(error):
        logging.error(f"Database error: {str(error)}")
        return jsonify({"error": "database_error"}), 500

    # ---------------------------------------------------------
    # Health Endpoint
    # ---------------------------------------------------------
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok"}), 200

    # ---------------------------------------------------------
    # Blueprint Registration
    # ---------------------------------------------------------
    from .routes.users import users_bp
    from .routes.cart import cart_bp
    from .routes.catalog import catalog_bp

    app.register_blueprint(users_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(catalog_bp)

    logging.info("Blueprints registered: catalog, users, cart")

    return app
