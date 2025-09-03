# utils/security.py
from flask import request

def install_security_headers(app):
    @app.after_request
    def _set_headers(resp):
        # Base hardening
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "no-referrer")
        resp.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        resp.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")

        # Relaxed CSP for local dev. Tighten for prod (remove 'unsafe-inline', use nonces/hashes, or self-host).
        csp = [
            "default-src 'self' data: blob:",
            # Firebase SDK (gstatic), Google APIs loader for provider popups, (optional) GTM
            "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://www.googletagmanager.com",
            # Styles: local + CDNs you’re using
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
            # Fonts (google/cdnjs) + data: for inline SVG/WOFF2
            "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
            # Images (allow Google profile photos)
            "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com",
            # XHR/fetch (Firebase Auth endpoints + Google APIs when needed)
            "connect-src 'self' https://www.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://apis.google.com https://accounts.google.com",
            # Popups/iframes used by Google sign-in
            "frame-src 'self' https://accounts.google.com https://*.google.com",
            "media-src 'self' blob:",
        ]
        resp.headers["Content-Security-Policy"] = "; ".join(csp)
        return resp
