#!/usr/bin/env python3
import psycopg2

HOST = "localhost"
PORT = "5432"
ADMIN_USER = "postgres"
ADMIN_PASSWORD = "Domain@123"
DB_NAME = "vakaadha"

SCHEMA_SQL = """
-----------------------------------------
-- PHASE 1: CORE TABLES AND INDEXES
-----------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

CREATE TABLE users (
  user_id BIGSERIAL PRIMARY KEY,
  firebase_uid TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  name TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE user_profiles (
  profile_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  dob TEXT,
  gender TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_preferences (
  preference_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, key)
);
CREATE INDEX idx_preferences_user ON user_preferences(user_id);

CREATE TABLE user_payment_methods (
  payment_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  token TEXT NOT NULL,
  last4 TEXT,
  expiry TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_user ON user_payment_methods(user_id);

CREATE TABLE payments (
  payment_txn_id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','authorized','captured','failed','refunded')),
  method TEXT,
  email TEXT,
  contact TEXT,
  refund_id TEXT,
  raw_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE products (
  product_id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector tsvector
);

CREATE INDEX idx_products_search_vector ON products USING GIN (search_vector);

CREATE TABLE product_details (
  detail_id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  long_description TEXT,
  specifications TEXT,
  care_instructions TEXT
);

CREATE TABLE product_images (
  image_id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_product_images_product ON product_images(product_id);

CREATE TABLE product_variants (
  variant_id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  size TEXT,
  color TEXT,
  sku TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_variants_product ON product_variants(product_id);

CREATE TABLE inventory (
  variant_id BIGINT PRIMARY KEY REFERENCES product_variants(variant_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0)
);

CREATE TABLE addresses (
  address_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'IN',
  type TEXT NOT NULL DEFAULT 'shipping',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_addresses_user ON addresses(user_id);
CREATE INDEX idx_addresses_default ON addresses(is_default);

CREATE TABLE carts (
  cart_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  guest_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','converted','merged','expired','archived')),
  ttl_expires_at TIMESTAMPTZ,
  merged_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_carts_user ON carts(user_id);
CREATE INDEX idx_carts_guest ON carts(guest_id);
CREATE INDEX idx_carts_status ON carts(status);
CREATE INDEX idx_carts_ttl ON carts(ttl_expires_at);

CREATE TABLE cart_items (
  cart_item_id BIGSERIAL PRIMARY KEY,
  cart_id BIGINT NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  variant_id BIGINT NOT NULL REFERENCES product_variants(variant_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_cents INTEGER NOT NULL,
  locked_price_until TIMESTAMPTZ,
  last_price_refresh TIMESTAMPTZ,
  last_stock_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, variant_id)
);

CREATE TABLE cart_audit_log (
  audit_id BIGSERIAL PRIMARY KEY,
  cart_id BIGINT NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  user_id BIGINT,
  guest_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('merge','convert','expire','archive','delete','update')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cart_audit_cart ON cart_audit_log(cart_id);
CREATE INDEX idx_cart_audit_event ON cart_audit_log(event_type);

CREATE TABLE deletion_journal (
  journal_id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id BIGINT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extra_info TEXT
);

CREATE TABLE orders (
  order_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  source_cart_id BIGINT REFERENCES carts(cart_id) ON DELETE SET NULL,
  order_no TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','shipped','delivered','cancelled')),
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  shipping_address_id BIGINT REFERENCES addresses(address_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user ON orders(user_id);

CREATE TABLE order_items (
  order_item_id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  variant_id BIGINT NOT NULL REFERENCES product_variants(variant_id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_cents INTEGER NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE shipments (
  shipment_id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  carrier TEXT,
  tracking_no TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shipment_events (
  event_id BIGSERIAL PRIMARY KEY,
  shipment_id BIGINT NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT,
  event_time TIMESTAMPTZ NOT NULL
);

CREATE TABLE reviews (
  review_id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);

CREATE TABLE review_votes (
  vote_id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

CREATE TABLE attributes (
  attribute_id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE product_attributes (
  product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  attribute_id BIGINT NOT NULL REFERENCES attributes(attribute_id) ON DELETE CASCADE,
  value TEXT,
  PRIMARY KEY (product_id, attribute_id)
);

CREATE TABLE size_guides (
  guide_id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  content TEXT NOT NULL
);

CREATE TABLE vouchers (
  voucher_id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  percent_off INTEGER,
  amount_off_cents INTEGER,
  min_subtotal_cents INTEGER DEFAULT 0,
  max_discount_cents INTEGER,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  usage_limit INTEGER,
  per_user_limit INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE voucher_targets (
  target_id BIGSERIAL PRIMARY KEY,
  voucher_id BIGINT NOT NULL REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(product_id) ON DELETE CASCADE,
  category TEXT
);

CREATE UNIQUE INDEX idx_voucher_target_product
  ON voucher_targets(voucher_id, product_id)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX idx_voucher_target_category
  ON voucher_targets(voucher_id, category)
  WHERE product_id IS NULL AND category IS NOT NULL;

CREATE TABLE voucher_redemptions (
  redemption_id BIGSERIAL PRIMARY KEY,
  voucher_id BIGINT NOT NULL REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  order_id BIGINT REFERENCES orders(order_id) ON DELETE SET NULL,
  discount_cents INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_redemptions_user ON voucher_redemptions(user_id);

CREATE TABLE wishlists (
  wishlist_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  guest_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','merged','archived')),
  ttl_expires_at TIMESTAMPTZ,
  merged_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wishlists_user ON wishlists(user_id);
CREATE INDEX idx_wishlists_guest ON wishlists(guest_id);
CREATE INDEX idx_wishlists_status_ttl ON wishlists(status, ttl_expires_at);

CREATE TABLE wishlist_items (
  wishlist_item_id BIGSERIAL PRIMARY KEY,
  wishlist_id BIGINT NOT NULL REFERENCES wishlists(wishlist_id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wishlist_id, product_id)
);
CREATE INDEX idx_wishlist_items_product ON wishlist_items(product_id);

CREATE TABLE wishlist_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  wishlist_id BIGINT REFERENCES wishlists(wishlist_id) ON DELETE CASCADE,
  user_id BIGINT,
  guest_id TEXT,
  product_id BIGINT,
  action TEXT NOT NULL CHECK (action IN ('add','remove','merge','archive','clear','status_change')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wishlist_audit_wishlist ON wishlist_audit(wishlist_id);
CREATE INDEX idx_wishlist_audit_action ON wishlist_audit(action);

-----------------------------------------
-- PHASE 2 TRIGGER FUNCTIONS
-----------------------------------------

CREATE OR REPLACE FUNCTION fn_cart_items_ai() RETURNS trigger AS $$
BEGIN
  NEW.created_at := COALESCE(NEW.created_at, NOW());
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cart_items_ai
BEFORE INSERT ON cart_items
FOR EACH ROW EXECUTE FUNCTION fn_cart_items_ai();

CREATE OR REPLACE FUNCTION fn_cart_items_au() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cart_items_au
BEFORE UPDATE ON cart_items
FOR EACH ROW EXECUTE FUNCTION fn_cart_items_au();

CREATE OR REPLACE FUNCTION fn_carts_au() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO cart_audit_log(cart_id, user_id, guest_id, event_type, message, created_at)
    VALUES (
      NEW.cart_id,
      NEW.user_id,
      NEW.guest_id,
      NEW.status,
      'Cart status change from ' || OLD.status || ' to ' || NEW.status,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_carts_au
BEFORE UPDATE ON carts
FOR EACH ROW EXECUTE FUNCTION fn_carts_au();

CREATE OR REPLACE FUNCTION fn_cart_delete_journal() RETURNS trigger AS $$
BEGIN
  INSERT INTO deletion_journal(table_name, record_id, extra_info, deleted_at)
  VALUES ('carts', OLD.cart_id, 'Cascade delete triggered by cleanup', NOW());
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cart_delete_journal
AFTER DELETE ON carts
FOR EACH ROW EXECUTE FUNCTION fn_cart_delete_journal();

CREATE OR REPLACE FUNCTION fn_wishlist_items_ai() RETURNS trigger AS $$
BEGIN
  NEW.created_at := COALESCE(NEW.created_at, NOW());
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wishlist_items_ai
BEFORE INSERT ON wishlist_items
FOR EACH ROW EXECUTE FUNCTION fn_wishlist_items_ai();

CREATE OR REPLACE FUNCTION fn_wishlist_items_au() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wishlist_items_au
BEFORE UPDATE ON wishlist_items
FOR EACH ROW EXECUTE FUNCTION fn_wishlist_items_au();

CREATE OR REPLACE FUNCTION fn_wishlists_status_change() RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO wishlist_audit (wishlist_id, user_id, guest_id, product_id, action, message, created_at)
    VALUES (
      NEW.wishlist_id,
      NEW.user_id,
      NEW.guest_id,
      NULL,
      'status_change',
      'Wishlist status changed from ' || OLD.status || ' to ' || NEW.status,
      NOW()
    );
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wishlists_status_change
BEFORE UPDATE OF status ON wishlists
FOR EACH ROW EXECUTE FUNCTION fn_wishlists_status_change();

-----------------------------------------
-- PHASE 3: FULL TEXT SEARCH TRIGGERS
-----------------------------------------

CREATE OR REPLACE FUNCTION fn_products_search_update() RETURNS trigger AS $$
DECLARE
  details_text TEXT;
BEGIN
  SELECT COALESCE(long_description,'') INTO details_text
  FROM product_details WHERE product_id = NEW.product_id;

  NEW.search_vector :=
    to_tsvector('simple',
      COALESCE(NEW.name,'') || ' ' ||
      COALESCE(NEW.description,'') || ' ' ||
      COALESCE(details_text,'')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_search_update
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION fn_products_search_update();

CREATE OR REPLACE FUNCTION fn_product_details_search_update() RETURNS trigger AS $$
BEGIN
  UPDATE products
  SET search_vector =
    to_tsvector('simple',
      COALESCE(name,'') || ' ' ||
      COALESCE(description,'') || ' ' ||
      COALESCE(NEW.long_description,'')
    )
  WHERE product_id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_details_search_update
AFTER INSERT OR UPDATE ON product_details
FOR EACH ROW EXECUTE FUNCTION fn_product_details_search_update();

CREATE OR REPLACE FUNCTION fn_product_details_search_delete() RETURNS trigger AS $$
BEGIN
  UPDATE products
  SET search_vector =
    to_tsvector('simple',
      COALESCE(name,'') || ' ' ||
      COALESCE(description,'')
    )
  WHERE product_id = OLD.product_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_details_search_delete
AFTER DELETE ON product_details
FOR EACH ROW EXECUTE FUNCTION fn_product_details_search_delete();

"""

def main():
    conn = psycopg2.connect(
        host=HOST,
        port=PORT,
        user=ADMIN_USER,
        password=ADMIN_PASSWORD,
        dbname="postgres"
    )
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute(f"DROP DATABASE IF EXISTS {DB_NAME};")
    cur.execute(f"CREATE DATABASE {DB_NAME};")

    cur.close()
    conn.close()
    conn2 = psycopg2.connect(
        host=HOST,
        port=PORT,
        user=ADMIN_USER,
        password=ADMIN_PASSWORD,
        dbname=DB_NAME
    )
    conn2.autocommit = True
    cur2 = conn2.cursor()
    cur2.execute(SCHEMA_SQL)
    cur2.close()
    conn2.close()

    # conn2 = psycopg2.connect(
    #     host=HOST,
    #     port=PORT,
    #     user=ADMIN_USER,
    #     password=ADMIN_PASSWORD,
    #     dbname=DB_NAME
    # )
    # cur2 = conn2.cursor()

    # cur2.execute(SCHEMA_SQL)
    # conn2.commit()
    # cur2.close()
    # conn2.close()

if __name__ == "__main__":
    main()
