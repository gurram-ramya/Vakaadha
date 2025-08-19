from flask import jsonify

def error(code, message, details=None):
    return jsonify({"error": {"code": code, "message": message, "details": details or {}}})

def install_error_handlers(app):
    @app.errorhandler(400)
    def _400(e): return (error("bad_request", str(e.description or "Bad request")), 400)
    @app.errorhandler(401)
    def _401(e): return (error("unauthorized", "Authentication required"), 401)
    @app.errorhandler(403)
    def _403(e): return (error("forbidden", "Not allowed"), 403)
    @app.errorhandler(404)
    def _404(e): return (error("not_found", "Not found"), 404)
    @app.errorhandler(409)
    def _409(e): return (error("conflict", str(e.description or "Conflict")), 409)
    @app.errorhandler(415)
    def _415(e): return (error("unsupported_media_type", str(e.description or "Unsupported media")), 415)
    @app.errorhandler(422)
    def _422(e): return (error("unprocessable", str(e.description or "Invalid data")), 422)
    @app.errorhandler(500)
    def _500(e): return (error("server_error", "Something went wrong")), 500
