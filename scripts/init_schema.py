# scripts/init_schema.py
import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "vakaadha.db"

DDL_CORE = """
PRAGMA foreign_keys = ON;

-- =========================
-- USERS & PROFILES
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE,
  firebase_uid  TEXT UNIQUE,            -- optional if using Firebase
  password_hash TEXT,                   -- nullable if using external auth
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'customer',  -- customer, admin, seller, etc.
  status        TEXT NOT NULL DEFAULT 'active',    -- active, blocked, deleted
  last_login    DATETIME,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  dob          DATE,
  gender       TEXT,
  avatar_url   TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================
-- ADDRESSES
-- =========================
CREATE TABLE IF NOT EXISTS addresses (
  address_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  full_name     TEXT,
  phone         TEXT,
  line1         TEXT NOT NULL,
  line2         TEXT,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  postal_code   TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT 'IN',
  type          TEXT NOT NULL DEFAULT 'shipping',  -- shipping | billing
  is_default    INTEGER NOT NULL DEFAULT 0,        -- 0/1
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- =========================
-- CATALOG
-- =========================
CREATE TABLE IF NOT EXISTS products (
  product_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_details (
  detail_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL,
  long_description   TEXT,
  specifications     TEXT,   -- JSON/text
  care_instructions  TEXT,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_images (
  image_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL,
  image_url     TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

CREATE TABLE IF NOT EXISTS product_variants (
  variant_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL,
  size          TEXT,
  color         TEXT,
  sku           TEXT NOT NULL UNIQUE,
  price_cents   INTEGER NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS inventory (
  variant_id    INTEGER PRIMARY KEY,
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE
);

-- =========================
-- CART
-- =========================
CREATE TABLE IF NOT EXISTS carts (
  cart_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','abandoned')),
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id       INTEGER NOT NULL,
  variant_id    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  price_cents   INTEGER NOT NULL,  -- snapshot at add time
  FOREIGN KEY(cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique ON cart_items(cart_id, variant_id);

-- =========================
-- ORDERS
-- =========================
CREATE TABLE IF NOT EXISTS orders (
  order_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  order_no        TEXT UNIQUE,  -- may be NULL initially; SQLite allows multiple NULLs in UNIQUE
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','delivered','cancelled')),
  payment_method  TEXT,
  payment_status  TEXT NOT NULL DEFAULT 'pending',
  subtotal_cents  INTEGER NOT NULL DEFAULT 0,
  shipping_cents  INTEGER NOT NULL DEFAULT 0,
  discount_cents  INTEGER NOT NULL DEFAULT 0,
  total_cents     INTEGER NOT NULL DEFAULT 0,
  shipping_address_id INTEGER,
  created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at      DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(shipping_address_id) REFERENCES addresses(address_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id       INTEGER NOT NULL,
  product_id     INTEGER NOT NULL,
  variant_id     INTEGER NOT NULL,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  price_cents    INTEGER NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS shipments (
  shipment_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id       INTEGER NOT NULL,
  carrier        TEXT,
  tracking_no    TEXT,
  status         TEXT NOT NULL DEFAULT 'created',
  created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shipment_events (
  event_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id    INTEGER NOT NULL,
  status         TEXT NOT NULL,
  message        TEXT,
  event_time     DATETIME NOT NULL,
  FOREIGN KEY(shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE
);

-- =========================
-- REVIEWS
-- =========================
CREATE TABLE IF NOT EXISTS reviews (
  review_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER NOT NULL,
  user_id        INTEGER NOT NULL,
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title          TEXT,
  body           TEXT,
  helpful_count  INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','flagged')),
  created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at     DATETIME,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);

CREATE TABLE IF NOT EXISTS review_votes (
  vote_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id      INTEGER NOT NULL,
  user_id        INTEGER NOT NULL,
  is_helpful     INTEGER NOT NULL DEFAULT 1,
  created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(review_id) REFERENCES reviews(review_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_votes_unique ON review_votes(review_id, user_id);

-- =========================
-- ATTRIBUTES / FACETS
-- =========================
CREATE TABLE IF NOT EXISTS attributes (
  attribute_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS product_attributes (
  product_id     INTEGER NOT NULL,
  attribute_id   INTEGER NOT NULL,
  value          TEXT,
  PRIMARY KEY (product_id, attribute_id),
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  FOREIGN KEY(attribute_id) REFERENCES attributes(attribute_id) ON DELETE CASCADE
);

-- =========================
-- SIZE GUIDES
-- =========================
CREATE TABLE IF NOT EXISTS size_guides (
  guide_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  category       TEXT NOT NULL,
  content        TEXT NOT NULL
);

-- =========================
-- VOUCHERS
-- =========================
CREATE TABLE IF NOT EXISTS vouchers (
  voucher_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code               TEXT NOT NULL UNIQUE,
  name               TEXT,
  description        TEXT,
  discount_type      TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  percent_off        INTEGER,              -- 1..100 when type=percent
  amount_off_cents   INTEGER,              -- when type=fixed
  min_subtotal_cents INTEGER DEFAULT 0,
  max_discount_cents INTEGER,
  starts_at          DATETIME,
  ends_at            DATETIME,
  usage_limit        INTEGER,              -- total uses across all customers
  per_user_limit     INTEGER,              -- per-user cap
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- per-product or per-category applicability
CREATE TABLE IF NOT EXISTS voucher_targets (
  target_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id     INTEGER NOT NULL,
  product_id     INTEGER,
  category       TEXT,
  FOREIGN KEY(voucher_id) REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
-- Uniqueness: either targeted by (voucher, product) or (voucher, category)
CREATE UNIQUE INDEX IF NOT EXISTS idx_voucher_target_product
  ON voucher_targets(voucher_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_voucher_target_category
  ON voucher_targets(voucher_id, category) WHERE product_id IS NULL AND category IS NOT NULL;

CREATE TABLE IF NOT EXISTS voucher_redemptions (
  redemption_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id     INTEGER NOT NULL,
  user_id        INTEGER NOT NULL,
  order_id       INTEGER,
  discount_cents INTEGER NOT NULL,
  redeemed_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(voucher_id) REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON voucher_redemptions(user_id);

-- =========================
-- WISHLIST
-- =========================
CREATE TABLE IF NOT EXISTS wishlist_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  product_id    INTEGER,   -- allow either product or variant
  variant_id    INTEGER,   -- when variant-specific wish
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE,
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE,
  CHECK (variant_id IS NOT NULL OR product_id IS NOT NULL)
);
-- Enforce uniqueness without expressions in PK/UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_user_variant
  ON wishlist_items(user_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_user_product
  ON wishlist_items(user_id, product_id) WHERE variant_id IS NULL AND product_id IS NOT NULL;
"""

