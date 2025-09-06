# utils/security.py
def install_security_headers(app):
    """
    Install a Content-Security-Policy that allows Firebase Auth, Google sign-in,
    and (optionally) AOS from unpkg.com. Tighten for prod as needed.
    """
    AOS_FROM_UNPKG = True  # set to False if you self-host AOS

    script_src = [
        "'self'",
        "'unsafe-inline'",   # dev convenience; use nonces in prod
        "https://www.gstatic.com",        # Firebase SDK
        "https://apis.google.com",        # Google platform
        "https://www.googletagmanager.com",
    ]
    style_src = [
        "'self'",
        "'unsafe-inline'",   # dev convenience; remove in prod
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
    ]
    connect_src = [
        "'self'",
        "https://www.googleapis.com",
        "https://accounts.google.com",
        "https://www.google.com",
        "https://securetoken.googleapis.com",       # Firebase token refresh
        "https://identitytoolkit.googleapis.com",   # Firebase auth REST
    ]
    img_src = [
        "'self'",
        "data:",
        "blob:",
        "https://lh3.googleusercontent.com",
        "https://*.googleusercontent.com",
        "https://www.google.com",
    ]
    frame_src = [
        "'self'",
        "https://accounts.google.com",
        "https://*.googleusercontent.com",
    ]
    font_src = [
        "'self'",
        "data:",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
    ]

    if AOS_FROM_UNPKG:
        script_src.append("https://unpkg.com")
        style_src.append("https://unpkg.com")

    csp = "; ".join([
        "default-src 'self' data: blob:",
        f"script-src {' '.join(script_src)}",
        f"style-src {' '.join(style_src)}",
        f"img-src {' '.join(img_src)}",
        f"font-src {' '.join(font_src)}",
        f"connect-src {' '.join(connect_src)}",
        f"frame-src {' '.join(frame_src)}",
    ])

    @app.after_request
    def _set_headers(resp):
        resp.headers["Content-Security-Policy"] = csp
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "SAMEORIGIN"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return resp
