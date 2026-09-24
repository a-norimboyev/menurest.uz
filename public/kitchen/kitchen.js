let currentRestaurant = null;
let currentOrders = [];
let kdsFilter = 'active'; // 'active', 'new', 'preparing', 'ready'
let soundEnabled = true;
let previousNewOrdersCount = 0;
let dishItemStates = {}; // { "orderId-dishIdx": boolean }

// KDS 3 tilli tarjima tizimi (UZ / RU / EN)
const kdsTranslations = {
  uz: {
    title: "Oshxona Ekrani (KDS)",
    subtitle: "Jonli Buyurtmalar Chiptalari",
    active_tickets: "Faol chiptalar",
    filter_active: "Faol chiptalar",
    filter_new: "Yangi",
    filter_prep: "Tayyorlanmoqda",
    filter_ready: "Bugun tayyorlangan",
    table: "STOL",
    time: "Vaqt",
    btn_start: "Boshlash (Tayyorlanmoqda)",
    btn_ready: "Tayyor bo'ldi!",
    ready_waiter: "Oshxonada tayyor (Ofitsiant kutilmoqda)",
    no_tickets: "Ushbu bo'limda chiptalar yo'q",
    no_tickets_desc: "Yangi buyurtmalar kelishi bilan ekranda aks etadi."
  },
  ru: {
    title: "Кухонный Экран (KDS)",
    subtitle: "Текущие Заказы и Тикеты",
    active_tickets: "Активных тикетов",
    filter_active: "Активные тикеты",
    filter_new: "Новые",
    filter_prep: "Готовятся",
    filter_ready: "Готовые за сегодня",
    table: "СТОЛ",
    time: "Время",
    btn_start: "Начать готовить",
    btn_ready: "Готово!",
    ready_waiter: "Готово на кухне (Ожидание официанта)",
    no_tickets: "В этом разделе нет заказов",
    no_tickets_desc: "Новые заказы появятся на экране сразу после оформления."
  },
  en: {
    title: "Kitchen Display (KDS)",
    subtitle: "Live Order Tickets",
    active_tickets: "Active tickets",
    filter_active: "Active tickets",
    filter_new: "New",
    filter_prep: "In Preparation",
    filter_ready: "Ready Today",
    table: "TABLE",
    time: "Time",
    btn_start: "Start Cooking",
    btn_ready: "Ready!",
    ready_waiter: "Ready in Kitchen (Waiting for Waiter)",
    no_tickets: "No tickets in this view",
    no_tickets_desc: "Incoming orders will appear on screen instantly."
  }
};

let currentKdsLang = localStorage.getItem('kds_lang') || 'uz';

function kt(key) {
  if (kdsTranslations[currentKdsLang] && kdsTranslations[currentKdsLang][key]) {
    return kdsTranslations[currentKdsLang][key];
  }
  return kdsTranslations.uz[key] || key;
}

function setKdsLanguage(lang) {
  if (kdsTranslations[lang]) {
    currentKdsLang = lang;
    localStorage.setItem('kds_lang', lang);
    applyKdsLanguage();
    renderTickets();
  }
}
window.setKdsLanguage = setKdsLanguage;
window.kt = kt;

function applyKdsLanguage() {
  document.querySelectorAll('.kds-lang-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-lang') === currentKdsLang);
  });

  const restName = currentRestaurant?.name || 'Restoran';
  const titleEl = document.getElementById('kdsRestName');
  if (titleEl) titleEl.innerText = `${restName} - ${kt('title')}`;

  const subEl = document.querySelector('.kds-subtitle');
  if (subEl) subEl.innerText = kt('subtitle');

  const lblActive = document.getElementById('lblActiveTickets');
  if (lblActive) lblActive.innerText = kt('active_tickets');

  const fActive = document.getElementById('lblFilterActive');
  if (fActive) fActive.innerText = kt('filter_active');
  const fNew = document.getElementById('lblFilterNew');
  if (fNew) fNew.innerText = kt('filter_new');
  const fPrep = document.getElementById('lblFilterPrep');
  if (fPrep) fPrep.innerText = kt('filter_prep');
  const fReady = document.getElementById('lblFilterReady');
  if (fReady) fReady.innerText = kt('filter_ready');
}

