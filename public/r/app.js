// Global holat
let restaurant = null;
let categories = [];
let menuItems = [];
let cart = {}; // { dishId: { dish, quantity } }
let selectedCategory = 'all';
let searchQuery = '';
let currentModalDish = null;

// URL parametrlarini olish
function getParams() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  let slug = 'rayhon'; // Standart namunaviy restoran
  if (pathParts.length >= 2 && pathParts[0] === 'r') {
    slug = pathParts[1];
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('r')) slug = urlParams.get('r');
  }

  const urlParams = new URLSearchParams(window.location.search);
  const table = urlParams.get('table') || '1';

  return { slug, table };
}

const { slug, table } = getParams();

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Raqamlarni chiroyli formatlash (masalan 38000 -> 38 000)
function formatMoney(amount) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

let tableSocket = null;
function initTableSocket() {
  if (!restaurant) return;
  if (tableSocket) {
    tableSocket.disconnect();
    tableSocket = null;
  }
  if (typeof io !== 'undefined') {
    tableSocket = io();
    tableSocket.emit('join:table', { restaurantId: restaurant.id, tableNumber: Number(table) });

    tableSocket.on('order:created', () => { checkTableOrders(); });
    tableSocket.on('order:status_updated', () => { checkTableOrders(); });
    tableSocket.on('orders:paid', () => { checkTableOrders(); });
  }
}

// Boshlang'ich yuklash
async function init() {
  try {
    const response = await fetch(`/api/r/${slug}`);
    const data = await response.json();

    if (!data.success) {
      document.body.innerHTML = `
        <div style="text-align:center; padding: 60px 20px;">
          <h2 style="color:#ef4444; margin-bottom:10px;">Restoran topilmadi</h2>
          <p style="color:#64748b;">Kiritilgan havola bo'yicha restoran mavjud emas.</p>
          <a href="/" style="display:inline-block; margin-top:20px; color:#f97316; font-weight:700;">Bosh sahifaga qaytish</a>
        </div>
      `;
      return;
    }

    restaurant = data.restaurant;
    categories = data.categories;
    menuItems = data.menuItems;

    document.title = `${restaurant.name} - QR Menyu`;

    renderAll();
    setupEventListeners();
    initTableSocket();
  } catch (err) {
    console.error("Ma'lumotlarni yuklashda xatolik:", err);
  }
}

// Hamma qismlarni qayta chizish (til o'zgarganda ham chaqiriladi)
function renderAll() {
  if (!restaurant) return;

  // Stol raqami
  document.getElementById('tableText').innerText = `${t('table')} ${table}`;

  // Til tugmalarining faolligi
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.toLowerCase() === currentLang);
  });

  // Restoran ma'lumotlari
  document.getElementById('restName').innerText = restaurant.name;
  document.getElementById('restDesc').innerText = restaurant.description || '';
  if (restaurant.banner) document.getElementById('restBanner').src = restaurant.banner;
  if (restaurant.logo) document.getElementById('restLogo').src = restaurant.logo;

  // Telefon va manzil
  const phoneEl = document.getElementById('restPhone');
  if (restaurant.phone) {
    phoneEl.innerText = restaurant.phone;
    document.getElementById('restPhoneWrapper').style.display = 'flex';
  } else {
    document.getElementById('restPhoneWrapper').style.display = 'none';
  }

  const addrEl = document.getElementById('restAddress');
  if (restaurant.address) {
    addrEl.innerText = restaurant.address;
    document.getElementById('restAddressWrapper').style.display = 'flex';
  } else {
    document.getElementById('restAddressWrapper').style.display = 'none';
  }

  // Ish vaqti holati
  const statusWrapper = document.getElementById('restStatusWrapper');
  const statusDot = document.getElementById('restStatusDot');
  const statusText = document.getElementById('restStatusText');
  if (statusWrapper && statusDot && statusText) {
    const openTime = restaurant.openTime || '09:00';
    const closeTime = restaurant.closeTime || '23:00';
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [oH, oM] = openTime.split(':').map(Number);
    const [cH, cM] = closeTime.split(':').map(Number);
    const openMinutes = (oH || 9) * 60 + (oM || 0);
    const closeMinutes = (cH || 23) * 60 + (cM || 0);

    const isOpen = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    if (isOpen) {
      statusDot.style.background = '#10b981';
      statusText.innerText = `Ochiq (${openTime} - ${closeTime})`;
    } else {
      statusDot.style.background = '#ef4444';
      statusText.innerText = `Yopiq (${openTime} da ochiladi)`;
    }
  }

  // Wi-Fi ma'lumotlari
  const wifiWrapper = document.getElementById('restWifiWrapper');
  const wifiText = document.getElementById('restWifiText');
  if (wifiWrapper && wifiText) {
    if (restaurant.wifiName) {
      wifiText.innerText = `Wi-Fi: ${restaurant.wifiName}`;
      wifiWrapper.style.display = 'inline-flex';
    } else {
      wifiWrapper.style.display = 'none';
    }
  }

  // Tarjimalar
  document.getElementById('btnCallWaiterText').innerText = t('call_waiter');
  document.getElementById('btnRequestBillText').innerText = t('request_bill');
  document.getElementById('searchInput').placeholder = t('search_placeholder');
  document.getElementById('viewCartText').innerText = t('view_cart');
  document.getElementById('cartModalTitle').innerText = t('cart_title');
  document.getElementById('btnOrderNowText').innerText = t('order_now');

  // Kategoriyalar va menyuni chiqarish
  renderCategories();
  renderMenu();
  updateCartUI();
}

