# scripts/init_schema.py
import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "vakaadha.db"

DDL_CORE = """
PRAGMA foreign_keys = ON;

-- ===== Existing core (kept) + pragmatic indexes =====

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
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_variants_product        ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_price          ON product_variants(price_cents);
CREATE INDEX IF NOT EXISTS idx_variants_color          ON product_variants(color);
CREATE INDEX IF NOT EXISTS idx_variants_size           ON product_variants(size);
CREATE INDEX IF NOT EXISTS idx_variants_prod_price     ON product_variants(product_id, price_cents);
CREATE INDEX IF NOT EXISTS idx_variants_prod_color_sz  ON product_variants(product_id, color, size);

-- inventory
CREATE TABLE IF NOT EXISTS inventory (
  variant_id    INTEGER PRIMARY KEY,
  quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- carts
CREATE TABLE IF NOT EXISTS carts (
  cart_id       INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','abandoned')),
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- cart_items
CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id  INTEGER PRIMARY KEY,
  cart_id       INTEGER NOT NULL,
  variant_id    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  FOREIGN KEY(cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart    ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON cart_items(variant_id);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  order_id      INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('placed','paid','shipped','cancelled','refunded')),
  total_cents   INTEGER NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at);

-- order_items
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id     INTEGER PRIMARY KEY,
  order_id          INTEGER NOT NULL,
  variant_id        INTEGER NOT NULL,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents  INTEGER NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- wishlist
CREATE TABLE IF NOT EXISTS wishlist (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL,
  product_id    INTEGER NOT NULL,
  UNIQUE(user_id, product_id),
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE
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
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
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
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(variant_id) REFERENCES product_variants(variant_id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_variant ON product_images(variant_id);

-- ===== New tables =====

-- Rich product details
CREATE TABLE IF NOT EXISTS product_details (
  product_id        INTEGER PRIMARY KEY,
  long_description  TEXT,
  specs_json        TEXT,
  care_html         TEXT,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Faceted attributes
CREATE TABLE IF NOT EXISTS attributes (
  attribute_id  INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS product_attributes (
  product_id    INTEGER NOT NULL,
  attribute_id  INTEGER NOT NULL,
  value         TEXT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(product_id, attribute_id, value),
  FOREIGN KEY(product_id)   REFERENCES products(product_id)   ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(attribute_id) REFERENCES attributes(attribute_id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_prod_attrs_attr_val ON product_attributes(attribute_id, value);
CREATE INDEX IF NOT EXISTS idx_prod_attrs_product   ON product_attributes(product_id);

-- Reviews + votes
CREATE TABLE IF NOT EXISTS reviews (
  review_id     INTEGER PRIMARY KEY,
  product_id    INTEGER NOT NULL,
  user_id       INTEGER NOT NULL,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title         TEXT,
  body          TEXT,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('visible','hidden','pending')),
  created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, user_id),
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(user_id)    REFERENCES users(user_id)    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_product_created ON reviews(product_id, created_at);

CREATE TABLE IF NOT EXISTS review_votes (
  review_id   INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  vote        INTEGER NOT NULL CHECK (vote IN (-1,1)),
  created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(review_id, user_id),
  FOREIGN KEY(review_id) REFERENCES reviews(review_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(user_id)   REFERENCES users(user_id)    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TRIGGER IF NOT EXISTS trg_review_votes_ai
AFTER INSERT ON review_votes
BEGIN
  UPDATE reviews SET helpful_count = helpful_count + NEW.vote WHERE review_id = NEW.review_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_review_votes_ad
AFTER DELETE ON review_votes
BEGIN
  UPDATE reviews SET helpful_count = helpful_count - OLD.vote WHERE review_id = OLD.review_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_review_votes_au
AFTER UPDATE ON review_votes
BEGIN
  UPDATE reviews SET helpful_count = helpful_count + NEW.vote - OLD.vote WHERE review_id = NEW.review_id;
END;

-- Size guides
CREATE TABLE IF NOT EXISTS size_guides (
  guide_id    INTEGER PRIMARY KEY,
  category    TEXT,
  product_id  INTEGER UNIQUE,
  title       TEXT NOT NULL,
  html        TEXT NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_size_guides_category
  ON size_guides(category)
  WHERE category IS NOT NULL AND product_id IS NULL;

-- Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
  voucher_id          INTEGER PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  kind                TEXT NOT NULL CHECK (kind IN ('percent','fixed')),
  value_cents         INTEGER NOT NULL CHECK (
                          (kind='fixed'   AND value_cents > 0) OR
                          (kind='percent' AND value_cents BETWEEN 1 AND 100)
                        ),
  min_cart_cents      INTEGER NOT NULL DEFAULT 0 CHECK (min_cart_cents >= 0),
  starts_at           DATETIME,
  ends_at             DATETIME,
  max_uses            INTEGER,
  max_uses_per_user   INTEGER,
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS voucher_products (
  voucher_id  INTEGER NOT NULL,
  product_id  INTEGER NOT NULL,
  PRIMARY KEY(voucher_id, product_id),
  FOREIGN KEY(voucher_id) REFERENCES vouchers(voucher_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(product_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS voucher_categories (
  voucher_id  INTEGER NOT NULL,
  category    TEXT NOT NULL,
  PRIMARY KEY(voucher_id, category),
  FOREIGN KEY(voucher_id) REFERENCES vouchers(voucher_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id         INTEGER PRIMARY KEY,
  voucher_id INTEGER NOT NULL,
  user_id    INTEGER,
  order_id   INTEGER NOT NULL,
  used_at    DATETIME NOT NULL DEFAULT (datetime('now')),
  UNIQUE(voucher_id, user_id, order_id),
  FOREIGN KEY(voucher_id) REFERENCES vouchers(voucher_id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY(user_id)    REFERENCES users(user_id)    ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY(order_id)   REFERENCES orders(order_id)  ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_vr_voucher_order ON voucher_redemptions(voucher_id, order_id);

-- Shipments & events
CREATE TABLE IF NOT EXISTS shipments (
  shipment_id  INTEGER PRIMARY KEY,
  order_id     INTEGER NOT NULL,
  carrier      TEXT NOT NULL,
  tracking_no  TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL CHECK (status IN ('label','in_transit','out_for_delivery','delivered','exception')),
  created_at   DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at   DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);

CREATE TABLE IF NOT EXISTS shipment_events (
  id           INTEGER PRIMARY KEY,
  shipment_id  INTEGER NOT NULL,
  status       TEXT NOT NULL,
  note         TEXT,
  event_time   DATETIME NOT NULL,
  FOREIGN KEY(shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_time ON shipment_events(shipment_id, event_time);
"""