# Optional FTS5 (search). Will be skipped if your SQLite doesn't support FTS5.
DDL_FTS = """
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts
USING fts5(name, description, details, content='');

CREATE TABLE IF NOT EXISTS _products_fts_src (
  product_id INTEGER PRIMARY KEY,
  name TEXT,
  description TEXT,
  details TEXT,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS trg_products_ai AFTER INSERT ON products BEGIN
  INSERT OR REPLACE INTO _products_fts_src(product_id, name, description, details)
  VALUES (new.product_id, new.name, new.description, '');
  INSERT INTO products_fts(rowid, name, description, details)
  VALUES (new.product_id, new.name, new.description, '');
END;

CREATE TRIGGER IF NOT EXISTS trg_products_au AFTER UPDATE ON products BEGIN
  UPDATE _products_fts_src SET name=new.name, description=new.description WHERE product_id=new.product_id;
  INSERT INTO products_fts(products_fts, rowid, name, description, details)
  VALUES('delete', old.product_id, '', '', '');
  INSERT INTO products_fts(rowid, name, description, details)
  VALUES (new.product_id, new.name, new.description, (SELECT details FROM _products_fts_src WHERE product_id=new.product_id));
END;

CREATE TRIGGER IF NOT EXISTS trg_products_ad AFTER DELETE ON products BEGIN
  DELETE FROM _products_fts_src WHERE product_id=old.product_id;
  INSERT INTO products_fts(products_fts, rowid, name, description, details)
  VALUES('delete', old.product_id, '', '', '');
END;

CREATE TRIGGER IF NOT EXISTS trg_details_ai AFTER INSERT ON product_details BEGIN
  UPDATE _products_fts_src SET details=COALESCE(new.long_description,'') WHERE product_id=new.product_id;
  INSERT INTO products_fts(products_fts, rowid, name, description, details)
  VALUES('delete', new.product_id, '', '', '');
  INSERT INTO products_fts(rowid, name, description, details)
  VALUES (new.product_id,
          (SELECT name FROM products WHERE product_id=new.product_id),
          (SELECT description FROM products WHERE product_id=new.product_id),
          COALESCE(new.long_description,''));
END;

CREATE TRIGGER IF NOT EXISTS trg_details_au AFTER UPDATE ON product_details BEGIN
  UPDATE _products_fts_src SET details=COALESCE(new.long_description,'') WHERE product_id=new.product_id;
  INSERT INTO products_fts(products_fts, rowid, name, description, details)
  VALUES('delete', new.product_id, '', '', '');
  INSERT INTO products_fts(rowid, name, description, details)
  VALUES (new.product_id,
          (SELECT name FROM products WHERE product_id=new.product_id),
          (SELECT description FROM products WHERE product_id=new.product_id),
          COALESCE(new.long_description,''));
END;

CREATE TRIGGER IF NOT EXISTS trg_details_ad AFTER DELETE ON product_details BEGIN
  UPDATE _products_fts_src SET details='' WHERE product_id=old.product_id;
  INSERT INTO products_fts(products_fts, rowid, name, description, details)
  VALUES('delete', old.product_id, '', '', '');
  INSERT INTO products_fts(rowid, name, description, details)
  VALUES (old.product_id,
          (SELECT name FROM products WHERE product_id=old.product_id),
          (SELECT description FROM products WHERE product_id=old.product_id),
          '');
END;
"""

