# utils/cache.py
from cachetools import TTLCache, cached
import threading

# -------------------------------------------------------------
# Global caches with per-process scope
# -------------------------------------------------------------
user_cache = TTLCache(maxsize=512, ttl=300)      # 5 minutes
profile_cache = TTLCache(maxsize=512, ttl=300)
firebase_token_cache = TTLCache(maxsize=256, ttl=600)  # 10 minutes

# Thread safety lock for cachetools
lock = threading.RLock()


def clear_all_caches():
    """Manually clear all in-memory caches."""
    user_cache.clear()
    profile_cache.clear()
    firebase_token_cache.clear()