# ---- FTS5 with proper contentless "delete" operations ----
DDL_FTS = """
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts
USING fts5(name, description, long_description, content='');

-- Products
CREATE TRIGGER IF NOT EXISTS trg_products_ai_fts AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, name, description, long_description)
  VALUES (NEW.product_id, NEW.name, NEW.description,
          COALESCE((SELECT long_description FROM product_details WHERE product_id = NEW.product_id), ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_products_au_fts AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid) VALUES('delete', OLD.product_id);
  INSERT INTO products_fts(rowid, name, description, long_description)
  VALUES (NEW.product_id, NEW.name, NEW.description,
          COALESCE((SELECT long_description FROM product_details WHERE product_id = NEW.product_id), ''));
END;

CREATE TRIGGER IF NOT EXISTS trg_products_ad_fts AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid) VALUES('delete', OLD.product_id);
END;

-- Product details (insert/update)
CREATE TRIGGER IF NOT EXISTS trg_prod_details_ai_fts AFTER INSERT ON product_details BEGIN
  INSERT INTO products_fts(products_fts, rowid) VALUES('delete', NEW.product_id);
  INSERT INTO products_fts(rowid, name, description, long_description)
  SELECT p.product_id, p.name, p.description, COALESCE(NEW.long_description,'')
  FROM products p WHERE p.product_id = NEW.product_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_prod_details_au_fts AFTER UPDATE ON product_details BEGIN
  INSERT INTO products_fts(products_fts, rowid) VALUES('delete', NEW.product_id);
  INSERT INTO products_fts(rowid, name, description, long_description)
  SELECT p.product_id, p.name, p.description, COALESCE(NEW.long_description,'')
  FROM products p WHERE p.product_id = NEW.product_id;
END;

-- Backfill only once
INSERT INTO products_fts(rowid, name, description, long_description)
SELECT p.product_id, p.name, p.description, COALESCE(pd.long_description,'')
FROM products p
LEFT JOIN product_details pd USING(product_id)
WHERE NOT EXISTS (SELECT 1 FROM products_fts LIMIT 1);
"""

