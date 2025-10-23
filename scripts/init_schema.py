# scripts/init_schema.py
import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "vakaadha.db"

DDL_CORE = """
PRAGMA foreign_keys = ON;

-- =========================
-- USERS, PROFILES & PREFERENCES
-- =========================
CREATE TABLE IF NOT EXISTS users (
  user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid  TEXT NOT NULL UNIQUE,
  email         TEXT UNIQUE,
  name          TEXT,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  last_login    DATETIME
);

CREATE TABLE IF NOT EXISTS user_profiles (
  profile_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL UNIQUE,
  dob           TEXT,
  gender        TEXT,
  avatar_url    TEXT,
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =========================
-- USER PREFERENCES
-- =========================
CREATE TABLE IF NOT EXISTS user_preferences (
  preference_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  key            TEXT NOT NULL,
  value          TEXT,
  created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE(user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);

-- =========================
-- USER PAYMENT METHODS
-- =========================
CREATE TABLE IF NOT EXISTS user_payment_methods (
  payment_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  provider       TEXT NOT NULL,               -- e.g., 'stripe', 'razorpay', 'paypal'
  token          TEXT NOT NULL,               -- opaque token from payment gateway
  last4          TEXT,                        -- last 4 digits for display
  expiry         TEXT,                        -- e.g. '12/27'
  is_default     INTEGER NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON user_payment_methods(user_id);


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
  type          TEXT NOT NULL DEFAULT 'shipping',
  is_default    INTEGER NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- =========================
-- CATALOG (unchanged)
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
  specifications     TEXT,
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
  user_id       INTEGER UNIQUE,
  guest_id      TEXT UNIQUE,
  status        TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN (
                   'active',       -- currently in use
                   'converted',    -- checked out successfully
                   'merged',       -- merged into user cart
                   'expired',      -- TTL exceeded
                   'archived'      -- long-term retention
                 )),
  ttl_expires_at DATETIME,                  -- computed expiry timestamp for guests
  merged_at      DATETIME,                  -- when guest cart was merged
  converted_at   DATETIME,                  -- when order was placed
  created_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at     DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_guest ON carts(guest_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);
CREATE INDEX IF NOT EXISTS idx_carts_ttl ON carts(ttl_expires_at);

-- =========================
-- CART ITEMS 
-- =========================
CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id       INTEGER NOT NULL,
  variant_id    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  price_cents   INTEGER NOT NULL,
  locked_price_until DATETIME,   -- price validity window (24h or until refresh)
  last_price_refresh DATETIME,   -- last time price was verified
  last_stock_check   DATETIME,   -- last time stock was validated
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique ON cart_items(cart_id, variant_id);

-- =========================
-- CART AUDIT LOG
-- =========================
CREATE TABLE IF NOT EXISTS cart_audit_log (
  audit_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id       INTEGER NOT NULL,
  user_id       INTEGER,
  guest_id      TEXT,
  event_type    TEXT NOT NULL CHECK (event_type IN ('merge','convert','expire','archive','delete','update')),
  message       TEXT,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cart_audit_cart ON cart_audit_log(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_audit_event ON cart_audit_log(event_type);

-- =========================
-- DELETION JOURNAL (for compliance)
-- =========================
CREATE TABLE IF NOT EXISTS deletion_journal (
  journal_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name    TEXT NOT NULL,
  record_id     INTEGER,
  deleted_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  extra_info    TEXT
);




-- =========================
-- ORDERS
-- =========================
CREATE TABLE IF NOT EXISTS orders (
  order_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  source_cart_id  INTEGER REFERENCES carts(cart_id) ON DELETE SET NULL;
  order_no        TEXT UNIQUE,
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
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
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
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
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
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
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
  percent_off        INTEGER,
  amount_off_cents   INTEGER,
  min_subtotal_cents INTEGER DEFAULT 0,
  max_discount_cents INTEGER,
  starts_at          DATETIME,
  ends_at            DATETIME,
  usage_limit        INTEGER,
  per_user_limit     INTEGER,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voucher_targets (
  target_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id     INTEGER NOT NULL,
  product_id     INTEGER,
  category       TEXT,
  FOREIGN KEY(voucher_id) REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
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
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON voucher_redemptions(user_id);

-- =========================
-- WISHLIST (Simplified: product-level only, no variant required)
-- =========================

CREATE TABLE IF NOT EXISTS wishlist_items (
  wishlist_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  guest_id    TEXT,
  product_id  INTEGER NOT NULL,
  variant_id  INTEGER, -- optional for future use
  created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE,

  CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

-- Deduplication rules — one wishlist entry per product per user/guest
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_user_product
  ON wishlist_items(user_id, product_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_guest_product
  ON wishlist_items(guest_id, product_id)
  WHERE guest_id IS NOT NULL;

-- Lookup optimization
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_guest ON wishlist_items(guest_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product ON wishlist_items(product_id);

-- =========================
-- WISHLIST AUDIT LOG (still optional but compatible)
-- =========================

CREATE TABLE IF NOT EXISTS wishlist_audit (
  audit_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER,
  guest_id     TEXT,
  product_id   INTEGER,
  action       TEXT NOT NULL CHECK (action IN ('add','remove','move_to_cart')),
  timestamp    DATETIME NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wishlist_audit_user ON wishlist_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_audit_guest ON wishlist_audit(guest_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_audit_action ON wishlist_audit(action);

"""

