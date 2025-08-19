# app/__init__.py
from flask import Flask
from flask_cors import CORS
from pathlib import Path
from config import DevConfig
from utils.errors import install_error_handlers
from utils.security import install_security_headers
from db import init_db_for_app

def create_app(config_object=DevConfig):
    app = Flask(__name__, static_folder="static")
    app.config.from_object(config_object)

    # Ensure db.py knows exactly where the SQLite file is.
    # This matches scripts/init_schema.py (repo root / vakaadha.db).
    default_db_path = str(Path(__file__).resolve().parents[1] / "vakaadha.db")
    app.config.setdefault("DATABASE_PATH", default_db_path)

    # CORS only for local frontends; adjust as needed
    CORS(app, resources={r"/*": {"origins": app.config["CORS_ORIGINS"]}})

    # DB lifecycle (PRAGMAs + teardown hook via db.init_db_for_app)
    init_db_for_app(app)

    # Security headers & error handlers
    install_security_headers(app)
    install_error_handlers(app)

    # ---- Register blueprints ----
    from routes.catalog import bp as catalog_bp
    from routes.cart import bp as cart_bp
    from routes.orders import bp as orders_bp
    from routes.inventory import bp as inventory_bp
    from routes.users import bp as users_bp
    from routes.wishlist import bp as wishlist_bp
    from routes.media_routes import bp as media_bp
    from routes.admin import bp as admin_bp

    app.register_blueprint(catalog_bp, url_prefix="/")
    app.register_blueprint(cart_bp, url_prefix="/")
    app.register_blueprint(orders_bp, url_prefix="/")
    app.register_blueprint(inventory_bp, url_prefix="/")
    app.register_blueprint(users_bp, url_prefix="/")
    app.register_blueprint(wishlist_bp, url_prefix="/")
    app.register_blueprint(media_bp, url_prefix="/")
    app.register_blueprint(admin_bp, url_prefix="/admin")

    # Health
    @app.get("/health")
    def health():
        return {"ok": True}, 200

    return app