// Kategoriyalar navigatsiyasi
function renderCategories() {
  const nav = document.getElementById('categoriesNav');
  let html = `
    <button class="category-tab ${selectedCategory === 'all' ? 'active' : ''}" onclick="selectCategory('all')">
      <i class="fa-solid fa-border-all"></i>
      <span>${t('all')}</span>
    </button>
  `;

  categories.forEach(cat => {
    const name = currentLang === 'ru' ? cat.nameRu : (currentLang === 'en' ? cat.nameEn : cat.nameUz);
    html += `
      <button class="category-tab ${selectedCategory === cat.id ? 'active' : ''}" onclick="selectCategory('${cat.id}')">
        <i class="${cat.icon || 'fa-solid fa-utensils'}"></i>
        <span>${name}</span>
      </button>
    `;
  });

  nav.innerHTML = html;
}

function selectCategory(catId) {
  selectedCategory = catId;
  renderCategories();
  renderMenu();
}

// Menyudagi taomlarni chiqarish
function renderMenu() {
  const container = document.getElementById('menuContainer');
  let filteredItems = menuItems.filter(item => item.isAvailable !== false);

  if (selectedCategory !== 'all') {
    filteredItems = filteredItems.filter(item => item.categoryId === selectedCategory);
  }

  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter(item => {
      const name = (item.nameUz + ' ' + item.nameRu + ' ' + item.nameEn).toLowerCase();
      const desc = (item.descriptionUz + ' ' + item.descriptionRu + ' ' + item.descriptionEn).toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }

  if (filteredItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-utensils"></i>
        <h4>Hech narsa topilmadi</h4>
        <p>Boshqa qidiruv so'zini sinab ko'ring yoki boshqa kategoriyani tanlang.</p>
      </div>
    `;
    return;
  }

  // Kategoriyalar bo'yicha guruhlash
  let html = '';
  const currentCats = selectedCategory === 'all' 
    ? categories 
    : categories.filter(c => c.id === selectedCategory);

  currentCats.forEach(cat => {
    const catItems = filteredItems.filter(item => item.categoryId === cat.id);
    if (catItems.length === 0) return;

    const catName = currentLang === 'ru' ? cat.nameRu : (currentLang === 'en' ? cat.nameEn : cat.nameUz);

    html += `
      <div class="category-section">
        <h2 class="category-section-title">
          <i class="${cat.icon || 'fa-solid fa-utensils'}" style="color:var(--primary);"></i>
          ${catName}
        </h2>
        <div class="dishes-grid">
    `;

    catItems.forEach(dish => {
      const name = currentLang === 'ru' ? dish.nameRu : (currentLang === 'en' ? dish.nameEn : dish.nameUz);
      const desc = currentLang === 'ru' ? dish.descriptionRu : (currentLang === 'en' ? dish.descriptionEn : dish.descriptionUz);
      const inCart = cart[dish.id];
      const isAvail = dish.isAvailable !== false;

      html += `
        <div class="dish-card" ${isAvail ? `onclick="openDishModal('${dish.id}')"` : 'style="opacity: 0.65; filter: grayscale(20%);"'}>
          <div class="dish-img-wrapper">
            <img class="dish-img" src="${dish.image}" alt="${name}" loading="lazy">
            ${!isAvail ? `<span class="dish-badge" style="background:#ef4444; color:#ffffff;">Bugun tugagan</span>` : (dish.isPopular ? `<span class="dish-badge">${t('popular')}</span>` : '')}
            ${dish.weight ? `<span class="dish-weight">${dish.weight}</span>` : ''}
          </div>
          <div class="dish-body">
            <h3 class="dish-name">${name}</h3>
            <p class="dish-desc">${desc || ''}</p>
            <div class="dish-footer" onclick="event.stopPropagation()">
              <span class="dish-price">${formatMoney(dish.price)} ${restaurant.currency || t('currency')}</span>
              ${!isAvail ? `
                <button class="btn-add" disabled style="background:var(--gray-200); color:var(--gray-400); cursor:not-allowed; box-shadow:none;">
                  <span>Tugagan</span>
                </button>
              ` : (inCart ? `
                <div class="qty-counter">
                  <button class="qty-btn" onclick="changeQty('${dish.id}', -1)">-</button>
                  <span class="qty-number">${inCart.quantity}</span>
                  <button class="qty-btn" onclick="changeQty('${dish.id}', 1)">+</button>
                </div>
              ` : `
                <button class="btn-add" onclick="addToCart('${dish.id}')">
                  <i class="fa-solid fa-plus"></i>
                  <span>${t('add_to_cart')}</span>
                </button>
              `)}
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Savatcha amallari
function addToCart(dishId) {
  const dish = menuItems.find(d => d.id === dishId);
  if (!dish || dish.isAvailable === false) return;

  if (!cart[dishId]) {
    cart[dishId] = { dish, quantity: 1 };
  } else {
    cart[dishId].quantity += 1;
  }
  updateCartUI();
  renderMenu();
}

function changeQty(dishId, delta) {
  if (!cart[dishId]) return;
  cart[dishId].quantity += delta;
  if (cart[dishId].quantity <= 0) {
    delete cart[dishId];
  }
  updateCartUI();
  renderMenu();
  renderCartModal();
}

function updateCartUI() {
  const items = Object.values(cart);
  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + (i.dish.price * i.quantity), 0);

  const bar = document.getElementById('bottomCartBar');
  const countEl = document.getElementById('cartBarCount');
  const priceEl = document.getElementById('cartBarPrice');

  if (totalCount > 0) {
    bar.classList.add('active');
    countEl.innerText = totalCount;
    priceEl.innerText = `${formatMoney(subtotal)} ${restaurant.currency || t('currency')}`;
  } else {
    bar.classList.remove('active');
  }
}

// Savatcha modali
function openCartModal() {
  renderCartModal();
  document.getElementById('cartModal').classList.add('active');
}

function closeCartModal() {
  document.getElementById('cartModal').classList.remove('active');
}

function renderCartModal() {
  const body = document.getElementById('cartModalBody');
  const footer = document.getElementById('cartModalFooter');
  const items = Object.values(cart);

  if (items.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-cart-shopping"></i>
        <h4>${t('empty_cart')}</h4>
        <p>${t('empty_cart_desc')}</p>
      </div>
    `;
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';

  let subtotal = 0;
  let html = '<div class="cart-items-list">';

  items.forEach(item => {
    const dish = item.dish;
    const name = currentLang === 'ru' ? dish.nameRu : (currentLang === 'en' ? dish.nameEn : dish.nameUz);
    const itemTotal = dish.price * item.quantity;
    subtotal += itemTotal;

    html += `
      <div class="cart-item">
        <div class="cart-item-details">
          <div class="cart-item-name">${name}</div>
          <div class="cart-item-price">${formatMoney(dish.price)} ${restaurant.currency || t('currency')}</div>
        </div>
        <div class="qty-counter">
          <button class="qty-btn" onclick="changeQty('${dish.id}', -1)">-</button>
          <span class="qty-number">${item.quantity}</span>
          <button class="qty-btn" onclick="changeQty('${dish.id}', 1)">+</button>
        </div>
      </div>
    `;
  });

  html += '</div>';

  // Hisob-kitob
  const feePercent = restaurant.serviceFeePercent || 0;
  const serviceFee = Math.round((subtotal * feePercent) / 100);
  const total = subtotal + serviceFee;

  html += `
    <div class="cart-summary">
      <div class="summary-row">
        <span>${t('subtotal')}</span>
        <span>${formatMoney(subtotal)} ${restaurant.currency || t('currency')}</span>
      </div>
      ${feePercent > 0 ? `
        <div class="summary-row">
          <span>${t('service_fee')} (${feePercent}%)</span>
          <span>${formatMoney(serviceFee)} ${restaurant.currency || t('currency')}</span>
        </div>
      ` : ''}
      <div class="summary-row total">
        <span>${t('total')}</span>
        <span>${formatMoney(total)} ${restaurant.currency || t('currency')}</span>
      </div>
    </div>

    <textarea id="orderNotes" class="cart-notes" rows="2" placeholder="${t('notes_placeholder')}"></textarea>
  `;

  body.innerHTML = html;
}

// Buyurtmani yuborish
async function submitOrder() {
  const items = Object.values(cart);
  if (items.length === 0) return;

  const subtotal = items.reduce((sum, i) => sum + (i.dish.price * i.quantity), 0);
  const feePercent = restaurant.serviceFeePercent || 0;
  const serviceFee = Math.round((subtotal * feePercent) / 100);
  const totalPrice = subtotal + serviceFee;
  const note = document.getElementById('orderNotes')?.value || '';

  const orderPayload = {
    tableNumber: Number(table),
    items: items.map(i => ({
      id: i.dish.id,
      name: i.dish.nameUz,
      price: i.dish.price,
      quantity: i.quantity
    })),
    subtotal,
    serviceFee,
    totalPrice,
    note
  };

  try {
    const res = await fetch(`/api/r/${slug}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
    const result = await res.json();

    if (result.success) {
      cart = {};
      updateCartUI();
      renderMenu();

      const body = document.getElementById('cartModalBody');
      const footer = document.getElementById('cartModalFooter');

      body.innerHTML = `
        <div class="success-screen">
          <div class="success-icon">
            <i class="fa-solid fa-check"></i>
          </div>
          <h3 class="success-title">${t('order_success')}</h3>
          <p class="success-desc">${t('order_success_desc')}</p>
          <div style="background:var(--gray-100); padding:12px; border-radius:10px; font-weight:700;">
            ${t('table')} ${table} | ID: #${result.order.id}
          </div>
        </div>
      `;

      footer.innerHTML = `
        <button class="btn-primary" onclick="closeCartModal()">
          <span>${t('close')}</span>
        </button>
      `;
    }
  } catch (err) {
    alert("Buyurtma yuborishda xatolik yuz berdi: " + err.message);
  }
}

// Ofitsiant chaqirish
async function callWaiter(callType) {
  try {
    const res = await fetch(`/api/r/${slug}/call-waiter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNumber: Number(table), callType })
    });
    const result = await res.json();
    if (result.success) {
      if (callType === 'bill') {
        alert(`${t('bill_requested')}\n${t('bill_requested_desc')}`);
      } else {
        alert(`${t('waiter_called')}\n${t('waiter_called_desc')}`);
      }
    }
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

// Taom tafsilotlari modali
function openDishModal(dishId) {
  const dish = menuItems.find(d => d.id === dishId);
  if (!dish) return;

  currentModalDish = dish;
  const name = currentLang === 'ru' ? dish.nameRu : (currentLang === 'en' ? dish.nameEn : dish.nameUz);
  const desc = currentLang === 'ru' ? dish.descriptionRu : (currentLang === 'en' ? dish.descriptionEn : dish.descriptionUz);

  document.getElementById('modalDishName').innerText = name;
  document.getElementById('modalDishImg').src = dish.image;
  document.getElementById('modalDishDesc').innerText = desc || "Tavsif mavjud emas.";
  document.getElementById('modalDishPrice').innerText = `${formatMoney(dish.price)} ${restaurant.currency || t('currency')}`;
  document.getElementById('modalDishWeight').innerText = dish.weight || '';

  document.getElementById('dishModal').classList.add('active');
}

function closeDishModal() {
  document.getElementById('dishModal').classList.remove('active');
  currentModalDish = null;
}

function addCurrentModalDish() {
  if (currentModalDish) {
    addToCart(currentModalDish.id);
    closeDishModal();
  }
}

function closeModalOnOverlay(e, modalId) {
  if (e.target.id === modalId) {
    document.getElementById(modalId).classList.remove('active');
  }
}

function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderMenu();
  });
}

// Jonli Stol Buyurtmalari va Holatni Tekshirish (Mijoz uchun)
let activeTableOrders = [];
let activeTableTotal = 0;

async function checkTableOrders() {
  try {
    const res = await fetch(`/api/r/${slug}/table-orders/${table}`);
    const data = await res.json();
    if (!data.success) return;

    activeTableOrders = data.activeOrders || [];
    activeTableTotal = data.totalAmount || 0;

    const tracker = document.getElementById('liveOrderTracker');
    if (!tracker) return;

    if (activeTableOrders.length === 0) {
      tracker.style.display = 'none';
      return;
    }

    tracker.style.display = 'flex';
    document.getElementById('trackerAmount').innerText = `${formatMoney(activeTableTotal)} ${restaurant.currency || t('currency')}`;

    // Oxirgi buyurtma holati
    const latest = activeTableOrders[0];
    const iconEl = document.getElementById('trackerIcon');
    const titleEl = document.getElementById('trackerTitle');
    const descEl = document.getElementById('trackerDesc');

    if (latest.status === 'new') {
      iconEl.style.background = '#3b82f6';
      iconEl.innerHTML = '<i class="fa-solid fa-clock"></i>';
      titleEl.innerText = "⏳ Qabul qilindi";
      descEl.innerText = "Buyurtmangiz oshpazga uzatildi";
    } else if (latest.status === 'preparing') {
      iconEl.style.background = '#f59e0b';
      iconEl.innerHTML = '<i class="fa-solid fa-fire-burner"></i>';
      titleEl.innerText = "🍳 Tayyorlanmoqda";
      descEl.innerText = "Oshxonada taomlar pishirilmoqda";
    } else if (latest.status === 'ready') {
      iconEl.style.background = '#10b981';
      iconEl.innerHTML = '<i class="fa-solid fa-bell-concierge"></i>';
      titleEl.innerText = "🛎️ Taom tayyor!";
      descEl.innerText = "Ofitsiant stolingizga olib kelmoqda";
    } else if (latest.status === 'delivered') {
      iconEl.style.background = '#059669';
      iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
      titleEl.innerText = "✅ Stolga yetkazildi";
      descEl.innerText = "Yoqimli ishtaha!";
    }
  } catch (err) {
    console.warn("Table orders fetch error:", err);
  }
}

// Stol hisob-kitobini ko'rsatish modali
function openTableBillModal() {
  const modal = document.getElementById('tableBillModal');
  const body = document.getElementById('tableBillModalBody');
  if (!modal || !body) return;

  if (activeTableOrders.length === 0) {
    body.innerHTML = `
      <div style="text-align:center; padding: 30px 10px; color: var(--gray-400);">
        <i class="fa-solid fa-receipt" style="font-size: 36px; margin-bottom: 10px;"></i>
        <p>Hozircha ushbu stolda faol buyurtmalar yo'q.</p>
      </div>
    `;
  } else {
    let html = '<div style="display:flex; flex-direction:column; gap:12px;">';
    activeTableOrders.forEach(o => {
      const timeStr = o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      let statusBadge = '';
      if (o.status === 'new') statusBadge = `<span style="background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:700;">${t('status_new')}</span>`;
      else if (o.status === 'preparing') statusBadge = `<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:700;">${t('status_preparing')}</span>`;
      else if (o.status === 'ready') statusBadge = `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:700;">${t('status_ready')}</span>`;
      else if (o.status === 'delivered') statusBadge = `<span style="background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:700;">${t('status_delivered')}</span>`;

      html += `
        <div style="background:var(--gray-100); border-radius:12px; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:12px; color:var(--gray-600);">
            <span><b>#${o.id}</b> • ${timeStr}</span>
            ${statusBadge}
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            ${(o.items || []).map(it => `
              <div style="display:flex; justify-content:space-between; font-size:13px;">
                <span>${it.name} <b style="color:var(--primary);">x${it.quantity}</b></span>
                <span style="font-weight:600;">${formatMoney(it.price * it.quantity)} ${restaurant.currency || t('currency')}</span>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:8px; padding-top:6px; border-top:1px dashed var(--gray-300); display:flex; justify-content:space-between; font-size:13px; font-weight:800;">
            <span>Buyurtma summasi:</span>
            <span style="color:var(--primary);">${formatMoney(o.totalPrice)} ${restaurant.currency || t('currency')}</span>
          </div>
        </div>
      `;
    });

    html += `
      <div style="background:#f8fafc; border:2px solid #e2e8f0; border-radius:12px; padding:14px; margin-top:8px;">
        <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:800;">
          <span>${t('table_bill_total')}:</span>
          <span style="color:#16a34a; font-size:17px;">${formatMoney(activeTableTotal)} ${restaurant.currency || t('currency')}</span>
        </div>
      </div>
    </div>`;
    body.innerHTML = html;
  }

  modal.classList.add('active');
}

function closeTableBillModal() {
  const modal = document.getElementById('tableBillModal');
  if (modal) modal.classList.remove('active');
}

// === ONLINE TO'LOV VA BAHOLASH (CLICK / PAYME & REVIEWS) ===
let currentPaymentProvider = 'click';

function openOnlinePayModal(provider) {
  currentPaymentProvider = provider || 'click';
  const modal = document.getElementById('onlinePayModal');
  if (!modal) return;

  const titleEl = document.getElementById('onlinePayTitle');
  const iconEl = document.getElementById('onlinePayIcon');
  const providerEl = document.getElementById('onlinePayProvider');
  const amountEl = document.getElementById('onlinePayAmount');
  const tableEl = document.getElementById('onlinePayTable');

  if (currentPaymentProvider === 'payme') {
    if (titleEl) titleEl.innerText = "Payme orqali to'lash";
    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-credit-card" style="color: #059669;"></i>';
    if (providerEl) providerEl.innerText = "Payme Business";
  } else {
    if (titleEl) titleEl.innerText = "Click orqali to'lash";
    if (iconEl) iconEl.innerHTML = '<i class="fa-solid fa-mobile-screen" style="color: #0284c7;"></i>';
    if (providerEl) providerEl.innerText = "Click Evolution";
  }

  if (tableEl) tableEl.innerText = `Stol ${table}`;
  if (amountEl) amountEl.innerText = `${formatMoney(activeTableTotal)} ${restaurant.currency || t('currency')}`;

  closeTableBillModal();
  modal.classList.add('active');
}

function closeOnlinePayModal() {
  const modal = document.getElementById('onlinePayModal');
  if (modal) modal.classList.remove('active');
}

async function confirmOnlinePayment() {
  const btn = document.getElementById('btnConfirmOnlinePay');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> To\'lov amalga oshirilmoqda...';
  }

  try {
    const res = await fetch(`/api/r/${slug}/online-pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: table,
        paymentMethod: currentPaymentProvider
      })
    });
    const data = await res.json();

    if (data.success) {
      closeOnlinePayModal();
      alert(`To'lov muvaffaqiyatli qabul qilindi!\nKassa cheki: #${data.receiptId || ''}`);

      // Stol buyurtmalarini yangilash
      await checkTableOrders();

      // Baholash modalini ochish
      setTimeout(() => {
        openRatingModal();
      }, 600);
    } else {
      alert(data.message || "To'lovda xatolik yuz berdi");
    }
  } catch (err) {
    alert("Internet yoki server bilan aloqa uzildi: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> To\'lovni Tasdiqlash';
    }
  }
}