# Full-text search triggers (unchanged)
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

-- =========================
-- CART TRIGGERS (timestamps + auditing)
-- =========================
CREATE TRIGGER IF NOT EXISTS trg_cart_items_au
AFTER UPDATE ON cart_items
BEGIN
  UPDATE cart_items
  SET updated_at = datetime('now')
  WHERE cart_item_id = old.cart_item_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_cart_items_ai
AFTER INSERT ON cart_items
BEGIN
  UPDATE cart_items
  SET created_at = COALESCE(created_at, datetime('now')),
      updated_at = datetime('now')
  WHERE cart_item_id = new.cart_item_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_carts_au
AFTER UPDATE ON carts
BEGIN
  UPDATE carts
  SET updated_at = datetime('now')
  WHERE cart_id = new.cart_id;

  INSERT INTO cart_audit_log (cart_id, user_id, guest_id, event_type, message)
  SELECT
    new.cart_id,
    new.user_id,
    new.guest_id,
    CASE
      WHEN old.status != new.status THEN new.status
      ELSE 'update'
    END,
    'Cart status change from ' || old.status || ' → ' || new.status
  WHERE old.status != new.status;
END;

CREATE TRIGGER IF NOT EXISTS trg_cart_delete_journal
AFTER DELETE ON carts
BEGIN
  INSERT INTO deletion_journal (table_name, record_id, extra_info)
  VALUES ('carts', old.cart_id, 'Cascade delete triggered by user/cart cleanup');
END;

-- =========================
-- WISHLIST TRIGGERS
-- =========================

CREATE TRIGGER IF NOT EXISTS trg_wishlist_items_au
AFTER UPDATE ON wishlist_items
BEGIN
  UPDATE wishlist_items
  SET updated_at = datetime('now')
  WHERE wishlist_item_id = old.wishlist_item_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_wishlist_items_ai
AFTER INSERT ON wishlist_items
BEGIN
  UPDATE wishlist_items
  SET created_at = COALESCE(created_at, datetime('now')),
      updated_at = datetime('now')
  WHERE wishlist_item_id = new.wishlist_item_id;
END;

"""

def exec_script(con: sqlite3.Connection, sql: str):
    con.executescript(sql)

def main():
    if DB_PATH.exists() and os.getenv("KEEP_DB") != "1":
        try:
            os.remove(DB_PATH)
        except OSError:
            pass

    con = sqlite3.connect(DB_PATH)
    try:
        con.execute("PRAGMA foreign_keys = ON;")
        exec_script(con, DDL_CORE)
        try:
            exec_script(con, DDL_FTS)
        except sqlite3.OperationalError as e:
            print(f"⚠️  FTS5 not available: {e}")
        con.commit()
        print(f"✅ Schema initialized at {DB_PATH}")
    finally:
        con.close()

if __name__ == "__main__":
    main()
