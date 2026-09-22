let currentRestaurant = null;
let currentOrders = [];
let kdsFilter = 'active'; // 'active', 'new', 'preparing', 'ready'
let soundEnabled = true;
let previousNewOrdersCount = 0;
let dishItemStates = {}; // { "orderId-dishIdx": boolean }

// Boshlang'ich yuklash
async function init() {
  const saved = localStorage.getItem('admin_restaurant');
  if (saved) {
    try {
      currentRestaurant = JSON.parse(saved);
    } catch (e) {}
  }

  // Agar saqlanmagan bo'lsa, namunaviy 'rayhon' ni olish
  if (!currentRestaurant) {
    try {
      const res = await fetch('/api/r/rayhon');
      const data = await res.json();
      if (data.success) {
        currentRestaurant = data.restaurant;
      }
    } catch (e) {}
  }

  if (currentRestaurant) {
    document.getElementById('kdsRestName').innerText = `${currentRestaurant.name} - Oshxona (KDS)`;
    if (currentRestaurant.logo) {
      document.getElementById('kdsLogo').src = currentRestaurant.logo;
    }
  }

  startClock();
  loadKdsOrders();
  setInterval(loadKdsOrders, 4000);
  setInterval(updateTimers, 1000);
}

// Soat
function startClock() {
  const clockEl = document.getElementById('kdsClock');
  setInterval(() => {
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString();
  }, 1000);
}

// Ovozli signal (Yangi buyurtma kelganda)
function playKitchenChime() {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.7);
  } catch (e) {}
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('btnSoundToggle');
  btn.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// Buyurtmalarni yuklash
async function loadKdsOrders() {
  if (!currentRestaurant) return;
  try {
    const res = await fetch(`/api/admin/orders/${currentRestaurant.id}`);
    const data = await res.json();
    if (data.success) {
      // Faqat taomli buyurtmalar (chaqiruvlarsiz)
      currentOrders = data.orders.filter(o => o.type !== 'call_waiter' && o.type !== 'bill_request' && o.status !== 'cancelled');

      // Yangi buyurtma soni oshsa ovoz berish
      const newOrdersCount = currentOrders.filter(o => o.status === 'new').length;
      if (newOrdersCount > previousNewOrdersCount && previousNewOrdersCount !== 0) {
        playKitchenChime();
      }
      previousNewOrdersCount = newOrdersCount;

      updateBadgeCounts();
      renderTickets();
    }
  } catch (err) {
    console.warn("KDS buyurtmalar yuklashda xatolik:", err);
  }
}

function updateBadgeCounts() {
  const newCount = currentOrders.filter(o => o.status === 'new').length;
  const prepCount = currentOrders.filter(o => o.status === 'preparing').length;
  const readyCount = currentOrders.filter(o => o.status === 'ready').length;
  const activeCount = newCount + prepCount;

  document.getElementById('countActive').innerText = activeCount;
  document.getElementById('countNew').innerText = newCount;
  document.getElementById('countPrep').innerText = prepCount;
  document.getElementById('countReady').innerText = readyCount;
  document.getElementById('activeTicketsCount').innerText = activeCount;
}

function setKdsFilter(filter, btn) {
  kdsFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTickets();
}

