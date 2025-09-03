
# New version
# db.py
"""
SQLite connection helper for Flask (per-request).

Features:
- One connection per request (stored in flask.g)
- Proper teardown, PRAGMAs, WAL for better local concurrency
- Dict-like rows via sqlite3.Row
- Convenience helpers (query_one, query_all, query_scalar, exists, execute, executemany)
- transaction() context manager for atomic operations
- Pagination utilities
- Optional FTS5-aware product text search with LIKE fallback
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from typing import Any, Iterable, Optional, Sequence

from flask import current_app, g


# Backwards-compatible alias expected by service.py files
def get_db():
    return get_db_connection()

# def close_db_connection(e=None):
#     """Close the database connection if it exists."""
#     db = g.pop("db", None)
#     if db is not None:
#         db.close()



# --------- Low-level: open a new connection ---------

def _connect(db_path: str) -> sqlite3.Connection:
    """
    Open a new SQLite connection with sane defaults for a web app.
    """
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

    con = sqlite3.connect(
        db_path,
        detect_types=sqlite3.PARSE_DECLTYPES,
        check_same_thread=True,  # one connection per request
    )
    con.row_factory = sqlite3.Row

    # Apply recommended PRAGMAs (per-connection)
    pragmas = [
        ("PRAGMA foreign_keys = ON;", ()),
        ("PRAGMA journal_mode = WAL;", ()),
        ("PRAGMA synchronous = NORMAL;", ()),
        ("PRAGMA busy_timeout = 5000;", ()),  # wait up to 5s on locks
        ("PRAGMA temp_store = MEMORY;", ()),
    ]
    for stmt, params in pragmas:
        try:
            con.execute(stmt, params)
        except sqlite3.Error:
            # Do not crash if a PRAGMA isn't supported in the environment
            pass

    return con


# --------- Flask integration hooks ---------

def get_db_connection() -> sqlite3.Connection:
    """
    Get the per-request connection (create if missing).
    Usage: con = get_db_connection(); cur = con.cursor(); ...
    """
    if "db" not in g:
        db_path = current_app.config.get("DATABASE_PATH", "vakaadha.db")
        g.db = _connect(db_path)
    return g.db


def close_db_connection(_: Optional[BaseException] = None) -> None:
    """
    Close and remove the per-request connection if present.
    Flask calls this on teardown_appcontext automatically.
    """
    con: Optional[sqlite3.Connection] = g.pop("db", None)
    if con is not None:
        try:
            con.close()
        except Exception:
            # Never raise during teardown
            pass


def init_db_for_app(app) -> None:
    """
    Register teardown hook and ensure DB directory exists.
    Call this once from your app factory.
    """
    db_path = app.config.get("DATABASE_PATH", "vakaadha.db")
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    app.teardown_appcontext(close_db_connection)


# --------- Convenience helpers ---------

def query_one(sql: str, params: Sequence[Any] | None = None) -> Optional[sqlite3.Row]:
    """
    Execute a SELECT that should return at most one row.
    Returns sqlite3.Row or None.
    """
    con = get_db_connection()
    cur = con.execute(sql, params or [])
    return cur.fetchone()


def query_all(sql: str, params: Sequence[Any] | None = None) -> list[sqlite3.Row]:
    """
    Execute a SELECT and return all rows as a list of sqlite3.Row.
    """
    con = get_db_connection()
    cur = con.execute(sql, params or [])
    return cur.fetchall()


def query_scalar(sql: str, params: Sequence[Any] | None = None) -> Any:
    """
    Execute a SELECT and return the first column of the first row, or None.
    """
    row = query_one(sql, params)
    if row is None:
        return None
    # sqlite3.Row supports index access
    return row[0]


def exists(sql: str, params: Sequence[Any] | None = None) -> bool:
    """
    Return True if the given SELECT returns at least one row.
    """
    return query_one(sql, params) is not None


def execute(sql: str, params: Sequence[Any] | None = None) -> int:
    """
    Execute an INSERT/UPDATE/DELETE and COMMIT immediately.
    Returns lastrowid for INSERTs when available, else rowcount.
    """
    con = get_db_connection()
    cur = con.execute(sql, params or [])
    last_id = cur.lastrowid
    con.commit()
    return last_id if last_id else cur.rowcount


def executemany(sql: str, seq_of_params: Iterable[Sequence[Any]]) -> int:
    """
    Execute many INSERT/UPDATE/DELETE statements and COMMIT.
    Returns total rowcount.
    """
    con = get_db_connection()
    cur = con.executemany(sql, seq_of_params)
    con.commit()
    return cur.rowcount


@contextmanager
def transaction():
    """
    Transaction context manager for atomic flows.
    Usage:
        with transaction() as con:
            con.execute(...)
            con.execute(...)
    On exception: ROLLBACK; else: COMMIT.
    """
    con = get_db_connection()
    try:
        con.execute("BEGIN")
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise


# --------- Utilities ---------

def paginate(page: int, page_size: int) -> tuple[int, int]:
    """
    Compute offset/limit from page/page_size (1-based page).
    Returns (limit, offset).
    """
    page = max(1, int(page or 1))
    page_size = max(1, min(int(page_size or 24), 200))  # cap page_size
    offset = (page - 1) * page_size
    return page_size, offset


def to_dict(row: sqlite3.Row | None) -> Optional[dict[str, Any]]:
    """
    Convert sqlite3.Row to a plain dict.
    """
    return {k: row[k] for k in row.keys()} if row else None


def to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    """
    Convert an iterable of sqlite3.Row to a list of dicts.
    """
    return [{k: r[k] for k in r.keys()} for r in rows]


# --------- Optional: FTS5-aware product text search ---------

def _fts_available(con: Optional[sqlite3.Connection] = None) -> bool:
    """
    Check whether the products_fts virtual table exists.
    """
    con = con or get_db_connection()
    row = con.execute(
        "SELECT 1 FROM sqlite_master WHERE name='products_fts' AND (type='table' OR sql LIKE 'CREATE VIRTUAL TABLE%')"
    ).fetchone()
    return row is not None


def search_products_text(
    q: str, limit: int = 24, offset: int = 0
) -> list[sqlite3.Row]:
    """
    Full-text search over products; prefers FTS5 if available,
    otherwise falls back to LIKE on name/description/long_description.

    Returns rows with at least: product_id, name, description.
    """
    con = get_db_connection()
    limit = max(1, min(int(limit or 24), 200))
    offset = max(0, int(offset or 0))

    if _fts_available(con):
        # Use FTS5; order by bm25() if available (typical in FTS5 builds)
        # rowid of products_fts is products.product_id
        sql = """
        SELECT p.product_id, p.name, p.description, p.category
        FROM products_fts f
        JOIN products p ON p.product_id = f.rowid
        WHERE f MATCH ?
        ORDER BY bm25(f)
        LIMIT ? OFFSET ?;
        """
        return query_all(sql, (q, limit, offset))
    else:
        like = f"%{q}%"
        sql = """
        SELECT p.product_id, p.name, p.description, p.category
        FROM products p
        LEFT JOIN product_details pd ON pd.product_id = p.product_id
        WHERE p.name LIKE ? OR IFNULL(p.description,'') LIKE ? OR IFNULL(pd.long_description,'') LIKE ?
        LIMIT ? OFFSET ?;
        """
        return query_all(sql, (like, like, like, limit, offset))
