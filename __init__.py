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
    # Serve everything from the frontend/ directory at the root URL space.
    app = Flask(__name__, static_folder="frontend", static_url_path="")
    app.config.from_object(config_object)

    # Ensure db.py uses the same SQLite file path that scripts/init_schema.py creates.
    default_db_path = str(Path(__file__).resolve().parents[1] / "vakaadha.db")
    app.config.setdefault("DATABASE_PATH", default_db_path)

    # CORS (adjust your allowlist in DevConfig.CORS_ORIGINS)
    CORS(app, resources={r"/*": {"origins": app.config["CORS_ORIGINS"]}})

    # DB lifecycle hooks
    init_db_for_app(app)

    # Security headers & error handlers
    install_security_headers(app)
    install_error_handlers(app)

    # ---------- FRONTEND ROUTES (put these BEFORE API blueprints) ----------

    @app.route("/")
    def index():
        # Always serve the SPA/landing page at "/"
        return app.send_static_file("index.html")

    @app.route("/favicon.ico")
    def favicon():
        # Optional: serve your favicon if present, else return 204 to avoid noisy 401/404
        fav_path = os.path.join(app.static_folder, "favicon.ico")
        if os.path.isfile(fav_path):
            return send_from_directory(app.static_folder, "favicon.ico")
        return ("", 204)

    # Serve any other file that actually exists in frontend/
    @app.route("/<path:filename>")
    def serve_frontend_file(filename):
        full_path = os.path.join(app.static_folder, filename)
        if os.path.isfile(full_path):
            return send_from_directory(app.static_folder, filename)
        # Fall through to API/404 handling if no such file exists
        return ("Not found", 404)

    # ---------- API BLUEPRINTS (mounted after the frontend routes) ----------

    from routes.catalog import bp as catalog_bp
    from routes.cart import bp as cart_bp
    from routes.orders import bp as orders_bp
    # from routes.inventory import bp as inventory_bp
    from routes.users import bp as users_bp
    # from routes.wishlist import bp as wishlist_bp
    # from routes.media_routes import bp as media_bp
    # from routes.admin import bp as admin_bp

    app.register_blueprint(catalog_bp, url_prefix="/")
    app.register_blueprint(cart_bp, url_prefix="/")
    app.register_blueprint(orders_bp, url_prefix="/")
    # app.register_blueprint(inventory_bp, url_prefix="/")
    app.register_blueprint(users_bp, url_prefix="/")
    # app.register_blueprint(wishlist_bp, url_prefix="/")
    # app.register_blueprint(media_bp, url_prefix="/")
    # app.register_blueprint(admin_bp, url_prefix="/admin")

    # Health check (unprotected)
    @app.get("/health")
    def health():
        return {"ok": True}, 200

    return app
