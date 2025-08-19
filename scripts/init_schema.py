# scripts/init_schema.py
import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "vakaadha.db"

DDL = """
PRAGMA foreign_keys = ON;

-- users
CREATE TABLE IF NOT EXISTS users (
  user_id       INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  firebase_uid  TEXT UNIQUE,
  name          TEXT,
  is_admin      INTEGER NOT NULL DEFAULT 0, -- 0=false, 1=true
  created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- products
CREATE TABLE IF NOT EXISTS products (
  product_id    INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  image_url     TEXT, -- DEPRECATED
  created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- product_variants
CREATE TABLE IF NOT EXISTS product_variants (
  variant_id    INTEGER PRIMARY KEY,
  product_id    INTEGER NOT NULL,
  size          TEXT,
  color         TEXT,
  sku           TEXT NOT NULL UNIQUE,
  price_cents   INTEGER NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- inventory
CREATE TABLE IF NOT EXISTS inventory (
  variant_id    INTEGER PRIMARY KEY,
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE
);

-- carts
CREATE TABLE IF NOT EXISTS carts (
  cart_id       INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','abandoned')),
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id  INTEGER PRIMARY KEY,
  cart_id       INTEGER NOT NULL,
  variant_id    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  FOREIGN KEY(cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  order_id      INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('placed','paid','shipped','cancelled','refunded')),
  total_cents   INTEGER NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at);

-- order_items
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id     INTEGER PRIMARY KEY,
  order_id          INTEGER NOT NULL,
  variant_id        INTEGER NOT NULL,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents  INTEGER NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- wishlist
CREATE TABLE IF NOT EXISTS wishlist (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  product_id    INTEGER NOT NULL,
  UNIQUE(user_id, product_id),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_product ON wishlist(user_id, product_id);

-- addresses
CREATE TABLE IF NOT EXISTS addresses (
  address_id    INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('billing','shipping')),
  line1         TEXT NOT NULL,
  line2         TEXT,
  city          TEXT NOT NULL,
  state         TEXT,
  zip           TEXT,
  country       TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- product_images
CREATE TABLE IF NOT EXISTS product_images (
  image_id      INTEGER PRIMARY KEY,
  product_id    INTEGER NOT NULL,
  variant_id    INTEGER,
  role          TEXT NOT NULL CHECK (role IN ('main','gallery','thumb','medium')),
  storage_key   TEXT NOT NULL UNIQUE,
  original_filename TEXT,
  alt_text      TEXT,
  width         INTEGER,
  height        INTEGER,
  mime_type     TEXT,
  size_bytes    INTEGER,
  checksum_sha256 TEXT,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_variant ON product_images(variant_id);
"""

def main():
    os.makedirs(DB_PATH.parent, exist_ok=True)
    con = sqlite3.connect(str(DB_PATH))
    try:
        con.executescript(DDL)
        con.commit()
        print(f"✅ Schema initialized at {DB_PATH}")
    finally:
        con.close()

if __name__ == "__main__":
    main()
