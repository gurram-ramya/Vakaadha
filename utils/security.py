from flask import request

def install_security_headers(app):
    @app.after_request
    def _set_headers(resp):
        # Basic protection; adjust CSP as you add sources
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        resp.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        # Minimal CSP for local dev; tighten later
        resp.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self' data: blob:; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';"
        )
        return resp