SEED_SQL = """
-- Demo user
INSERT INTO users(email, name, is_admin)
SELECT 'demo@local', 'Demo User', 0
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='demo@local');

-- Products
INSERT INTO products(name, description, category, image_url)
SELECT 'Classic Tee', 'Soft cotton tee for everyday wear', 'apparel', '/media/classic-tee.jpg'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Classic Tee');

INSERT INTO products(name, description, category, image_url)
SELECT 'Stainless Bottle', 'Insulated bottle (750ml)', 'accessories', '/media/bottle.jpg'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Stainless Bottle');

-- Details
INSERT INTO product_details(product_id, long_description, specs_json, care_html)
SELECT p.product_id,
       'Our Classic Tee uses long-staple cotton for softness and durability.',
       '{"Material":"100% Cotton","Fit":"Regular","Weight":"180gsm"}',
       '<p>Machine wash cold. Do not bleach. Tumble dry low.</p>'
FROM products p WHERE p.name='Classic Tee'
  AND NOT EXISTS (SELECT 1 FROM product_details pd WHERE pd.product_id=p.product_id);

-- Attributes
INSERT OR IGNORE INTO attributes(name) VALUES ('brand'),('material'),('fit'),('bottle_volume');

INSERT OR IGNORE INTO product_attributes(product_id, attribute_id, value)
SELECT p.product_id, a.attribute_id, 'Vakaadha'
FROM products p JOIN attributes a ON a.name='brand'
WHERE p.name IN ('Classic Tee','Stainless Bottle');

INSERT OR IGNORE INTO product_attributes(product_id, attribute_id, value)
SELECT p.product_id, a.attribute_id, '100% Cotton'
FROM products p JOIN attributes a ON a.name='material'
WHERE p.name='Classic Tee';

INSERT OR IGNORE INTO product_attributes(product_id, attribute_id, value)
SELECT p.product_id, a.attribute_id, 'Regular'
FROM products p JOIN attributes a ON a.name='fit'
WHERE p.name='Classic Tee';

INSERT OR IGNORE INTO product_attributes(product_id, attribute_id, value)
SELECT p.product_id, a.attribute_id, '750ml'
FROM products p JOIN attributes a ON a.name='bottle_volume'
WHERE p.name='Stainless Bottle';

-- Variants
INSERT INTO product_variants(product_id, size, color, sku, price_cents)
SELECT p.product_id, 'S', 'Black', 'TEE-CLSC-BLK-S', 1999
FROM products p WHERE p.name='Classic Tee'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku='TEE-CLSC-BLK-S');

INSERT INTO product_variants(product_id, size, color, sku, price_cents)
SELECT p.product_id, 'M', 'White', 'TEE-CLSC-WHT-M', 1999
FROM products p WHERE p.name='Classic Tee'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku='TEE-CLSC-WHT-M');

INSERT INTO product_variants(product_id, size, color, sku, price_cents)
SELECT p.product_id, NULL, 'Steel', 'BOTTLE-STEEL-750', 3499
FROM products p WHERE p.name='Stainless Bottle'
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.sku='BOTTLE-STEEL-750');

-- Inventory
INSERT OR IGNORE INTO inventory(variant_id, quantity)
SELECT v.variant_id, 25 FROM product_variants v WHERE v.sku='TEE-CLSC-BLK-S';
INSERT OR IGNORE INTO inventory(variant_id, quantity)
SELECT v.variant_id, 30 FROM product_variants v WHERE v.sku='TEE-CLSC-WHT-M';
INSERT OR IGNORE INTO inventory(variant_id, quantity)
SELECT v.variant_id, 15 FROM product_variants v WHERE v.sku='BOTTLE-STEEL-750';

-- Size guide
INSERT INTO size_guides(category, product_id, title, html)
SELECT 'apparel', NULL, 'Tops Size Guide',
       '<h3>Tops</h3><p>Measure chest at fullest part. If between sizes, size up.</p>'
WHERE NOT EXISTS (SELECT 1 FROM size_guides WHERE category='apparel' AND product_id IS NULL);

-- Voucher
INSERT INTO vouchers(code, kind, value_cents, min_cart_cents, starts_at, active)
SELECT 'WELCOME10', 'percent', 10, 0, datetime('now','-1 day'), 1
WHERE NOT EXISTS (SELECT 1 FROM vouchers WHERE code='WELCOME10');

INSERT OR IGNORE INTO voucher_categories(voucher_id, category)
SELECT v.voucher_id, 'apparel' FROM vouchers v WHERE v.code='WELCOME10';

-- Demo order
INSERT INTO orders(user_id, status, total_cents, created_at, updated_at, order_no)
SELECT u.user_id, 'paid',
       (SELECT price_cents FROM product_variants WHERE sku='TEE-CLSC-BLK-S'),
       datetime('now','-1 day'), datetime('now','-1 day'), 'VA-10001'
FROM users u WHERE u.email='demo@local'
  AND NOT EXISTS (SELECT 1 FROM orders WHERE order_no='VA-10001');

INSERT INTO order_items(order_id, variant_id, quantity, unit_price_cents)
SELECT o.order_id, v.variant_id, 1, v.price_cents
FROM orders o, product_variants v
WHERE o.order_no='VA-10001' AND v.sku='TEE-CLSC-BLK-S'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id=o.order_id AND oi.variant_id=v.variant_id);

-- Shipment + events
INSERT INTO shipments(order_id, carrier, tracking_no, status, created_at, updated_at)
SELECT o.order_id, 'UPS', 'TRACK123456US', 'in_transit', datetime('now','-2 days'), datetime('now','-1 day')
FROM orders o WHERE o.order_no='VA-10001'
  AND NOT EXISTS (SELECT 1 FROM shipments s WHERE s.tracking_no='TRACK123456US');

INSERT INTO shipment_events(shipment_id, status, note, event_time)
SELECT s.shipment_id, 'label', 'Label created', datetime('now','-2 days')
FROM shipments s WHERE s.tracking_no='TRACK123456US'
  AND NOT EXISTS (SELECT 1 FROM shipment_events e WHERE e.shipment_id=s.shipment_id AND e.status='label');

INSERT INTO shipment_events(shipment_id, status, note, event_time)
SELECT s.shipment_id, 'in_transit', 'Departed origin facility', datetime('now','-1 days')
FROM shipments s WHERE s.tracking_no='TRACK123456US'
  AND NOT EXISTS (SELECT 1 FROM shipment_events e WHERE e.shipment_id=s.shipment_id AND e.status='in_transit');

-- Voucher redemption
INSERT INTO voucher_redemptions(voucher_id, user_id, order_id, used_at)
SELECT v.voucher_id, o.user_id, o.order_id, datetime('now','-1 day')
FROM vouchers v JOIN orders o ON o.order_no='VA-10001'
WHERE v.code='WELCOME10'
  AND NOT EXISTS (SELECT 1 FROM voucher_redemptions vr WHERE vr.voucher_id=v.voucher_id AND vr.order_id=o.order_id);
"""

