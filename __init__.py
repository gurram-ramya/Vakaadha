# __init__.py
import logging
from flask_cors import CORS
from pathlib import Path
from sqlite3 import Error as DBError
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from db import get_db_connection, init_db_for_app
# from utils.auth import initialize_firebase
import uuid, time
import psutil, os, time
from utils.cache import user_cache, profile_cache, firebase_token_cache
from flask import Flask, g, jsonify, send_from_directory, request


# -------------------------------------------------------------
# Paths
# -------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
DB_PATH = BASE_DIR.parent / "vakaadha.db"

# -------------------------------------------------------------
# Global Rate Limiter (instance only)
# -------------------------------------------------------------
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["1000 per day", "100 per hour"]
)

# -------------------------------------------------------------
# Flask Application Factory
# -------------------------------------------------------------
def create_app():

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    logging.info("🚀 create_app() starting")

    # Create Flask app
    app = Flask(
        __name__,
        static_folder=str(FRONTEND_DIR),
        static_url_path=""
    )

    # ---------------------------------------------------------
    # Initialize Firebase (after app creation for context safety)
    # ---------------------------------------------------------
    from utils.auth import initialize_firebase
    initialize_firebase()

    # ---------------------------------------------------------
    # Apply CORS
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
    # Initialize rate limiter
    # ---------------------------------------------------------
    limiter.init_app(app)

    # ---------------------------------------------------------
    # Logging
    # ---------------------------------------------------------
    # logging.basicConfig(
    #     level=logging.INFO,
    #     format="%(asctime)s [%(levelname)s] %(message)s",
    # )
    # logging.info("✅ Vakaadha Flask App initialized")


    # ---------------------------------------------------------
    # Request Context & Logging Middleware
    # ---------------------------------------------------------
    @app.before_request
    def attach_request_id():
        """Attach a unique request ID and start time to every request."""
        g.request_id = str(uuid.uuid4())
        g.start_time = time.time()

    @app.after_request
    def log_request(response):
        """Structured JSON-style access log for each request."""
        duration = time.time() - g.get("start_time", time.time())

        user_info = None
        if isinstance(getattr(g, "user", None), dict):
            user_info = g.user.get("email") or g.user.get("firebase_uid")

        log_payload = {
            "event": "request_completed",
            "method": request.method,
            "path": request.path,
            "status": response.status_code,
            "duration_ms": round(duration * 1000, 2),
            "ip": request.remote_addr,
            "user": user_info,
            "guest_id": getattr(g, "guest_id", None),
            "request_id": g.request_id,
        }

        logging.info(log_payload)
        response.headers["X-Request-ID"] = g.request_id
        return response

    # ---------------------------------------------------------
    # ✅ Centralized Database Lifecycle (managed by db.py)
    # ---------------------------------------------------------
    # This replaces the manual before_request / teardown_request DB logic.
    init_db_for_app(app)
    # # ---------------------------------------------------------
    # # Database lifecycle
    # # ---------------------------------------------------------
    # @app.before_request
    # def before_request():
    #     g.user = None
    #     try:
    #         g.db = get_db_connection()
    #     except DBError as e:
    #         logging.error(f"Database connection failed: {e}")
    #         g.db = None

    # @app.teardown_request
    # def teardown_request(exception):
    #     db = getattr(g, "db", None)
    #     if db is not None:
    #         db.close()

    # ---------------------------------------------------------
    # Security Headers
    # ---------------------------------------------------------
    @app.after_request
    def add_security_headers(response):
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        return response
    
    def finalize_guest_cookie(resp):
        if getattr(g, "defer_guest_cookie", False):
            _set_guest_cookie(resp, getattr(g, "guest_id", None))
        return resp

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

    @app.errorhandler(Exception)
    def unhandled_exception(e):
        logging.exception({
            "event": "unhandled_exception",
            "error": str(e),
            "user": getattr(g, "user", None) and g.user.get("firebase_uid"),
            "guest_id": getattr(g, "guest_id", None),
            "request_id": getattr(g, "request_id", "unknown"),
        })
        return jsonify({"error": "internal_error", "request_id": getattr(g, "request_id", "unknown")}), 500


    # ---------------------------------------------------------
    # Health Check
    # ---------------------------------------------------------
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok"}), 200

    # ---------------------------------------------------------
    # Metrics Endpoint
    # ---------------------------------------------------------

    @app.route("/api/metrics", methods=["GET"])
    def metrics():
        """Expose minimal runtime metrics for monitoring."""
        process = psutil.Process(os.getpid())
        metrics = {
            "status": "ok",
            "pid": os.getpid(),
            "uptime_seconds": round(time.time() - process.create_time(), 2),
            "memory_mb": round(process.memory_info().rss / 1024 / 1024, 2),
            "cache": {
                "user_cache": len(user_cache),
                "profile_cache": len(profile_cache),
                "firebase_token_cache": len(firebase_token_cache),
            },
            "request_id": getattr(g, "request_id", None),
        }
        return jsonify(metrics), 200


    # ---------------------------------------------------------
    # Blueprints (API)
    # ---------------------------------------------------------
    from routes.users import users_bp
    from routes.cart import cart_bp
    from routes.catalog import catalog_bp
    from routes.orders import orders_bp
    from routes.addresses import addresses_bp
    from routes.wishlist import bp as wishlist_bp
    # from routes.payments_service import payments_bp
    from routes.admin import admin_bp

    app.register_blueprint(users_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(catalog_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(addresses_bp)
    app.register_blueprint(wishlist_bp)
    # app.register_blueprint(payments_bp)
    app.register_blueprint(admin_bp)

    logging.info("Blueprints registered: users, cart, catalog, orders, addresses, wishlist, payments, admin")

    # ---------------------------------------------------------
    # Apply rate limits to sensitive routes AFTER registration
    # ---------------------------------------------------------
    limiter.limit("10 per minute")(app.view_functions["users.register_user"])
    limiter.limit("5 per minute")(app.view_functions["users.logout_user"])

    # ---------------------------------------------------------
    # Frontend Static Routes
    # ---------------------------------------------------------
    @app.route("/")
    def serve_index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/<path:path>")
    def serve_static_file(path):
        full_path = FRONTEND_DIR / path
        if full_path.exists():
            return send_from_directory(FRONTEND_DIR, path)
        return send_from_directory(FRONTEND_DIR, "index.html")

    return app
