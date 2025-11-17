# # db.py — final production version
# """
# SQLite connection helper for Flask (per-request).

# Features:
# - One connection per request (stored in flask.g)
# - Auto-reconnect if connection closed mid-request
# - Proper teardown, PRAGMAs, WAL for better concurrency
# - Dict-like rows via sqlite3.Row
# - Convenience helpers (query_one, query_all, query_scalar, exists, execute, executemany)
# - transaction() context manager for atomic operations
# - Pagination utilities
# - Optional FTS5-aware product text search with LIKE fallback
# """

# from __future__ import annotations

# import os
# import sqlite3
# from contextlib import contextmanager
# from typing import Any, Iterable, Optional, Sequence

# from flask import current_app, g

# # =============================================================
# # Low-level Connection
# # =============================================================

# def _connect(db_path: str) -> sqlite3.Connection:
#     """
#     Open a new SQLite connection with sane defaults for a web app.
#     """
#     os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

#     con = sqlite3.connect(
#         db_path,
#         detect_types=sqlite3.PARSE_DECLTYPES,
#         check_same_thread=False,  # allow usage across Flask threads
#     )
#     con.row_factory = sqlite3.Row

#     # Apply PRAGMAs for performance and reliability
#     pragmas = [
#         ("PRAGMA foreign_keys = ON;", ()),
#         ("PRAGMA journal_mode = WAL;", ()),
#         ("PRAGMA synchronous = NORMAL;", ()),
#         ("PRAGMA busy_timeout = 5000;", ()),  # wait up to 5s on locks
#         ("PRAGMA temp_store = MEMORY;", ()),
#     ]
#     for stmt, params in pragmas:
#         try:
#             con.execute(stmt, params)
#         except sqlite3.Error:
#             # Ignore unsupported PRAGMAs (older SQLite builds)
#             pass

#     return con


# # =============================================================
# # Flask Integration
# # =============================================================

# def get_db_connection() -> sqlite3.Connection:
#     """
#     Get (and cache) the per-request connection.
#     Automatically reconnects if connection was closed.
#     """
#     db_path = current_app.config.get("DATABASE_PATH", "vakaadha.db")

#     # If there's no connection or it was closed, open a new one
#     if "db" not in g or not _is_connection_open(g.get("db")):
#         g.db = _connect(db_path)
#     return g.db


# def _is_connection_open(con: Optional[sqlite3.Connection]) -> bool:
#     """Return True if the connection is open."""
#     if con is None:
#         return False
#     try:
#         con.execute("SELECT 1;")
#         return True
#     except sqlite3.ProgrammingError:
#         return False
#     except sqlite3.Error:
#         return False


# def close_db_connection(_: Optional[BaseException] = None) -> None:
#     """
#     Close and remove the per-request connection if present.
#     Flask calls this automatically on app teardown.
#     """
#     con: Optional[sqlite3.Connection] = g.pop("db", None)
#     if con is not None:
#         try:
#             con.close()
#         except Exception:
#             pass


# def init_db_for_app(app) -> None:
#     """
#     Register teardown hook and ensure DB directory exists.
#     Call this once from your app factory.
#     """
#     db_path = app.config.get("DATABASE_PATH", "vakaadha.db")
#     os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
#     app.teardown_appcontext(close_db_connection)


# # Backwards-compatible alias
# def get_db():
#     return get_db_connection()


# # =============================================================
# # Convenience Helpers
# # =============================================================

# def query_one(sql: str, params: Sequence[Any] | None = None) -> Optional[sqlite3.Row]:
#     con = get_db_connection()
#     cur = con.execute(sql, params or [])
#     return cur.fetchone()


# def query_all(sql: str, params: Sequence[Any] | None = None) -> list[sqlite3.Row]:
#     con = get_db_connection()
#     cur = con.execute(sql, params or [])
#     return cur.fetchall()


# def query_scalar(sql: str, params: Sequence[Any] | None = None) -> Any:
#     row = query_one(sql, params)
#     if row is None:
#         return None
#     return row[0]


# def exists(sql: str, params: Sequence[Any] | None = None) -> bool:
#     return query_one(sql, params) is not None


# def execute(sql: str, params: Sequence[Any] | None = None) -> int:
#     """
#     Execute an INSERT/UPDATE/DELETE and COMMIT immediately.
#     Returns lastrowid for INSERTs when available, else rowcount.
#     """
#     con = get_db_connection()
#     cur = con.execute(sql, params or [])
#     last_id = cur.lastrowid
#     con.commit()
#     return last_id if last_id else cur.rowcount


# def executemany(sql: str, seq_of_params: Iterable[Sequence[Any]]) -> int:
#     """
#     Execute many INSERT/UPDATE/DELETE statements and COMMIT.
#     Returns total rowcount.
#     """
#     con = get_db_connection()
#     cur = con.executemany(sql, seq_of_params)
#     con.commit()
#     return cur.rowcount


# @contextmanager
# def transaction():
#     db_path = current_app.config.get("DATABASE_PATH", "vakaadha.db")
#     con = _connect(db_path)
#     try:
#         con.execute("BEGIN IMMEDIATE")
#         yield con
#         con.commit()
#     except Exception:
#         con.rollback()
#         raise
#     finally:
#         con.close()


# # =============================================================
# # Utilities
# # =============================================================

# def paginate(page: int, page_size: int) -> tuple[int, int]:
#     """
#     Compute offset/limit from page/page_size (1-based page).
#     Returns (limit, offset).
#     """
#     page = max(1, int(page or 1))
#     page_size = max(1, min(int(page_size or 24), 200))
#     offset = (page - 1) * page_size
#     return page_size, offset


