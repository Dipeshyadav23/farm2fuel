from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'farm2fuel.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript('''
        CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            farmer_name TEXT NOT NULL,
            location TEXT NOT NULL,
            waste_type TEXT NOT NULL,
            quantity_kg REAL NOT NULL,
            price_per_kg REAL NOT NULL,
            status TEXT DEFAULT 'available',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL,
            buyer_name TEXT NOT NULL,
            company TEXT NOT NULL,
            quantity_kg REAL NOT NULL,
            total_price REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (listing_id) REFERENCES listings(id)
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            location TEXT,
            phone TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
    ''')
    # Seed some data
    c.execute("SELECT COUNT(*) FROM listings")
    if c.fetchone()[0] == 0:
        seeds = [
            ('Rajesh Kumar', 'Ludhiana, Punjab', 'Rice Straw', 5000, 1.2),
            ('Gurpreet Singh', 'Amritsar, Punjab', 'Wheat Stubble', 8000, 1.5),
            ('Mohan Lal', 'Karnal, Haryana', 'Sugarcane Husk', 3000, 2.0),
            ('Suresh Patel', 'Anand, Gujarat', 'Cotton Stalks', 4500, 1.8),
            ('Ramesh Yadav', 'Patna, Bihar', 'Rice Husk', 6000, 0.9),
        ]
        c.executemany("INSERT INTO listings (farmer_name, location, waste_type, quantity_kg, price_per_kg) VALUES (?,?,?,?,?)", seeds)
    conn.commit()
    conn.close()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/listings', methods=['GET'])
def get_listings():
    conn = get_db()
    waste_type = request.args.get('waste_type', '')
    location = request.args.get('location', '')
    query = "SELECT * FROM listings WHERE status='available'"
    params = []
    if waste_type:
        query += " AND waste_type LIKE ?"
        params.append(f'%{waste_type}%')
    if location:
        query += " AND location LIKE ?"
        params.append(f'%{location}%')
    query += " ORDER BY created_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/listings', methods=['POST'])
def create_listing():
    data = request.json
    required = ['farmer_name', 'location', 'waste_type', 'quantity_kg', 'price_per_kg']
    if not all(k in data for k in required):
        return jsonify({'error': 'Missing fields'}), 400
    conn = get_db()
    conn.execute(
        "INSERT INTO listings (farmer_name, location, waste_type, quantity_kg, price_per_kg) VALUES (?,?,?,?,?)",
        (data['farmer_name'], data['location'], data['waste_type'], data['quantity_kg'], data['price_per_kg'])
    )
    conn.commit()
    conn.close()
    return jsonify({'message': 'Listing created successfully'}), 201

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.json
    required = ['listing_id', 'buyer_name', 'company', 'quantity_kg']
    if not all(k in data for k in required):
        return jsonify({'error': 'Missing fields'}), 400
    conn = get_db()
    listing = conn.execute("SELECT * FROM listings WHERE id=?", (data['listing_id'],)).fetchone()
    if not listing:
        return jsonify({'error': 'Listing not found'}), 404
    total = data['quantity_kg'] * listing['price_per_kg']
    conn.execute(
        "INSERT INTO orders (listing_id, buyer_name, company, quantity_kg, total_price) VALUES (?,?,?,?,?)",
        (data['listing_id'], data['buyer_name'], data['company'], data['quantity_kg'], total)
    )
    conn.commit()
    conn.close()
    return jsonify({'message': 'Order placed!', 'total_price': total}), 201

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db()
    total_listings = conn.execute("SELECT COUNT(*) FROM listings WHERE status='available'").fetchone()[0]
    total_orders = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    total_kg = conn.execute("SELECT SUM(quantity_kg) FROM listings WHERE status='available'").fetchone()[0] or 0
    total_revenue = conn.execute("SELECT SUM(total_price) FROM orders").fetchone()[0] or 0
    conn.close()
    return jsonify({
        'active_listings': total_listings,
        'total_orders': total_orders,
        'total_kg_available': total_kg,
        'total_revenue': total_revenue
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5050)
