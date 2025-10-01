# app/__init__.py
from flask import Flask, send_from_directory, request, g
from flask_cors import CORS
from pathlib import Path
import os
from config import DevConfig
from utils.errors import install_error_handlers
from utils.security import install_security_headers, decode_token
from db import init_db_for_app


def create_app(config_object=DevConfig):
    app = Flask(__name__, static_folder="frontend", static_url_path="")
    app.config.from_object(config_object)

    # Point database to vakaadha.db in project root
    default_db_path = str(Path(__file__).resolve().parents[1] / "vakaadha.db")
    app.config.setdefault("DATABASE_PATH", default_db_path)

    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # DB hooks, security, errors
    init_db_for_app(app)
    install_security_headers(app)
    install_error_handlers(app)

    # ---------------- USER CONTEXT ----------------
    @app.before_request
    def attach_user_id():
        """
        Extract user_id from Authorization header if present.
        Supports Firebase ID tokens via decode_token().
        """
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            try:
                payload = decode_token(token)
                request.user_id = payload.get("user_id")
                g.user_id = request.user_id
            except Exception:
                request.user_id = None
                g.user_id = None
        else:
            request.user_id = None
            g.user_id = None

    # ---------------- FRONTEND ROUTES ----------------
    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    @app.route("/favicon.ico")
    def favicon():
        fav_path = os.path.join(app.static_folder, "favicon.ico")
        if os.path.isfile(fav_path):
            return send_from_directory(app.static_folder, "favicon.ico")
        return ("", 204)

    @app.route("/<path:filename>")
    def serve_frontend_file(filename):
        full_path = os.path.join(app.static_folder, filename)
        if os.path.isfile(full_path):
            return send_from_directory(app.static_folder, filename)
        return ("Not found", 404)

    # ---------------- API BLUEPRINTS ----------------
    from routes.catalog import catalog_bp
    from routes.users import bp as users_bp
    from routes.cart import bp as cart_bp

    app.register_blueprint(catalog_bp, url_prefix="/api")
    app.register_blueprint(users_bp, url_prefix="/api")
    app.register_blueprint(cart_bp)

    # Health check
    @app.get("/health")
    def health():
        return {"ok": True}, 200

    return app
