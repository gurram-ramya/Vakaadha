# db.py
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'vakaadha.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_db_connection():
    conn = sqlite3.connect('vakaadha.db')
    conn.row_factory = sqlite3.Row  # Enables dict-like access
    return conn

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()

    # Users table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            is_admin BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Products table
    # cur.execute('''
    #     CREATE TABLE IF NOT EXISTS products (
    #         product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    #         name TEXT,
    #         description TEXT,
    #         category TEXT,
    #         price REAL,
    #         image_url TEXT,
    #         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    #     )
    # ''')

    # Inventory table
    # cur.execute('''
    #     CREATE TABLE IF NOT EXISTS inventory (
    #         sku_id INTEGER PRIMARY KEY AUTOINCREMENT,
    #         product_id INTEGER,
    #         size TEXT,
    #         color TEXT,
    #         quantity INTEGER,
    #         FOREIGN KEY(product_id) REFERENCES products(product_id)
    #     )
    # ''')
    # Products table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS products (
            product_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            price REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Inventory table (updated)
    cur.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            sku_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            size TEXT,
            color TEXT,
            quantity INTEGER,
            image_name TEXT, -- NEW
            FOREIGN KEY(product_id) REFERENCES products(product_id)
        )
    ''')
        

    # Cart table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS cart (
            cart_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            sku_id INTEGER,
            quantity INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(user_id),
            FOREIGN KEY(sku_id) REFERENCES inventory(sku_id)
        )
    ''')

    # Orders table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            order_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            total_amount REAL,
            status TEXT,
            order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(user_id)
        )
    ''')

    # Order Items table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            sku_id INTEGER,
            quantity INTEGER,
            price REAL,
            FOREIGN KEY(order_id) REFERENCES orders(order_id),
            FOREIGN KEY(sku_id) REFERENCES inventory(sku_id)
        )
    ''')

    #wishlist table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS wishlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            product_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(user_id),
            FOREIGN KEY(product_id) REFERENCES products(product_id)
        )
    ''')

    conn.commit()
    conn.close()