// Reyting & Fikr-mulohaza (NPS)
let selectedRating = 5;

function openRatingModal() {
  const modal = document.getElementById('ratingModal');
  if (modal) {
    setRatingStar(5);
    const commentEl = document.getElementById('ratingComment');
    if (commentEl) commentEl.value = '';
    modal.classList.add('active');
  }
}

function closeRatingModal() {
  const modal = document.getElementById('ratingModal');
  if (modal) modal.classList.remove('active');
}

function setRatingStar(num) {
  selectedRating = num;
  const ratingInput = document.getElementById('ratingValue');
  if (ratingInput) ratingInput.value = num;

  const stars = document.querySelectorAll('#ratingModal .star-btn');
  stars.forEach((star, index) => {
    if (index < num) {
      star.style.opacity = '1';
      star.style.transform = 'scale(1.15)';
    } else {
      star.style.opacity = '0.3';
      star.style.transform = 'scale(0.95)';
    }
  });
}

async function submitRating() {
  const comment = document.getElementById('ratingComment')?.value?.trim() || '';
  try {
    const res = await fetch(`/api/r/${slug}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: table,
        rating: selectedRating,
        comment
      })
    });
    const data = await res.json();
    if (data.success) {
      closeRatingModal();
      alert("Fikr-mulohazangiz va bahoingiz uchun katta rahmat!");
    } else {
      alert(data.message || "Xatolik yuz berdi");
    }
  } catch (err) {
    closeRatingModal();
    alert("Fikringiz qabul qilindi, rahmat!");
  }
}

// Wi-Fi parolini nusxalash
function copyWifiPassword() {
  if (!restaurant.wifiPass && !restaurant.wifiName) return;
  const pass = restaurant.wifiPass || '';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(pass).then(() => {
      alert(`Wi-Fi: ${restaurant.wifiName}\nParol nusxalandi: ${pass}`);
    }).catch(() => {
      alert(`Wi-Fi: ${restaurant.wifiName}\nParol: ${pass}`);
    });
  } else {
    alert(`Wi-Fi: ${restaurant.wifiName}\nParol: ${pass}`);
  }
}

// Global window eksportlari (HTML inline hodisalar uchun)
window.copyWifiPassword = copyWifiPassword;
window.openOnlinePayModal = openOnlinePayModal;
window.closeOnlinePayModal = closeOnlinePayModal;
window.confirmOnlinePayment = confirmOnlinePayment;
window.openRatingModal = openRatingModal;
window.closeRatingModal = closeRatingModal;
window.setRatingStar = setRatingStar;
window.submitRating = submitRating;
window.openTableBillModal = openTableBillModal;
window.closeTableBillModal = closeTableBillModal;

// Ishga tushirish
window.renderAll = renderAll;
init();
checkTableOrders();
setInterval(checkTableOrders, 20000);