SEED_SQL = """
-- Users
INSERT INTO users (email, name, role, status) VALUES
('demo@vakaadha.com','Demo User','customer','active'),
('admin@vakaadha.com','Admin User','admin','active');

INSERT INTO user_profiles (user_id, gender) VALUES
(1, 'other'),
(2, 'other');

-- Addresses
INSERT INTO addresses (user_id, full_name, phone, line1, city, state, postal_code, country, type, is_default) VALUES
(1, 'Demo User', '9000000000', '12, MG Road', 'Bengaluru', 'KA', '560001', 'IN', 'shipping', 1),
(1, 'Demo User', '9000000000', '12, MG Road', 'Bengaluru', 'KA', '560001', 'IN', 'billing', 0);

-- Catalog
INSERT INTO products (name, description, category) VALUES
('Cotton T-Shirt', 'Soft cotton tee', 'apparel'),
('Running Shoes', 'Lightweight shoes', 'footwear');

INSERT INTO product_details (product_id, long_description, specifications, care_instructions) VALUES
(1, '100% cotton tee. Breathable.', '{"material":"cotton"}', 'Machine wash cold'),
(2, 'Great for daily runs.', '{"material":"mesh"}', 'Hand wash');

INSERT INTO product_images (product_id, image_url, sort_order) VALUES
(1, 'Images/tshirt.jpg', 0),
(2, 'Images/shoes.jpg', 0);

INSERT INTO product_variants (product_id, size, color, sku, price_cents) VALUES
(1, 'M', 'Black', 'TSHIRT-M-BLK', 79900),
(1, 'L', 'Black', 'TSHIRT-L-BLK', 79900),
(2, '9', 'Blue', 'SHOE-9-BLU', 299900);

INSERT INTO inventory (variant_id, quantity) VALUES
(1, 50),(2, 30),(3, 20);

-- Cart
INSERT INTO carts (user_id, status) VALUES (1, 'active');
INSERT INTO cart_items (cart_id, variant_id, quantity, price_cents) VALUES
(1, 1, 2, 79900);

-- Order
INSERT INTO orders (user_id, order_no, status, payment_method, payment_status, subtotal_cents, shipping_cents, discount_cents, total_cents, shipping_address_id)
VALUES (1, 'ORD-1001', 'paid', 'COD', 'paid', 159800, 10000, 0, 169800, 1);

INSERT INTO order_items (order_id, product_id, variant_id, quantity, price_cents) VALUES
(1, 1, 1, 2, 79900);

INSERT INTO shipments (order_id, carrier, tracking_no, status) VALUES
(1, 'Delhivery', 'DL123456', 'shipped');

INSERT INTO shipment_events (shipment_id, status, message, event_time) VALUES
(1, 'shipped', 'Parcel departed origin facility', datetime('now'));

-- Voucher + Redemption (FKs now correctly point to users.id)
INSERT INTO vouchers (code, name, discount_type, percent_off, starts_at, ends_at, is_active)
VALUES ('WELCOME10','Welcome 10%','percent',10, datetime('now','-1 day'), datetime('now','+30 day'), 1);

INSERT INTO voucher_redemptions (voucher_id, user_id, order_id, discount_cents) VALUES
(1, 1, 1, 16980);

-- Wishlist sample
INSERT INTO wishlist_items (user_id, product_id, variant_id) VALUES
(1, 2, 3);
"""

def exec_script(con: sqlite3.Connection, sql: str):
    con.executescript(sql)

def main():
    # Fresh init: delete existing DB unless KEEP_DB=1
    if DB_PATH.exists() and os.getenv("KEEP_DB") != "1":
        try:
            os.remove(DB_PATH)
        except OSError:
            pass

    con = sqlite3.connect(DB_PATH)
    try:
        con.execute("PRAGMA foreign_keys = ON;")
        exec_script(con, DDL_CORE)

        # Optional FTS5
        try:
            exec_script(con, DDL_FTS)
        except sqlite3.OperationalError as e:
            print(f"⚠️  FTS5 not available: {e}")

        # Seed demo data
        exec_script(con, SEED_SQL)

        con.commit()
        print(f"✅ Schema initialized and seeded at {DB_PATH}")
    finally:
        con.close()

if __name__ == "__main__":
    main()