let kitchenSocket = null;

function initKitchenSocket() {
  if (!currentRestaurant) return;
  if (kitchenSocket) {
    kitchenSocket.disconnect();
    kitchenSocket = null;
  }
  if (typeof io !== 'undefined') {
    kitchenSocket = io();
    kitchenSocket.emit('join:kitchen', currentRestaurant.id);

    kitchenSocket.on('order:new', (order) => {
      playKitchenChime();
      loadKdsOrders();
    });

    kitchenSocket.on('order:status_updated', () => {
      loadKdsOrders();
    });
  }
}

// Boshlang'ich yuklash
async function init() {
  // 1. URL dan restoran slug ini tekshirish (?r=slug yoki ?slug=slug)
  const urlParams = new URLSearchParams(window.location.search);
  const slugParam = urlParams.get('r') || urlParams.get('slug');

  if (slugParam) {
    try {
      const res = await fetch(`/api/r/${slugParam}`);
      const data = await res.json();
      if (data.success) {
        currentRestaurant = data.restaurant;
      }
    } catch (e) {}
  }

  // 2. Agar URL da bo'lmasa, localStorage dan olish
  if (!currentRestaurant) {
    const saved = localStorage.getItem('admin_restaurant');
    if (saved) {
      try {
        currentRestaurant = JSON.parse(saved);
      } catch (e) {}
    }
  }

  // 3. Agar hali ham yo'q bo'lsa, birinchi namunaviy restoranni olish
  if (!currentRestaurant) {
    try {
      const res = await fetch('/api/public/restaurants');
      const data = await res.json();
      if (data.success && data.restaurants.length > 0) {
        currentRestaurant = data.restaurants[0];
      }
    } catch (e) {}
  }

  if (currentRestaurant) {
    if (currentRestaurant.logo) {
      document.getElementById('kdsLogo').src = currentRestaurant.logo;
    }
    const nameEl = document.getElementById('kdsRestName');
    if (nameEl) nameEl.innerText = `${currentRestaurant.name} - ${kt('title')}`;
  }

  applyKdsLanguage();
  startClock();
  loadKdsOrders();
  initKitchenSocket();

  // Zaxira yangilanish (Fallback 20 soniya)
  setInterval(loadKdsOrders, 20000);
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
    const res = await fetch(`/api/kds/orders/${currentRestaurant.slug}`);
    const data = await res.json();
    if (data.success) {
      currentOrders = data.orders || [];

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
        <h3 style="color:#cbd5e1; font-size: 20px; margin-bottom: 6px;">${kt('no_tickets')}</h3>
        <p style="font-size: 14px;">${kt('no_tickets_desc')}</p>
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
            <span>${kt('table')} ${o.tableNumber}</span>
          </div>
          <div class="ticket-timer ${timerClass}">
            <i class="fa-solid fa-clock"></i>
            <span class="timer-display">${formatTimer(elapsed)}</span>
          </div>
        </div>

        <div class="ticket-meta">
          <span>ID: <b>#${o.id}</b></span>
          <span>${kt('time')}: <b>${timeStr}</b></span>
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
              <i class="fa-solid fa-fire"></i> ${kt('btn_start')}
            </button>
          ` : ''}
          ${o.status === 'preparing' ? `
            <button class="btn-kds-action btn-ready" onclick="updateOrderStatus('${o.id}', 'ready')">
              <i class="fa-solid fa-check"></i> ${kt('btn_ready')}
            </button>
          ` : ''}
          ${o.status === 'ready' ? `
            <div style="width:100%; text-align:center; padding:8px; color:#34d399; font-weight:800; font-size:13px;">
              <i class="fa-solid fa-circle-check"></i> ${kt('ready_waiter')}
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
    const res = await fetch(`/api/kds/orders/${orderId}/status`, {
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