# def to_dict(row: sqlite3.Row | None) -> Optional[dict[str, Any]]:
#     """Convert a sqlite3.Row to a dict."""
#     return {k: row[k] for k in row.keys()} if row else None


# def to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
#     """Convert iterable of sqlite3.Row to list of dicts."""
#     return [{k: r[k] for k in r.keys()} for r in rows]


# # =============================================================
# # Optional: FTS5-aware Search
# # =============================================================

# def _fts_available(con: Optional[sqlite3.Connection] = None) -> bool:
#     """
#     Check whether the products_fts virtual table exists.
#     """
#     con = con or get_db_connection()
#     try:
#         row = con.execute(
#             "SELECT 1 FROM sqlite_master "
#             "WHERE name='products_fts' "
#             "AND (type='table' OR sql LIKE 'CREATE VIRTUAL TABLE%')"
#         ).fetchone()
#         return row is not None
#     except sqlite3.Error:
#         return False


# def search_products_text(q: str, limit: int = 24, offset: int = 0) -> list[sqlite3.Row]:
#     """
#     Full-text search over products using FTS5 if available,
#     falling back to LIKE search otherwise.
#     Returns rows with at least: product_id, name, description.
#     """
#     con = get_db_connection()
#     limit = max(1, min(int(limit or 24), 200))
#     offset = max(0, int(offset or 0))

#     try:
#         if _fts_available(con):
#             sql = """
#             SELECT p.product_id, p.name, p.description, p.category
#             FROM products_fts f
#             JOIN products p ON p.product_id = f.rowid
#             WHERE f MATCH ?
#             ORDER BY bm25(f)
#             LIMIT ? OFFSET ?;
#             """
#             return query_all(sql, (q, limit, offset))
#         else:
#             like = f"%{q}%"
#             sql = """
#             SELECT p.product_id, p.name, p.description, p.category
#             FROM products p
#             LEFT JOIN product_details pd ON pd.product_id = p.product_id
#             WHERE p.name LIKE ?
#                OR IFNULL(p.description,'') LIKE ?
#                OR IFNULL(pd.long_description,'') LIKE ?
#             LIMIT ? OFFSET ?;
#             """
#             return query_all(sql, (like, like, like, limit, offset))
#     except Exception:
#         return []


# - ------- PostgreSQL ---------------

# db.py — robust PostgreSQL access layer (drop-in replacement)

# db.py — unified PostgreSQL access layer

import os
from contextlib import contextmanager
from typing import Optional

import psycopg2
import psycopg2.extras
import psycopg2.pool
from flask import g, has_request_context

DB_PARAMS = {
    "host": os.getenv("PGHOST") or "localhost",
    "port": int(os.getenv("PGPORT") or 5432),
    "database": os.getenv("PGDATABASE") or "vakaadha",
    "user": os.getenv("PGUSER") or "postgres",
    "password": os.getenv("PGPASSWORD") or "Domain@123",
}

MIN_CONN = int(os.getenv("PGPOOL_MIN", 1))
MAX_CONN = int(os.getenv("PGPOOL_MAX", 20))

POOL = psycopg2.pool.SimpleConnectionPool(
    minconn=MIN_CONN,
    maxconn=MAX_CONN,
    **DB_PARAMS,
)

RealDictCursor = psycopg2.extras.RealDictCursor


def _conn_is_open(conn) -> bool:
    return getattr(conn, "closed", 1) == 0


def get_db_connection():
    """
    Return a psycopg2 connection.

    In a Flask request:
      - reuse g._pg_conn if present and open
      - otherwise acquire from pool and stash on g._pg_conn

    Outside a request:
      - acquire from pool
      - mark _needs_putback=True so helpers can return it.
    """
    if has_request_context():
        conn = getattr(g, "_pg_conn", None)
        if conn is None or not _conn_is_open(conn):
            conn = POOL.getconn()
            conn.autocommit = False
            g._pg_conn = conn
        return conn

    conn = POOL.getconn()
    conn.autocommit = False
    setattr(conn, "_needs_putback", True)
    return conn


@contextmanager
def transaction():
    """
    Yield a RealDictCursor inside a transaction.

    - Commit on success
    - Rollback on exception
    - Return non-request connections to pool automatically.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        yield cur
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            cur.close()
        except Exception:
            pass
        if getattr(conn, "_needs_putback", False):
            try:
                POOL.putconn(conn)
            except Exception:
                pass


def _put_back_if_needed(conn):
    if getattr(conn, "_needs_putback", False):
        try:
            POOL.putconn(conn)
        except Exception:
            pass


def query_one(sql: str, params: Optional[tuple] = None):
    """
    Run a SELECT expected to return at most one row.
    Returns a dict (RealDictRow) or None.
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchone()
    finally:
        _put_back_if_needed(conn)


def query_all(sql: str, params: Optional[tuple] = None):
    """
    Run a SELECT returning multiple rows.
    Returns a list of dicts.
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        _put_back_if_needed(conn)


def execute(sql: str, params: Optional[tuple] = None, commit: bool = True):
    """
    Execute INSERT/UPDATE/DELETE.

    commit=True (default) commits immediately for standalone writes.
    For multi-step operations, use transaction() and call execute(..., commit=False)
    against the cursor provided by transaction() instead of this helper.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if commit:
                conn.commit()
    finally:
        _put_back_if_needed(conn)


def init_db_for_app(app):
    """
    Flask teardown hook to return per-request connection to pool.
    """
    @app.teardown_appcontext
    def close_pg_connection(exc):
        conn = getattr(g, "_pg_conn", None)
        if conn is not None:
            try:
                if _conn_is_open(conn):
                    POOL.putconn(conn)
            except Exception:
                pass
            finally:
                g._pg_conn = None