# ---------- helpers ----------

def get_columns(con: sqlite3.Connection, table: str) -> set[str]:
    cur = con.execute(f'PRAGMA table_info("{table}")')
    return {row[1] for row in cur.fetchall()}

def add_column_if_missing(con: sqlite3.Connection, table: str, column: str, coltype_sql: str):
    cols = get_columns(con, table)
    if column not in cols:
        con.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {coltype_sql}')

def index_exists(con: sqlite3.Connection, name: str) -> bool:
    row = con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='index' AND name=?",
        (name,)
    ).fetchone()
    return row is not None

def create_index_if_missing(con: sqlite3.Connection, name: str, sql: str):
    if not index_exists(con, name):
        con.execute(sql)

def exec_script(con: sqlite3.Connection, sql: str):
    if sql:
        con.executescript(sql)

def main():
    os.makedirs(DB_PATH.parent, exist_ok=True)
    con = sqlite3.connect(str(DB_PATH))
    con.execute("PRAGMA foreign_keys = ON;")
    try:
        with con:  # transactional
            exec_script(con, DDL_CORE)

            # Repair bad prior attempt where a column literally named "TEXT" exists
            cols = get_columns(con, "orders")
            if "order_no" not in cols and "TEXT" in cols:
                try:
                    con.execute('ALTER TABLE "orders" RENAME COLUMN "TEXT" TO "order_no"')
                except sqlite3.OperationalError as e:
                    print(f'⚠️  Could not rename mistaken column TEXT → order_no: {e}')

            # Additive column for public order tracking (correct)
            add_column_if_missing(con, "orders", "order_no", "TEXT")

            # Partial-unique index on non-NULL order_no
            create_index_if_missing(
                con,
                "idx_orders_order_no",
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no) WHERE order_no IS NOT NULL;"
            )

            # Optional FTS5 (skip gracefully if not available)
            try:
                exec_script(con, DDL_FTS)
            except sqlite3.OperationalError as e:
                print(f"⚠️  FTS5 not available: {e}")

            # Seed demo data
            exec_script(con, SEED_SQL)

        print(f"✅ Schema initialized at {DB_PATH}")
    finally:
        con.close()

if __name__ == "__main__":
    main()
