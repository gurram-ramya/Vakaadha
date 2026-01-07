# ----------------- pgsql ----------------------------

import logging
from pathlib import Path
from flask import Flask, g, jsonify, send_from_directory, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from utils.auth import initialize_firebase
from db import init_db_for_app
import psutil, os, time, uuid

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["1000 per day", "100 per hour"]
)

def create_app():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )

    app = Flask(
        __name__,
        static_folder=str(FRONTEND_DIR),
        static_url_path=""
    )

    initialize_firebase()

    CORS(
        app,
        supports_credentials=True,
        origins=[
            "http://127.0.0.1:5000",
            "https://vakaadha.com",
            "https://www.vakaadha.com"
        ],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Set-Cookie"]
    )

    limiter.init_app(app)

    @app.before_request
    def before():
        g.request_id = str(uuid.uuid4())
        g.start_time = time.time()

    @app.after_request
    def after(response):
        duration = time.time() - g.start_time
        user_info = None
        u = getattr(g, "user", None)
        if isinstance(u, dict):
            user_info = u.get("email") or u.get("firebase_uid")

        payload = {
            "event": "request_completed",
            "method": request.method,
            "path": request.path,
            "status": response.status_code,
            "duration_ms": round(duration * 1000, 2),
            "ip": request.remote_addr,
            "user": user_info,
            "guest_id": getattr(g, "guest_id", None),
            "request_id": g.request_id
        }

        logging.info(payload)
        response.headers["X-Request-ID"] = g.request_id
        return response

    init_db_for_app(app)

    @app.after_request
    def security_headers(resp):
        resp.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["Cache-Control"] = "no-store"
        return resp

    @app.errorhandler(404)
    def nf(_):
        return jsonify({"error": "not_found"}), 404

    @app.errorhandler(Exception)
    def eh(e):
        logging.exception({
            "event": "unhandled_exception",
            "error": str(e),
            "user": getattr(g, "user", None) and g.user.get("firebase_uid"),
            "guest_id": getattr(g, "guest_id", None),
            "request_id": getattr(g, "request_id", "unknown")
        })
        return jsonify({"error": "internal_error", "request_id": getattr(g, "request_id", "unknown")}), 500

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"}), 200

    @app.route("/api/metrics", methods=["GET"])
    def metrics():
        p = psutil.Process(os.getpid())
        m = {
            "status": "ok",
            "pid": os.getpid(),
            "uptime_seconds": round(time.time() - p.create_time(), 2),
            "memory_mb": round(p.memory_info().rss / 1024 / 1024, 2),
            "cache": {
                "user_cache": 0,
                "profile_cache": 0,
                "firebase_token_cache": 0
            },
            "request_id": getattr(g, "request_id", None)
        }
        return jsonify(m), 200


    from routes.users import users_bp
    from routes.cart import cart_bp
    from routes.catalog import catalog_bp
    from routes.orders import orders_bp
    from routes.addresses import addresses_bp
    from routes.wishlist import bp as wishlist_bp
    from routes.admin import admin_bp

    app.register_blueprint(users_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(catalog_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(addresses_bp)
    app.register_blueprint(wishlist_bp)
    app.register_blueprint(admin_bp)

    limiter.limit("10 per minute")(app.view_functions["users.register_user"])
    limiter.limit("5 per minute")(app.view_functions["users.logout_user"])

    @app.route("/")
    def index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/<path:p>")
    def static_route(p):
        fp = FRONTEND_DIR / p
        if fp.exists():
            return send_from_directory(FRONTEND_DIR, p)
        return send_from_directory(FRONTEND_DIR, "index.html")

    return app