function renderTickets() {
  const grid = document.getElementById('ticketsGrid');
  let filtered = [];

  if (kdsFilter === 'active') {
    filtered = currentOrders.filter(o => o.status === 'new' || o.status === 'preparing');
  } else if (kdsFilter === 'new') {
    filtered = currentOrders.filter(o => o.status === 'new');
  } else if (kdsFilter === 'preparing') {
    filtered = currentOrders.filter(o => o.status === 'preparing');
  } else if (kdsFilter === 'ready') {
    filtered = currentOrders.filter(o => o.status === 'ready');
  }

  // Eng eskisi birinchi (tayyorlash navbati bo'yicha)
  filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: 60px 20px; color: var(--text-muted);">
        <i class="fa-solid fa-utensils" style="font-size: 48px; margin-bottom: 12px; color:#334155;"></i>
        <h3 style="color:#cbd5e1; font-size: 20px; margin-bottom: 6px;">Ushbu bo'limda chiptalar yo'q</h3>
        <p style="font-size: 14px;">Yangi buyurtmalar kelishi bilan ekranda aks etadi.</p>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(o => {
    const elapsed = getElapsedSeconds(o.createdAt);
    let statusClass = 'status-ok';
    let timerClass = 'timer-ok';

    if (elapsed > 1200) { // 20 min
      statusClass = 'status-danger';
      timerClass = 'timer-danger';
    } else if (elapsed > 600) { // 10 min
      statusClass = 'status-warning';
      timerClass = 'timer-warning';
    }

    const timeStr = o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    html += `
      <div class="ticket-card ${statusClass}" id="ticket-${o.id}" data-created="${o.createdAt}">
        <div class="ticket-header">
          <div class="ticket-table-num">
            <i class="fa-solid fa-chair" style="color:var(--primary);"></i>
            <span>STOL ${o.tableNumber}</span>
          </div>
          <div class="ticket-timer ${timerClass}">
            <i class="fa-solid fa-clock"></i>
            <span class="timer-display">${formatTimer(elapsed)}</span>
          </div>
        </div>

        <div class="ticket-meta">
          <span>ID: <b>#${o.id}</b></span>
          <span>Vaqt: <b>${timeStr}</b></span>
        </div>

        ${o.note ? `
          <div class="ticket-order-note">
            <i class="fa-solid fa-message"></i>
            <span>${o.note}</span>
          </div>
        ` : ''}

        <div class="ticket-items">
          ${o.items.map((it, idx) => {
            const key = `${o.id}-${idx}`;
            const isDone = dishItemStates[key];
            return `
              <div class="dish-row ${isDone ? 'done' : ''}" onclick="toggleDishItem('${key}', this)">
                <div class="dish-qty">${it.quantity}</div>
                <div class="dish-name">${it.name}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="ticket-footer">
          ${o.status === 'new' ? `
            <button class="btn-kds-action btn-start" onclick="updateOrderStatus('${o.id}', 'preparing')">
              <i class="fa-solid fa-fire"></i> Boshlash (Tayyorlanmoqda)
            </button>
          ` : ''}
          ${o.status === 'preparing' ? `
            <button class="btn-kds-action btn-ready" onclick="updateOrderStatus('${o.id}', 'ready')">
              <i class="fa-solid fa-check"></i> Tayyor bo'ldi!
            </button>
          ` : ''}
          ${o.status === 'ready' ? `
            <div style="width:100%; text-align:center; padding:8px; color:#34d399; font-weight:800; font-size:13px;">
              <i class="fa-solid fa-circle-check"></i> Oshxonada tayyor (Ofitsiant kutilmoqda)
            </div>
          ` : ''}
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

function toggleDishItem(key, el) {
  dishItemStates[key] = !dishItemStates[key];
  el.classList.toggle('done', dishItemStates[key]);
}

function getElapsedSeconds(createdAt) {
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimers() {
  document.querySelectorAll('.ticket-card').forEach(card => {
    const created = card.getAttribute('data-created');
    if (!created) return;
    const elapsed = getElapsedSeconds(created);
    const display = card.querySelector('.timer-display');
    if (display) display.innerText = formatTimer(elapsed);

    // Ranglarni yangilash
    const timerBox = card.querySelector('.ticket-timer');
    if (elapsed > 1200) {
      card.className = 'ticket-card status-danger';
      if (timerBox) timerBox.className = 'ticket-timer timer-danger';
    } else if (elapsed > 600) {
      card.className = 'ticket-card status-warning';
      if (timerBox) timerBox.className = 'ticket-timer timer-warning';
    }
  });
}

async function updateOrderStatus(orderId, status) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      loadKdsOrders();
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

// Ishga tushirish
init();
