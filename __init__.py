# app/__init__.py
from flask import Flask, send_from_directory
from flask_cors import CORS
from pathlib import Path
import os
from config import DevConfig
from utils.errors import install_error_handlers
from utils.security import install_security_headers
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

    app.register_blueprint(catalog_bp, url_prefix="/api")

    # Health check
    @app.get("/health")
    def health():
        return {"ok": True}, 200

    return app
