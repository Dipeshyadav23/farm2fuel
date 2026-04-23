const API = '';  // same-origin

async function loadStats() {
  try {
    const res = await fetch(`${API}/api/stats`);
    const data = await res.json();
    document.getElementById('stat-listings').textContent = data.active_listings;
    document.getElementById('stat-orders').textContent = data.total_orders;
    const tonnes = (data.total_kg_available / 1000).toFixed(1);
    document.getElementById('stat-kg').textContent = tonnes + 'T';
  } catch (e) { console.error('Stats load failed', e); }
}

async function loadListings() {
  const grid = document.getElementById('listings-grid');
  const type = document.getElementById('filter-type').value;
  const loc = document.getElementById('filter-location').value;
  grid.innerHTML = '<div class="loading-state">Fetching listings...</div>';
  try {
    const params = new URLSearchParams();
    if (type) params.set('waste_type', type);
    if (loc) params.set('location', loc);
    const res = await fetch(`${API}/api/listings?${params}`);
    const listings = await res.json();
    if (listings.length === 0) {
      grid.innerHTML = '<div class="loading-state">No listings found. Be the first to list!</div>';
      return;
    }
    grid.innerHTML = '';
    listings.forEach((l, i) => {
      const card = buildCard(l, i);
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = '<div class="loading-state">⚠️ Could not load listings.</div>';
  }
}

const wasteEmoji = {
  'Rice Straw': '🌾', 'Wheat Stubble': '🌿', 'Rice Husk': '🪨',
  'Sugarcane Husk': '🍬', 'Cotton Stalks': '🌸'
};

function buildCard(l, i) {
  const card = document.createElement('div');
  card.className = 'listing-card';
  card.style.animationDelay = `${i * 0.07}s`;
  const emoji = wasteEmoji[l.waste_type] || '♻️';
  const initials = l.farmer_name.split(' ').map(n => n[0]).join('').slice(0, 2);
  const date = new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  card.innerHTML = `
    <div class="card-header">
      <span class="waste-type-badge">${emoji} ${l.waste_type}</span>
      <span class="card-price">₹${parseFloat(l.price_per_kg).toFixed(2)}/kg</span>
    </div>
    <div class="card-body">
      <div class="card-farmer">
        <div class="farmer-avatar">${initials}</div>
        <span class="farmer-name">${l.farmer_name}</span>
      </div>
      <div class="card-location">📍 ${l.location}</div>
      <div class="card-qty">
        <span class="qty-num">${(l.quantity_kg).toLocaleString('en-IN')}</span>
        <span class="qty-unit">kg available</span>
      </div>
    </div>
    <div class="card-footer">
      <span class="card-date">${date}</span>
      <button class="btn-buy" onclick="openBuyModal(${l.id}, '${l.waste_type}', ${l.price_per_kg}, '${l.farmer_name}', '${l.location}', ${l.quantity_kg})">Buy Now</button>
    </div>
  `;
  return card;
}

function openBuyModal(id, type, pricePerKg, farmer, location, qty) {
  document.getElementById('order-listing-id').value = id;
  document.getElementById('order-price-per-kg').value = pricePerKg;
  document.getElementById('order-listing-info').innerHTML = `
    <strong>${wasteEmoji[type] || '♻️'} ${type}</strong><br>
    Seller: ${farmer} &bull; ${location}<br>
    Available: ${qty.toLocaleString('en-IN')} kg &bull; ₹${pricePerKg}/kg
  `;
  document.getElementById('order_qty').value = '';
  document.getElementById('total-display').textContent = 'Total: ₹—';
  document.getElementById('buy-success').style.display = 'none';
  document.getElementById('buy-form').style.display = '';
  openModal('buy-modal');
}

function updateTotal() {
  const qty = parseFloat(document.getElementById('order_qty').value) || 0;
  const pricePerKg = parseFloat(document.getElementById('order-price-per-kg').value) || 0;
  const total = qty * pricePerKg;
  document.getElementById('total-display').textContent = total > 0
    ? `Total: ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : 'Total: ₹—';
}

async function submitListing(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    const res = await fetch(`${API}/api/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmer_name: document.getElementById('farmer_name').value,
        location: document.getElementById('location').value,
        waste_type: document.getElementById('waste_type').value,
        quantity_kg: parseFloat(document.getElementById('quantity_kg').value),
        price_per_kg: parseFloat(document.getElementById('price_per_kg').value),
      })
    });
    if (res.ok) {
      document.getElementById('sell-success').style.display = 'block';
      e.target.reset();
      setTimeout(() => {
        closeModal('sell-modal');
        document.getElementById('sell-success').style.display = 'none';
        loadListings();
        loadStats();
      }, 2000);
    }
  } catch (err) { alert('Error submitting listing'); }
  btn.disabled = false; btn.textContent = 'Submit Listing';
}

async function submitOrder(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Processing...';
  try {
    const res = await fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_id: parseInt(document.getElementById('order-listing-id').value),
        buyer_name: document.getElementById('buyer_name').value,
        company: document.getElementById('company').value,
        quantity_kg: parseFloat(document.getElementById('order_qty').value),
      })
    });
    if (res.ok) {
      document.getElementById('buy-success').style.display = 'block';
      document.getElementById('buy-form').style.display = 'none';
      setTimeout(() => {
        closeModal('buy-modal');
        document.getElementById('buy-success').style.display = 'none';
        loadStats();
      }, 2500);
    }
  } catch (err) { alert('Error placing order'); }
  btn.disabled = false; btn.textContent = 'Confirm Order (UPI/Razorpay)';
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Init
loadStats();
loadListings();
