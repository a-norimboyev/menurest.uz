let currentRestaurant = null;
let currentOrders = [];
let currentMenu = [];
let currentCategories = [];
let ordersPollInterval = null;

// Formatlash
function formatMoney(amount) {
  return (amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
}

// Boshlang'ich yuklash
async function init() {
  const saved = localStorage.getItem('admin_restaurant');
  if (saved) {
    try {
      currentRestaurant = JSON.parse(saved);
      showAdminLayout();
      return;
    } catch (e) {}
  }
  showLoginScreen();
}

// Kirish oynasini ko'rsatish
async function showLoginScreen() {
  document.getElementById('authWrapper').style.display = 'flex';
  document.getElementById('adminLayout').style.display = 'none';

  // Restoranlar ro'yxatini select ga yuklash
  try {
    const res = await fetch('/api/super/restaurants');
    const data = await res.json();
    if (data.success) {
      const select = document.getElementById('loginSlugSelect');
      select.innerHTML = '<option value="">-- Ro\'yxatdan tanlang --</option>';
      data.restaurants.forEach(r => {
        select.innerHTML += `<option value="${r.slug}">${r.name} (${r.slug})</option>`;
      });
    }
  } catch (e) {
    console.error("Restoranlar ro'yxatini yuklashda xatolik:", e);
  }
}

let currentRole = localStorage.getItem('admin_role') || 'manager';

function onRestaurantSelect(selectEl) {
  if (selectEl.value) {
    document.getElementById('loginSlug').value = selectEl.value;
  }
}

// Parolni ko'rsatish / yashirish (ko'zcha tugmasi)
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    }
  } else {
    input.type = 'password';
    if (icon) {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

// Login qilish
async function handleLogin(e) {
  e.preventDefault();
  const slug = document.getElementById('loginSlug').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const role = document.getElementById('loginRole')?.value || 'manager';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, password })
    });
    const data = await res.json();

    if (data.success) {
      currentRestaurant = data.restaurant;
      currentRole = role;
      localStorage.setItem('admin_restaurant', JSON.stringify(currentRestaurant));
      localStorage.setItem('admin_role', currentRole);
      showAdminLayout();
    } else {
      alert(data.message || "Kirishda xatolik!");
    }
  } catch (err) {
    alert("Server bilan ulanishda xatolik: " + err.message);
  }
}

// Rolga mos ravishda chap menyuni (sidebar) tozalash
function updateSidebarByRole(role) {
  const btnBoss = document.getElementById('tabBtn-boss');
  const btnCashier = document.getElementById('tabBtn-cashier');
  const btnWaiter = document.getElementById('tabBtn-waiter');
  const btnOrders = document.getElementById('tabBtn-orders');
  const btnMenu = document.getElementById('tabBtn-menu');
  const btnCategories = document.getElementById('tabBtn-categories');
  const btnQr = document.getElementById('tabBtn-qr');
  const kitchenLink = document.getElementById('sidebarKitchenLink');
  const btnSettings = document.getElementById('tabBtn-settings');
  const sectionRoles = document.getElementById('sidebarSectionRoles');
  const sectionManager = document.getElementById('sidebarSectionManager');
  const viewLiveMenuLink = document.getElementById('viewLiveMenuLink');

  if (role === 'boss') {
    // Boshliq uchun faqat strategik va tahliliy bo'limlar:
    if (btnBoss) btnBoss.style.display = 'flex';
    if (btnMenu) btnMenu.style.display = 'flex';
    if (btnCategories) btnCategories.style.display = 'flex';
    if (btnQr) btnQr.style.display = 'flex';
    if (btnSettings) btnSettings.style.display = 'flex';

    // Ortiqcha operatsion bo'limlarni yashirish:
    if (btnCashier) btnCashier.style.display = 'none';
    if (btnWaiter) btnWaiter.style.display = 'none';
    if (btnOrders) btnOrders.style.display = 'none';
    if (kitchenLink) kitchenLink.style.display = 'none';
    if (sectionRoles) {
      sectionRoles.style.display = 'block';
      sectionRoles.innerText = 'Rahbar Bo\'limi';
    }
    if (sectionManager) {
      sectionManager.style.display = 'block';
      sectionManager.innerText = 'Menyu & Sozlamalar';
    }
    if (viewLiveMenuLink) viewLiveMenuLink.style.display = 'none';
  } else if (role === 'cashier') {
    if (btnBoss) btnBoss.style.display = 'none';
    if (btnCashier) btnCashier.style.display = 'flex';
    if (btnWaiter) btnWaiter.style.display = 'none';
    if (btnOrders) btnOrders.style.display = 'none';
    if (btnMenu) btnMenu.style.display = 'none';
    if (btnCategories) btnCategories.style.display = 'none';
    if (btnQr) btnQr.style.display = 'none';
    if (kitchenLink) kitchenLink.style.display = 'none';
    if (btnSettings) btnSettings.style.display = 'none';
    if (sectionRoles) {
      sectionRoles.style.display = 'block';
      sectionRoles.innerText = 'Kassa Bo\'limi';
    }
    if (sectionManager) sectionManager.style.display = 'none';
    if (viewLiveMenuLink) viewLiveMenuLink.style.display = 'none';
  } else if (role === 'waiter') {
    if (btnBoss) btnBoss.style.display = 'none';
    if (btnCashier) btnCashier.style.display = 'none';
    if (btnWaiter) btnWaiter.style.display = 'flex';
    if (btnOrders) btnOrders.style.display = 'flex';
    if (btnMenu) btnMenu.style.display = 'none';
    if (btnCategories) btnCategories.style.display = 'none';
    if (btnQr) btnQr.style.display = 'none';
    if (kitchenLink) kitchenLink.style.display = 'none';
    if (btnSettings) btnSettings.style.display = 'none';
    if (sectionRoles) {
      sectionRoles.style.display = 'block';
      sectionRoles.innerText = 'Ofitsiant Bo\'limi';
    }
    if (sectionManager) sectionManager.style.display = 'none';
    if (viewLiveMenuLink) viewLiveMenuLink.style.display = 'inline-flex';
  } else {
    // manager (barcha bo'limlar ochiq)
    if (btnBoss) btnBoss.style.display = 'flex';
    if (btnCashier) btnCashier.style.display = 'flex';
    if (btnWaiter) btnWaiter.style.display = 'flex';
    if (btnOrders) btnOrders.style.display = 'flex';
    if (btnMenu) btnMenu.style.display = 'flex';
    if (btnCategories) btnCategories.style.display = 'flex';
    if (btnQr) btnQr.style.display = 'flex';
    if (kitchenLink) kitchenLink.style.display = 'flex';
    if (btnSettings) btnSettings.style.display = 'flex';
    if (sectionRoles) {
      sectionRoles.style.display = 'block';
      sectionRoles.innerText = 'Xodimlar & Rollar';
    }
    if (sectionManager) {
      sectionManager.style.display = 'block';
      sectionManager.innerText = 'Menejer Bo\'limlari';
    }
    if (viewLiveMenuLink) viewLiveMenuLink.style.display = 'inline-flex';
  }
}

// Rolni almashtirish
function switchRole(role) {
  currentRole = role;
  localStorage.setItem('admin_role', currentRole);

  const switcher = document.getElementById('topRoleSwitcher');
  if (switcher) switcher.value = role;

  const roleNames = {
    manager: 'Restoran Menejeri',
    boss: 'Restoran Boshlig\'i',
    cashier: 'Kassa (POS Kassir)',
    waiter: 'Restoran Ofitsiant'
  };
  const badge = document.getElementById('sideRoleBadge');
  if (badge) badge.innerText = roleNames[role] || 'Restoran Admin';

  updateSidebarByRole(role);

  if (role === 'boss') switchTab('boss');
  else if (role === 'cashier') switchTab('cashier');
  else if (role === 'waiter') switchTab('waiter');
  else switchTab('orders');
}

// Chiqish
function logout() {
  localStorage.removeItem('admin_restaurant');
  currentRestaurant = null;
  if (ordersPollInterval) clearInterval(ordersPollInterval);
  showLoginScreen();
}

// Admin panelini ko'rsatish
function showAdminLayout() {
  document.getElementById('authWrapper').style.display = 'none';
  document.getElementById('adminLayout').style.display = 'flex';

  document.getElementById('sideBrand').innerText = currentRestaurant.name;
  if (currentRestaurant.logo) {
    document.getElementById('sideLogo').src = currentRestaurant.logo;
  }

  // Jonli menyuga havola
  const liveLink = document.getElementById('viewLiveMenuLink');
  liveLink.href = `/r/${currentRestaurant.slug}?table=1`;

  // Rolni sozlash
  switchRole(currentRole);

  // Har 5 soniyada buyurtmalarni avtomatik yangilab turish
  if (ordersPollInterval) clearInterval(ordersPollInterval);
  ordersPollInterval = setInterval(() => {
    loadOrders();
    if (currentRole === 'waiter') loadWaiterData();
    if (currentRole === 'cashier') loadCashierData();
  }, 5000);
}

// Tablarni almashtirish
function switchTab(tabName) {
  const tabs = ['orders', 'menu', 'categories', 'qr', 'settings', 'boss', 'cashier', 'waiter'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = (t === tabName ? 'block' : 'none');
    const btn = document.getElementById(`tabBtn-${t}`);
    if (btn) btn.classList.toggle('active', t === tabName);
  });

  const titles = {
    boss: 'Boshliq - Moliya va Savdo Tahlili',
    cashier: 'Kassa - To\'lovlar va Chek Chiqarish',
    waiter: 'Ofitsiant - Chaqiruvlar va Yetkazish',
    orders: 'Jonli Buyurtmalar & Stollar',
    menu: 'Taomlar Menyusi',
    categories: 'Kategoriyalar Boshqaruvi',
    qr: 'Stollar & QR Kodlar Stikerlari',
    settings: 'Restoran Sozlamalari'
  };
  document.getElementById('pageTitle').innerText = titles[tabName] || 'Admin';

  if (tabName === 'orders') loadOrders();
  if (tabName === 'menu') loadMenu();
  if (tabName === 'categories') loadCategories();
  if (tabName === 'qr') loadQRCodes();
  if (tabName === 'settings') loadSettings();
  if (tabName === 'boss') loadBossData();
  if (tabName === 'cashier') loadCashierData();
  if (tabName === 'waiter') loadWaiterData();
}

// ==================== 1. BUYURTMALAR ====================
let prevOrdersCount = 0;
let prevWaiterCallsCount = 0;
let isFirstLoad = true;

function playNotificationSound(type = 'order') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'call') {
      // Shoshilinch chaqiruv: 2 ta signal
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } else {
      // Yangi buyurtma
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    // Audio context may be restricted before user clicks
  }
}

async function loadOrders() {
  if (!currentRestaurant) return;
  try {
    const res = await fetch(`/api/admin/orders/${currentRestaurant.id}`);
    const data = await res.json();
    if (data.success) {
      currentOrders = data.orders;
      updateTableFilterOptions();
      renderLiveTablesGrid();
      renderOrders();

      const newOrdersCount = currentOrders.filter(o => o.status === 'new' && o.type !== 'call_waiter' && o.type !== 'bill_request').length;
      const badge = document.getElementById('ordersBadge');
      if (newOrdersCount > 0) {
        badge.innerText = newOrdersCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }

      // Ofitsiant chaqiruvlari soni
      const waiterCallsCount = currentOrders.filter(o => (o.type === 'call_waiter' || o.type === 'bill_request') && o.status === 'new').length;
      const waiterBadge = document.getElementById('waiterBadge');
      if (waiterBadge) {
        if (waiterCallsCount > 0) {
          waiterBadge.innerText = waiterCallsCount;
          waiterBadge.style.display = 'inline-block';
        } else {
          waiterBadge.style.display = 'none';
        }
      }

      // Ovozli xabarnoma berish (Agar yangi buyurtma yoki chaqiruv qo'shilgan bo'lsa)
      if (!isFirstLoad) {
        if (waiterCallsCount > prevWaiterCallsCount) {
          playNotificationSound('call');
        } else if (newOrdersCount > prevOrdersCount) {
          playNotificationSound('order');
        }
      }
      isFirstLoad = false;
      prevOrdersCount = newOrdersCount;
      prevWaiterCallsCount = waiterCallsCount;
    }
  } catch (err) {
    console.error("Buyurtmalarni yuklashda xatolik:", err);
  }
}

let selectedTable = 'all';

function updateTableFilterOptions() {
  const select = document.getElementById('tableFilterSelect');
  if (!select) return;
  const currentVal = select.value || 'all';
  const tablesCount = currentRestaurant.tablesCount || 15;

  let html = '<option value="all">Barcha stollar</option>';
  for (let i = 1; i <= tablesCount; i++) {
    html += `<option value="${i}">Stol ${i}</option>`;
  }
  select.innerHTML = html;
  select.value = currentVal;
}

// 15 ta stolning jonli holati (Xaritasi)
function renderLiveTablesGrid() {
  const grid = document.getElementById('liveTablesGrid');
  if (!grid) return;

  const tablesCount = currentRestaurant.tablesCount || 15;
  let html = '';

  for (let i = 1; i <= tablesCount; i++) {
    // Shu stolga tegishli faol buyurtmalarni tekshirish
    const tableOrders = currentOrders.filter(o => Number(o.tableNumber) === i && ['new', 'preparing', 'ready'].includes(o.status));
    const waiterCall = currentOrders.find(o => Number(o.tableNumber) === i && (o.type === 'call_waiter' || o.type === 'bill_request') && o.status === 'new');

    let bg = '#f0fdf4';
    let borderColor = '#bbf7d0';
    let textColor = '#16a34a';
    let statusText = "Bo'sh";
    let icon = "fa-check";

    if (waiterCall) {
      bg = '#fdf4ff';
      borderColor = '#f0abfc';
      textColor = '#86198f';
      statusText = "Ofitsiant!";
      icon = "fa-bell";
    } else if (tableOrders.some(o => o.status === 'new')) {
      bg = '#fef2f2';
      borderColor = '#fca5a5';
      textColor = '#dc2626';
      statusText = "Yangi zakaz";
      icon = "fa-circle-exclamation";
    } else if (tableOrders.some(o => o.status === 'preparing')) {
      bg = '#fffbeb';
      borderColor = '#fde68a';
      textColor = '#d97706';
      statusText = "Oshxonada";
      icon = "fa-fire";
    } else if (tableOrders.some(o => o.status === 'ready')) {
      bg = '#eff6ff';
      borderColor = '#bfdbfe';
      textColor = '#2563eb';
      statusText = "Tayyor";
      icon = "fa-utensils";
    }

    const isSelected = selectedTable === String(i);

    html += `
      <div onclick="selectTableFilter('${i}')" style="background:${bg}; border:2px solid ${isSelected ? 'var(--dark)' : borderColor}; border-radius:10px; padding:10px 8px; text-align:center; cursor:pointer; transition:all 0.2s; box-shadow:${isSelected ? '0 0 0 2px var(--primary)' : 'none'};">
        <div style="font-weight:800; font-size:13px; color:var(--dark);">Stol ${i}</div>
        <div style="font-size:11px; font-weight:700; color:${textColor}; margin-top:3px; display:flex; align-items:center; justify-content:center; gap:4px;">
          <i class="fa-solid ${icon}"></i> <span>${statusText}</span>
        </div>
      </div>
    `;
  }

  grid.innerHTML = html;
}

function selectTableFilter(tableNum) {
  selectedTable = selectedTable === String(tableNum) ? 'all' : String(tableNum);
  const select = document.getElementById('tableFilterSelect');
  if (select) select.value = selectedTable;
  renderLiveTablesGrid();
  renderOrders();
}

function filterOrders() {
  const select = document.getElementById('tableFilterSelect');
  if (select) selectedTable = select.value;
  renderLiveTablesGrid();
  renderOrders();
}

function renderOrders() {
  const grid = document.getElementById('ordersGrid');
  const statusFilter = document.getElementById('orderStatusFilter').value;

  let filtered = currentOrders;

  // Status bo'yicha filter
  if (statusFilter === 'active') {
    filtered = filtered.filter(o => ['new', 'preparing', 'ready'].includes(o.status));
  } else if (statusFilter === 'completed') {
    filtered = filtered.filter(o => ['delivered', 'cancelled'].includes(o.status));
  }

  // Stol raqami bo'yicha filter
  if (selectedTable !== 'all') {
    filtered = filtered.filter(o => Number(o.tableNumber) === Number(selectedTable));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--gray-400);">
        <i class="fa-solid fa-receipt" style="font-size: 40px; margin-bottom: 10px; display:block;"></i>
        <h4>${selectedTable !== 'all' ? `Stol ${selectedTable} da buyurtma yo'q` : 'Hozircha buyurtmalar yo\'q'}</h4>
        ${selectedTable !== 'all' ? `<button class="btn-submit" style="width:auto; margin-top:10px; padding:6px 14px; font-size:12px;" onclick="selectTableFilter('all')">Barcha stollarni ko'rsatish</button>` : ''}
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(order => {
    const isNew = order.status === 'new';
    const isWaiterCall = order.type === 'call_waiter' || order.type === 'bill_request';

    let statusBadgeClass = `badge-${order.status}`;
    let statusText = {
      new: 'Yangi',
      preparing: 'Tayyorlanmoqda',
      ready: 'Tayyor',
      delivered: 'Yetkazildi',
      cancelled: 'Bekor qilindi'
    }[order.status] || order.status;

    if (isWaiterCall) {
      statusBadgeClass = 'badge-waiter';
      statusText = order.type === 'bill_request' ? "Hisob so'rovi" : "Ofitsiant chaqirildi";
    }

    html += `
      <div class="order-card ${isNew ? 'new-alert' : ''}">
        <div class="order-header">
          <div class="order-table-num" style="background:#ffedd5; padding:4px 10px; border-radius:8px; color:#ea580c;">
            <i class="fa-solid fa-chair"></i>
            <span style="font-size:17px; font-weight:900;">STOL ${order.tableNumber}</span>
          </div>
          <span class="order-status-badge ${statusBadgeClass}">${statusText}</span>
        </div>

        <div style="font-size: 11px; color: var(--gray-400); margin-bottom: 10px;">
          ${formatDate(order.createdAt)} | ID: #${order.id}
        </div>

        <div class="order-items-list">
          ${isWaiterCall ? `
            <div style="padding: 14px; background: #fdf4ff; border-radius: 8px; color: #86198f; font-weight: 700; text-align: center; border: 1px dashed #f0abfc;">
              <i class="fa-solid fa-bell" style="font-size: 24px; margin-bottom: 6px; display: block; color:#c026d3;"></i>
              <span style="font-size:15px;">${order.note}</span>
            </div>
          ` : `
            ${order.items.map(item => `
              <div class="order-item-row">
                <span><b>${item.quantity}x</b> ${item.name}</span>
                <span>${formatMoney(item.price * item.quantity)} so'm</span>
              </div>
            `).join('')}

            ${order.serviceFee > 0 ? `
              <div class="order-item-row" style="color: var(--gray-600); font-size: 12px;">
                <span>Xizmat haqi</span>
                <span>${formatMoney(order.serviceFee)} so'm</span>
              </div>
            ` : ''}

            <div class="order-total-row">
              <span>Jami:</span>
              <span>${formatMoney(order.totalPrice)} so'm</span>
            </div>
          `}

          ${order.note && !isWaiterCall ? `
            <div class="order-note-box">
              <i class="fa-regular fa-comment-dots"></i> "${order.note}"
            </div>
          ` : ''}
        </div>

        <div class="order-actions">
          ${order.status === 'new' ? `
            <button class="btn-status" style="background:#fef3c7; color:#b45309;" onclick="setOrderStatus('${order.id}', 'preparing')">
              <i class="fa-solid fa-fire"></i> Tayyorlash
            </button>
            <button class="btn-status" style="background:#fee2e2; color:#b91c1c;" onclick="setOrderStatus('${order.id}', 'cancelled')">
              Bekor qilish
            </button>
          ` : ''}

          ${order.status === 'preparing' ? `
            <button class="btn-status" style="background:#dbeafe; color:#1d4ed8;" onclick="setOrderStatus('${order.id}', 'ready')">
              <i class="fa-solid fa-bell-concierge"></i> Tayyor bo'ldi
            </button>
          ` : ''}

          ${order.status === 'ready' ? `
            <button class="btn-status" style="background:#dcfce7; color:#15803d;" onclick="setOrderStatus('${order.id}', 'delivered')">
              <i class="fa-solid fa-check"></i> Yetkazildi
            </button>
          ` : ''}

          ${['delivered', 'cancelled'].includes(order.status) ? `
            <div style="text-align: center; width: 100%; font-size: 12px; color: var(--gray-400);">
              Yopilgan
            </div>
          ` : ''}
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

async function setOrderStatus(orderId, status) {
  let reason = null;
  if (status === 'cancelled') {
    reason = prompt("Buyurtmani bekor qilish sababini kiriting (masalan: Mijoz rad etdi, Taom tugagan, Oshxona kechikdi):", "Mijoz rad etdi");
    if (reason === null) return; // Bekor qilish oynasida 'Cancel' bosilsa
    reason = reason.trim() || 'Sabab ko\'rsatilmadi';
  }

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason })
    });
    const data = await res.json();
    if (data.success) {
      loadOrders();
      if (currentRole === 'waiter') loadWaiterData();
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

// ==================== 2. TAOMLAR (MENU) ====================
async function loadMenu() {
  if (!currentRestaurant) return;
  try {
    // Kategoriyalarni ham olamiz
    const catRes = await fetch(`/api/admin/categories/${currentRestaurant.id}`);
    const catData = await catRes.json();
    if (catData.success) currentCategories = catData.categories;

    const res = await fetch(`/api/admin/menu/${currentRestaurant.id}`);
    const data = await res.json();
    if (data.success) {
      currentMenu = data.menuItems;
      renderDishesTable();
    }
  } catch (err) {
    console.error("Menyuni yuklashda xatolik:", err);
  }
}

function renderDishesTable() {
  const tbody = document.getElementById('dishesTableBody');
  const search = document.getElementById('dishSearchInput').value.toLowerCase();

  let list = currentMenu;
  if (search) {
    list = list.filter(d => (d.nameUz + ' ' + d.nameRu + ' ' + d.nameEn).toLowerCase().includes(search));
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--gray-400); padding: 30px;">Taomlar topilmadi</td></tr>`;
    return;
  }

  let html = '';
  list.forEach(dish => {
    const cat = currentCategories.find(c => c.id === dish.categoryId);
    const catName = cat ? cat.nameUz : '-';

    html += `
      <tr>
        <td>
          <img src="${dish.image}" class="dish-thumb" alt="${dish.nameUz}">
        </td>
        <td>
          <b>${dish.nameUz}</b>
          ${dish.isPopular ? '<span style="font-size:10px; background:#ffedd5; color:#f97316; padding:2px 6px; border-radius:4px; margin-left:4px;">Mashhur</span>' : ''}
          <div style="font-size: 11px; color: var(--gray-400);">${dish.nameRu || ''}</div>
        </td>
        <td>${catName}</td>
        <td><b>${formatMoney(dish.price)} so'm</b></td>
        <td>${dish.weight || '-'}</td>
        <td>
          <button type="button" onclick="toggleDishAvailability('${dish.id}')" title="Bosib o'zgartirish" style="cursor:pointer; border:none; display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:4px 10px; border-radius:6px; ${dish.isAvailable !== false ? 'background:#d1fae5; color:#065f46;' : 'background:#fee2e2; color:#991b1b;'}">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${dish.isAvailable !== false ? '#10b981' : '#ef4444'};"></span>
            ${dish.isAvailable !== false ? 'Mavjud' : 'Tugagan (Stop)'}
          </button>
        </td>
        <td style="text-align: right;">
          <div class="action-btns" style="justify-content: flex-end;">
            <button class="btn-icon" title="Tahrirlash" onclick="openDishModal('${dish.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon delete" title="O'chirish" onclick="deleteDish('${dish.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function openDishModal(dishId = null) {
  // Kategoriya selectini to'ldirish
  const select = document.getElementById('dishCategorySelect');
  select.innerHTML = '';
  currentCategories.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.nameUz}</option>`;
  });

  if (dishId) {
    const dish = currentMenu.find(d => d.id === dishId);
    if (!dish) return;
    document.getElementById('dishModalTitle').innerText = "Taomni tahrirlash";
    document.getElementById('dishEditId').value = dish.id;
    document.getElementById('dishCategorySelect').value = dish.categoryId;
    document.getElementById('dishNameUz').value = dish.nameUz;
    document.getElementById('dishNameRu').value = dish.nameRu || '';
    document.getElementById('dishNameEn').value = dish.nameEn || '';
    document.getElementById('dishPrice').value = dish.price;
    document.getElementById('dishWeight').value = dish.weight || '';
    document.getElementById('dishImageUrl').value = dish.image || '';
    document.getElementById('dishDescUz').value = dish.descriptionUz || '';
    document.getElementById('dishIsPopular').checked = !!dish.isPopular;
  } else {
    document.getElementById('dishModalTitle').innerText = "Yangi taom qo'shish";
    document.getElementById('dishEditId').value = '';
    document.getElementById('dishForm').reset();
  }

  document.getElementById('dishModal').style.display = 'flex';
}

function closeDishModal() {
  document.getElementById('dishModal').style.display = 'none';
}

async function saveDish(e) {
  e.preventDefault();
  const editId = document.getElementById('dishEditId').value;
  const formData = new FormData();

  formData.append('restaurantId', currentRestaurant.id);
  formData.append('categoryId', document.getElementById('dishCategorySelect').value);
  formData.append('nameUz', document.getElementById('dishNameUz').value);
  formData.append('nameRu', document.getElementById('dishNameRu').value);
  formData.append('nameEn', document.getElementById('dishNameEn').value);
  formData.append('price', document.getElementById('dishPrice').value);
  formData.append('weight', document.getElementById('dishWeight').value);
  formData.append('imageUrl', document.getElementById('dishImageUrl').value);
  formData.append('descriptionUz', document.getElementById('dishDescUz').value);
  formData.append('isPopular', document.getElementById('dishIsPopular').checked);

  const fileInput = document.getElementById('dishImageFile');
  if (fileInput.files.length > 0) {
    formData.append('imageFile', fileInput.files[0]);
  }

  try {
    let url = '/api/admin/menu';
    let method = 'POST';
    if (editId) {
      url = `/api/admin/menu/${editId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      closeDishModal();
      loadMenu();
    } else {
      alert("Xatolik: " + data.message);
    }
  } catch (err) {
    alert("Saqlashda xatolik: " + err.message);
  }
}

async function deleteDish(id) {
  if (!confirm("Haqiqatan ham bu taomni o'chirmoqchimisiz?")) return;
  try {
    const res = await fetch(`/api/admin/menu/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadMenu();
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

// ==================== 3. KATEGORIYALAR ====================
async function loadCategories() {
  if (!currentRestaurant) return;
  try {
    const res = await fetch(`/api/admin/categories/${currentRestaurant.id}`);
    const data = await res.json();
    if (data.success) {
      currentCategories = data.categories;
      renderCategoriesTable();
    }
  } catch (e) {
    console.error("Kategoriyalarni yuklashda xatolik:", e);
  }
}

function renderCategoriesTable() {
  const tbody = document.getElementById('categoriesTableBody');
  if (currentCategories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--gray-400);">Kategoriyalar mavjud emas</td></tr>`;
    return;
  }

  let html = '';
  currentCategories.forEach((cat, idx) => {
    html += `
      <tr>
        <td>${cat.sortOrder || idx + 1}</td>
        <td><b>${cat.nameUz}</b></td>
        <td>${cat.nameRu || '-'}</td>
        <td>${cat.nameEn || '-'}</td>
        <td><i class="${cat.icon || 'fa-solid fa-utensils'}" style="color:var(--primary); font-size:16px;"></i></td>
        <td style="text-align: right;">
          <div class="action-btns" style="justify-content: flex-end;">
            <button class="btn-icon" title="Tahrirlash" onclick="openCategoryModal('${cat.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon delete" title="O'chirish" onclick="deleteCategory('${cat.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function openCategoryModal(catId = null) {
  const form = document.getElementById('categoryForm');
  const title = document.getElementById('catModalTitle');
  form.reset();

  if (catId) {
    const cat = currentCategories.find(c => c.id === catId);
    if (cat) {
      if (title) title.innerText = "Kategoriyani tahrirlash";
      document.getElementById('catEditId').value = cat.id;
      document.getElementById('catNameUz').value = cat.nameUz;
      document.getElementById('catNameRu').value = cat.nameRu || '';
      document.getElementById('catNameEn').value = cat.nameEn || '';
      document.getElementById('catIcon').value = cat.icon || '';
    }
  } else {
    if (title) title.innerText = "Yangi kategoriya";
    document.getElementById('catEditId').value = '';
  }

  document.getElementById('categoryModal').style.display = 'flex';
}

function closeCategoryModal() {
  document.getElementById('categoryModal').style.display = 'none';
}

async function saveCategory(e) {
  e.preventDefault();
  const editId = document.getElementById('catEditId').value;
  const payload = {
    restaurantId: currentRestaurant.id,
    nameUz: document.getElementById('catNameUz').value,
    nameRu: document.getElementById('catNameRu').value,
    nameEn: document.getElementById('catNameEn').value,
    icon: document.getElementById('catIcon').value || 'fa-solid fa-utensils'
  };

  try {
    const url = editId ? `/api/admin/categories/${editId}` : '/api/admin/categories';
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeCategoryModal();
      loadCategories();
    } else {
      alert(data.message || "Kategoriyani saqlashda xatolik");
    }
  } catch (err) {
    alert("Kategoriya saqlashda xatolik: " + err.message);
  }
}

// Taom mavjudligini tezkor o'zgartirish (Stop-list)
async function toggleDishAvailability(dishId) {
  try {
    const res = await fetch(`/api/admin/menu/${dishId}/toggle-availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      const idx = currentMenu.findIndex(d => d.id === dishId);
      if (idx !== -1) {
        currentMenu[idx].isAvailable = data.menuItem.isAvailable;
      }
      renderDishesTable();
    }
  } catch (err) {
    alert("Taom mavjudligini o'zgartirishda xatolik: " + err.message);
  }
}
window.toggleDishAvailability = toggleDishAvailability;


async function deleteCategory(id) {
  if (!confirm("Diqqat! Ushbu kategoriyani o'chirsangiz, unga tegishli taomlar ham o'chib ketadi. Rozimisiz?")) return;
  try {
    const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadCategories();
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

// ==================== 4. STOLLAR & QR KODLAR ====================
async function loadQRCodes() {
  if (!currentRestaurant) return;
  document.getElementById('qrTablesCount').value = currentRestaurant.tablesCount || 10;

  try {
    const res = await fetch(`/api/admin/qr-codes/${currentRestaurant.id}`);
    const data = await res.json();
    if (data.success) {
      const grid = document.getElementById('qrStickersGrid');
      let html = '';

      data.qrCodes.forEach(qr => {
        html += `
          <div class="qr-card">
            <div class="qr-rest-title">${currentRestaurant.name}</div>
            <div class="qr-table-badge">STOL № ${qr.tableNumber}</div>
            <img class="qr-image" src="${qr.qrDataUrl}" alt="QR Kod">
            <div class="qr-instruction">
              <i class="fa-solid fa-camera" style="color:var(--primary);"></i> Menyu uchun skanerlang
            </div>
            <a href="${qr.targetUrl}" target="_blank" class="no-print" style="font-size:11px; color:var(--primary); text-decoration:none; margin-top:8px; font-weight:600;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Sinab ko'rish (Stol ${qr.tableNumber})
            </a>
            <a href="${qr.qrDataUrl}" download="${currentRestaurant.slug}-stol-${qr.tableNumber}.png" class="btn-submit no-print" style="width:auto; margin-top:8px; padding:5px 12px; font-size:11px; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-solid fa-download"></i> Yuklab olish
            </a>
          </div>
        `;
      });

      grid.innerHTML = html;
    }
  } catch (e) {
    console.error("QR kodlarni yuklashda xatolik:", e);
  }
}

async function updateTablesCount() {
  const count = Number(document.getElementById('qrTablesCount').value);
  if (!count || count < 1) return alert("Stollar soni kamida 1 bo'lishi kerak");

  try {
    const res = await fetch(`/api/admin/restaurant/${currentRestaurant.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tablesCount: count })
    });
    const data = await res.json();
    if (data.success) {
      currentRestaurant.tablesCount = count;
      localStorage.setItem('admin_restaurant', JSON.stringify(currentRestaurant));
      loadQRCodes();
      alert("Stollar soni saqlandi!");
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

// ==================== 5. SOZLAMALAR ====================
function loadSettings() {
  if (!currentRestaurant) return;
  document.getElementById('settingName').value = currentRestaurant.name || '';
  document.getElementById('settingPhone').value = currentRestaurant.phone || '';
  document.getElementById('settingAddress').value = currentRestaurant.address || '';
  document.getElementById('settingDesc').value = currentRestaurant.description || '';
  document.getElementById('settingFee').value = currentRestaurant.serviceFeePercent || 0;
  document.getElementById('settingCurrency').value = currentRestaurant.currency || "so'm";

  // Brending
  if (document.getElementById('settingLogoPreview')) {
    document.getElementById('settingLogoPreview').src = currentRestaurant.logo || '/images/logo.png';
    document.getElementById('settingLogoUrl').value = currentRestaurant.logo || '';
    document.getElementById('settingBannerPreview').src = currentRestaurant.banner || '/images/logo.png';
    document.getElementById('settingBannerUrl').value = currentRestaurant.banner || '';
  }

  // Ish vaqti
  if (document.getElementById('settingOpenTime')) {
    document.getElementById('settingOpenTime').value = currentRestaurant.openTime || '09:00';
    document.getElementById('settingCloseTime').value = currentRestaurant.closeTime || '23:00';
    document.getElementById('settingWorkDays').value = currentRestaurant.workDays || 'Har kuni';
  }

  // Wi-Fi
  if (document.getElementById('settingWifiName')) {
    document.getElementById('settingWifiName').value = currentRestaurant.wifiName || '';
    document.getElementById('settingWifiPass').value = currentRestaurant.wifiPass || '';
  }

  // Kassa & INN
  if (document.getElementById('settingInn')) {
    document.getElementById('settingInn').value = currentRestaurant.inn || '';
    document.getElementById('settingReceiptFooter').value = currentRestaurant.receiptFooter || 'Tashrifingiz uchun rahmat!';
  }

  // Parol
  if (document.getElementById('settingNewPass')) {
    document.getElementById('settingNewPass').value = '';
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const formData = new FormData();

  formData.append('name', document.getElementById('settingName').value);
  formData.append('phone', document.getElementById('settingPhone').value);
  formData.append('address', document.getElementById('settingAddress').value);
  formData.append('description', document.getElementById('settingDesc').value);
  formData.append('serviceFeePercent', document.getElementById('settingFee').value);
  formData.append('currency', document.getElementById('settingCurrency').value || "so'm");

  // Brending
  const logoUrl = document.getElementById('settingLogoUrl')?.value.trim();
  if (logoUrl) formData.append('logo', logoUrl);
  const logoFile = document.getElementById('settingLogoFile')?.files[0];
  if (logoFile) formData.append('logoFile', logoFile);

  const bannerUrl = document.getElementById('settingBannerUrl')?.value.trim();
  if (bannerUrl) formData.append('banner', bannerUrl);
  const bannerFile = document.getElementById('settingBannerFile')?.files[0];
  if (bannerFile) formData.append('bannerFile', bannerFile);

  // Ish vaqti
  formData.append('openTime', document.getElementById('settingOpenTime')?.value || '09:00');
  formData.append('closeTime', document.getElementById('settingCloseTime')?.value || '23:00');
  formData.append('workDays', document.getElementById('settingWorkDays')?.value || 'Har kuni');

  // Wi-Fi
  formData.append('wifiName', document.getElementById('settingWifiName')?.value.trim() || '');
  formData.append('wifiPass', document.getElementById('settingWifiPass')?.value.trim() || '');

  // Kassa & INN
  formData.append('inn', document.getElementById('settingInn')?.value.trim() || '');
  formData.append('receiptFooter', document.getElementById('settingReceiptFooter')?.value.trim() || 'Tashrifingiz uchun rahmat!');

  // Parol
  const newPass = document.getElementById('settingNewPass')?.value.trim();
  if (newPass) {
    formData.append('password', newPass);
  }

  try {
    const res = await fetch(`/api/admin/restaurant/${currentRestaurant.id}`, {
      method: 'PUT',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      currentRestaurant = { ...currentRestaurant, ...data.restaurant };
      localStorage.setItem('admin_restaurant', JSON.stringify(currentRestaurant));
      document.getElementById('sideBrand').innerText = currentRestaurant.name;
      if (document.getElementById('sideLogo') && currentRestaurant.logo) {
        document.getElementById('sideLogo').src = currentRestaurant.logo;
      }
      loadSettings();
      alert("Restoran sozlamalari muvaffaqiyatli saqlandi!");
    } else {
      alert(data.message || "Xatolik yuz berdi");
    }
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}


// ==================== 6. BOSHLIQ (MOLIYA & TAHLIL) ====================
let currentBossStats = null;

// Sotuvlar hisobotini Excel (CSV) formatida yuklab olish
function exportSalesReportCSV() {
  if (!currentOrders || currentOrders.length === 0) {
    alert("Yuklab olish uchun buyurtmalar mavjud emas!");
    return;
  }

  const rows = [
    ["Buyurtma ID", "Stol", "Sana va Vaqt", "Taomlar", "Jami Summa (so'm)", "To'lov Usuli", "Holati"]
  ];

  currentOrders.forEach(o => {
    const itemsStr = (o.items || []).map(i => `${i.name} x${i.quantity}`).join('; ');
    const timeStr = o.createdAt ? new Date(o.createdAt).toLocaleString() : '';
    rows.push([
      o.id,
      `Stol ${o.tableNumber}`,
      timeStr,
      `"${itemsStr}"`,
      o.totalPrice || 0,
      o.paymentMethod || 'Kutilmoqda',
      o.status || 'new'
    ]);
  });

  const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Hisobot_${currentRestaurant?.slug || 'restoran'}_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.exportSalesReportCSV = exportSalesReportCSV;

// ==================== 6. BOSHLIQ (MOLIYA & TAHLIL) ====================
let bossSalesTrendChart = null;
let bossPeakHoursChart = null;
let bossWaitersChart = null;
let bossPaymentChart = null;
let currentBossPeriod = 'today';
let currentBossStartDate = null;
let currentBossEndDate = null;

function changeBossPeriod(period, btn) {
  currentBossPeriod = period;
  currentBossStartDate = null;
  currentBossEndDate = null;

  document.querySelectorAll('.boss-period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const startInput = document.getElementById('bossStartDate');
  const endInput = document.getElementById('bossEndDate');
  if (startInput) startInput.value = '';
  if (endInput) endInput.value = '';

  const periodLabels = {
    today: 'Bugungi Tushum',
    yesterday: 'Kechagi Tushum',
    week: 'Oxirgi 7 Kunlik Tushum',
    month: 'Shu Oylik Tushum',
    all: 'Barcha Vaqtdagi Tushum'
  };
  const lbl = document.getElementById('bossPeriodLabel');
  if (lbl) lbl.innerText = periodLabels[period] || 'Tanlangan Davr Tushumi';

  loadBossData();
}
window.changeBossPeriod = changeBossPeriod;

function applyBossCustomDate() {
  const start = document.getElementById('bossStartDate')?.value;
  const end = document.getElementById('bossEndDate')?.value;
  if (!start) {
    alert("Iltimos, boshlanish sanasini tanlang!");
    return;
  }
  currentBossPeriod = 'custom';
  currentBossStartDate = start;
  currentBossEndDate = end || start;

  document.querySelectorAll('.boss-period-btn').forEach(b => b.classList.remove('active'));
  const lbl = document.getElementById('bossPeriodLabel');
  if (lbl) lbl.innerText = `${start} - ${end || start} Tushumi`;

  loadBossData();
}
window.applyBossCustomDate = applyBossCustomDate;

function refreshBossAnalytics() {
  loadBossData();
}
window.refreshBossAnalytics = refreshBossAnalytics;

async function loadBossData() {
  if (!currentRestaurant) return;
  loadBossReviews();

  try {
    let url = `/api/admin/boss/analytics/${currentRestaurant.id}?period=${currentBossPeriod}`;
    if (currentBossPeriod === 'custom' && currentBossStartDate) {
      url += `&startDate=${encodeURIComponent(currentBossStartDate)}&endDate=${encodeURIComponent(currentBossEndDate || currentBossStartDate)}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.success && data.analytics) {
      const a = data.analytics;
      a.todayRevenue = a.totalRevenue;
      a.todayOrdersCount = a.ordersCount;
      currentBossStats = a;

      // 1. KPI Kartochkalari
      if (document.getElementById('bossTodayRevenue')) {
        document.getElementById('bossTodayRevenue').innerText = `${formatMoney(a.totalRevenue)} so'm`;
      }
      if (document.getElementById('bossTodayOrders')) {
        document.getElementById('bossTodayOrders').innerText = `${a.ordersCount} ta buyurtma`;
      }
      if (document.getElementById('bossAvgCheck')) {
        document.getElementById('bossAvgCheck').innerText = `${formatMoney(a.averageCheck)} so'm`;
      }
      if (document.getElementById('bossPeakHour')) {
        document.getElementById('bossPeakHour').innerText = a.peakHour || '--:--';
      }
      if (document.getElementById('bossPeakHourRevenue')) {
        document.getElementById('bossPeakHourRevenue').innerText = `Maksimal soatlik savdo: ${formatMoney(a.peakHourRevenue || 0)} so'm`;
      }
      if (document.getElementById('bossYesterdayRevenue')) {
        document.getElementById('bossYesterdayRevenue').innerText = `${formatMoney(a.yesterdayRevenue || 0)} so'm`;
      }
      if (document.getElementById('bossTotalOrdersCount')) {
        document.getElementById('bossTotalOrdersCount').innerText = `${a.ordersCount} ta`;
      }

      // Xizmat haqi va Bekor qilinganlar (Zarar)
      if (document.getElementById('bossServiceFeeTotal')) {
        document.getElementById('bossServiceFeeTotal').innerText = `${formatMoney(a.serviceFeeTotal || 0)} so'm`;
      }
      if (document.getElementById('bossCancelledTotal')) {
        document.getElementById('bossCancelledTotal').innerText = `${formatMoney(a.cancelledTotal || 0)} so'm`;
      }
      if (document.getElementById('bossCancelledBadge')) {
        document.getElementById('bossCancelledBadge').innerText = `${a.cancelledOrdersCount || 0} ta bekor`;
      }

      // 2. To'lov usullari matnlari
      if (document.getElementById('bossCashTotal')) {
        document.getElementById('bossCashTotal').innerText = `${formatMoney(a.cashTotal)} so'm`;
      }
      if (document.getElementById('bossCardTotal')) {
        document.getElementById('bossCardTotal').innerText = `${formatMoney(a.cardTotal)} so'm`;
      }
      if (document.getElementById('bossClickTotal')) {
        document.getElementById('bossClickTotal').innerText = `${formatMoney(a.clickTotal)} so'm`;
      }

      // 3. Taomlar ro'yxati (Top 5 yoki Kam sotilganlar)
      renderDishesList();

      // 4. Ofitsiantlar jadvali
      const waiterTableBody = document.getElementById('bossWaitersTableBody');
      if (waiterTableBody) {
        if (!a.waiterPerformance || a.waiterPerformance.length === 0) {
          waiterTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px; color:var(--gray-400);">Xodimlar bo'yicha ma'lumot yo'q</td></tr>`;
        } else {
          let html = '';
          a.waiterPerformance.forEach(w => {
            html += `
              <tr>
                <td><b><i class="fa-solid fa-user-check" style="color:#8b5cf6; margin-right:6px;"></i>${w.name}</b></td>
                <td style="text-align:center;"><span style="background:#f3e8ff; color:#7e22ce; padding:2px 8px; border-radius:999px; font-weight:700;">${w.count} ta</span></td>
                <td style="text-align:right; font-weight:800; color:#16a34a;">${formatMoney(w.revenue)} so'm</td>
                <td style="text-align:right; color:#2563eb; font-weight:700;">${formatMoney(w.averageCheck)} so'm</td>
              </tr>
            `;
          });
          waiterTableBody.innerHTML = html;
        }
      }

      // 5. 4 ta vizual grafikni render qilish
      renderBossCharts(a);
    }
  } catch (e) {
    console.error("Boshliq ma'lumotlarini yuklashda xatolik:", e);
  }
}

let currentDishesView = 'top';

function toggleDishesView(mode) {
  currentDishesView = mode;
  const btnTop = document.getElementById('btnDishesTop');
  const btnLeast = document.getElementById('btnDishesLeast');
  if (btnTop) btnTop.classList.toggle('active', mode === 'top');
  if (btnLeast) btnLeast.classList.toggle('active', mode === 'least');
  renderDishesList();
}
window.toggleDishesView = toggleDishesView;

function renderDishesList() {
  const topList = document.getElementById('bossTopDishesList');
  if (!topList) return;

  const a = currentBossStats || {};
  const isTop = currentDishesView === 'top';
  const list = isTop ? (a.topDishes || []) : (a.leastDishes || []);

  if (list.length === 0) {
    topList.innerHTML = `<div style="color:var(--gray-400); font-size:13px; text-align:center; padding:12px;">Tanlangan davrda taomlar ma'lumoti yo'q</div>`;
    return;
  }

  let html = '';
  list.forEach((d, idx) => {
    const badgeColor = isTop ? 'var(--primary)' : '#dc2626';
    const subtextColor = d.count === 0 ? '#ef4444' : 'var(--gray-600)';
    const countLabel = d.count === 0 ? 'Umuman sotilmadi (0 ta)' : `${d.count} ta sotilgan`;

    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--gray-100); border-radius:8px; font-size:13px;">
        <div>
          <b>#${idx + 1} ${d.name}</b>
          <div style="font-size:11px; color:${subtextColor}; font-weight:600;">${countLabel}</div>
        </div>
        <span style="font-weight:800; color:${badgeColor};">${formatMoney(d.revenue)} so'm</span>
      </div>
    `;
  });
  topList.innerHTML = html;
}

function copyBossDailySummary() {
  const s = currentBossStats || {};
  const restName = currentRestaurant?.name || 'Restoran';
  const now = new Date();
  const dateStr = now.toLocaleDateString('uz-UZ');
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const periodNames = {
    today: 'Bugun',
    yesterday: 'Kecha',
    week: 'Oxirgi 7 kun',
    month: 'Shu oy',
    all: 'Barcha vaqt'
  };
  const periodTitle = periodNames[currentBossPeriod] || 'Bugun';

  const text = [
    `📊 ${restName} — Moliyaviy Xulosa (${periodTitle})`,
    `📅 Sana: ${dateStr} ${timeStr}`,
    `--------------------------------`,
    `💰 Jami tushum: ${formatMoney(s.totalRevenue || 0)} so'm`,
    `🧾 Buyurtmalar soni: ${s.ordersCount || 0} ta`,
    `🎯 O'rtacha chek: ${formatMoney(s.averageCheck || 0)} so'm`,
    `⚡ Eng qizg'in vaqt: ${s.peakHour || '--'}`,
    `--------------------------------`,
    `💵 Naqd pul: ${formatMoney(s.cashTotal || 0)} so'm`,
    `💳 Plastik karta: ${formatMoney(s.cardTotal || 0)} so'm`,
    `📱 Click / Payme: ${formatMoney(s.clickTotal || 0)} so'm`,
    `🛎️ Xizmat haqi: ${formatMoney(s.serviceFeeTotal || 0)} so'm`,
    `🚫 Bekor qilingan: ${s.cancelledOrdersCount || 0} ta (${formatMoney(s.cancelledTotal || 0)} so'm)`,
    `--------------------------------`,
    `🏆 Top taom: ${s.topDishes?.[0] ? `${s.topDishes[0].name} (${s.topDishes[0].count} ta)` : "Yo'q"}`
  ].join('\n');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Qisqa hisobot nusxalandi! Endi uni Telegram yoki xabarlarga tashlashingiz mumkin.");
    }).catch(() => {
      prompt("Hisobot matni:", text);
    });
  } else {
    prompt("Hisobot matni:", text);
  }
}
window.copyBossDailySummary = copyBossDailySummary;

function renderBossCharts(a) {
  if (typeof Chart === 'undefined') {
    console.warn("Chart.js kutubxonasi yuklanmagan!");
    return;
  }

  // 1. Savdo Dinamikasi Grafigi (Line)
  const salesCanvas = document.getElementById('chartSalesTrend');
  if (salesCanvas) {
    const ctx = salesCanvas.getContext('2d');
    if (bossSalesTrendChart) bossSalesTrendChart.destroy();

    const dailyLabels = (a.dailySales && a.dailySales.length > 0)
      ? a.dailySales.map(d => d.date.slice(5))
      : [new Date().toISOString().slice(5, 10)];
    const dailyValues = (a.dailySales && a.dailySales.length > 0)
      ? a.dailySales.map(d => d.revenue)
      : [a.totalRevenue || 0];

    bossSalesTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dailyLabels,
        datasets: [{
          label: "Savdo tushumi (so'm)",
          data: dailyValues,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#10b981',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Tushum: ${formatMoney(ctx.raw)} so'm`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => formatMoney(val)
            },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // 2. Eng Qizg'in Soatlar Grafigi (Bar)
  const peakCanvas = document.getElementById('chartPeakHours');
  if (peakCanvas) {
    const ctx = peakCanvas.getContext('2d');
    if (bossPeakHoursChart) bossPeakHoursChart.destroy();

    const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const hourData = a.hourlySales || Array(24).fill(0);

    const maxVal = Math.max(...hourData);
    const backgroundColors = hourData.map(v => (v > 0 && v === maxVal) ? '#ea580c' : '#f59e0b');

    bossPeakHoursChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: hourLabels,
        datasets: [{
          label: "Soatlik savdo (so'm)",
          data: hourData,
          backgroundColor: backgroundColors,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Tushum: ${formatMoney(ctx.raw)} so'm`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => formatMoney(val)
            },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // 3. Ofitsiantlar Ish Unumdorligi Grafigi (Horizontal Bar)
  const waiterCanvas = document.getElementById('chartWaiters');
  if (waiterCanvas) {
    const ctx = waiterCanvas.getContext('2d');
    if (bossWaitersChart) bossWaitersChart.destroy();

    const waiterLabels = (a.waiterPerformance && a.waiterPerformance.length > 0)
      ? a.waiterPerformance.map(w => w.name)
      : ['Xodimlar'];
    const waiterRevenues = (a.waiterPerformance && a.waiterPerformance.length > 0)
      ? a.waiterPerformance.map(w => w.revenue)
      : [0];

    bossWaitersChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: waiterLabels,
        datasets: [{
          label: "Keltirgan tushum (so'm)",
          data: waiterRevenues,
          backgroundColor: '#8b5cf6',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Jami tushum: ${formatMoney(ctx.raw)} so'm`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (val) => formatMoney(val)
            },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          y: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // 4. To'lov Usullari Taqsimoti Grafigi (Doughnut)
  const paymentCanvas = document.getElementById('chartPaymentMethods');
  if (paymentCanvas) {
    const ctx = paymentCanvas.getContext('2d');
    if (bossPaymentChart) bossPaymentChart.destroy();

    const cash = a.cashTotal || 0;
    const card = a.cardTotal || 0;
    const click = a.clickTotal || 0;
    const hasData = (cash + card + click) > 0;

    bossPaymentChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Naqd pul', 'Plastik Karta', 'Click / Payme'],
        datasets: [{
          data: hasData ? [cash, card, click] : [1, 0, 0],
          backgroundColor: hasData ? ['#16a34a', '#2563eb', '#7c3aed'] : ['#e2e8f0', '#e2e8f0', '#e2e8f0'],
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (!hasData) return " Hozircha to'lovlar yo'q";
                const total = cash + card + click;
                const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0;
                return ` ${ctx.label}: ${formatMoney(ctx.raw)} so'm (${pct}%)`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }
}

async function loadBossReviews() {
  if (!currentRestaurant) return;
  try {
    const res = await fetch(`/api/admin/reviews/${currentRestaurant.id}`);
    const data = await res.json();
    if (data.success) {
      if (document.getElementById('bossAvgRating')) {
        document.getElementById('bossAvgRating').innerText = data.averageRating.toFixed(1);
      }
      if (document.getElementById('bossTotalReviews')) {
        document.getElementById('bossTotalReviews').innerText = `(Bugun: ${data.totalCount} ta sharh)`;
      }

      const container = document.getElementById('bossReviewsList');
      if (!container) return;

      if (!data.reviews || data.reviews.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px 12px; color:var(--gray-400); font-size:13px;"><i class="fa-regular fa-calendar-check" style="font-size:24px; display:block; margin-bottom:6px; color:var(--gray-300);"></i> Bugun hali mijozlar tomonidan yangi fikr-mulohaza qoldirilmadi</div>`;
        return;
      }

      let html = '';
      data.reviews.forEach(r => {
        const stars = '⭐'.repeat(r.rating || 5);
        const timeStr = r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        html += `
          <div style="background:var(--gray-100); border-radius:10px; padding:10px 14px; display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:800; font-size:13px;">Stol ${r.tableNumber}</span>
                <span>${stars}</span>
                <span style="font-size:11px; color:var(--gray-400);">${timeStr}</span>
              </div>
              <p style="margin:4px 0 0; font-size:13px; color:var(--dark);">${r.comment || 'Izoh qoldirilmagan'}</p>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
    }
  } catch (e) {
    console.warn("Reviews load error:", e);
  }
}

function openBossReportModal() {
  if (!currentBossStats) {
    loadBossData().then(() => renderBossReportContent());
  } else {
    renderBossReportContent();
  }
  document.getElementById('bossReportModal').style.display = 'flex';
}

function closeBossReportModal() {
  document.getElementById('bossReportModal').style.display = 'none';
}

function renderBossReportContent() {
  const s = currentBossStats || {};
  const container = document.getElementById('printableBossReport');
  const now = new Date();

  container.innerHTML = `
    <div style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:16px;">
      <h2 style="margin:0; font-size:20px; font-weight:900; color:#0f172a;">${currentRestaurant.name}</h2>
      <p style="margin:2px 0 0; font-size:12px; color:#475569;">KORXONA RAHBARI UCHUN MOLIYAVIY VA SAVDO HISOBOTI</p>
      <p style="margin:2px 0 0; font-size:11px; color:#64748b;">Sana va vaqt: <b>${now.toLocaleDateString()} ${now.toLocaleTimeString()}</b></p>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:13px;">
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:6px 0; color:#475569;">Bugungi tushum:</td>
        <td style="padding:6px 0; text-align:right; font-weight:900; color:#10b981;">${formatMoney(s.todayRevenue)} so'm</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:6px 0; color:#475569;">Kechagi tushum:</td>
        <td style="padding:6px 0; text-align:right; font-weight:700; color:#8b5cf6;">${formatMoney(s.yesterdayRevenue || 0)} so'm</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:6px 0; color:#475569;">Bugungi buyurtmalar soni:</td>
        <td style="padding:6px 0; text-align:right; font-weight:700;">${s.todayOrdersCount || 0} ta</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:6px 0; color:#475569;">O'rtacha chek:</td>
        <td style="padding:6px 0; text-align:right; font-weight:700; color:#2563eb;">${formatMoney(s.averageCheck)} so'm</td>
      </tr>
      <tr style="border-bottom:2px solid #0f172a;">
        <td style="padding:8px 0; font-weight:800;">Jami tushum (Hamma vaqt):</td>
        <td style="padding:8px 0; text-align:right; font-weight:900; font-size:15px; color:#f59e0b;">${formatMoney(s.totalRevenue)} so'm</td>
      </tr>
    </table>

    <div style="margin-bottom:16px;">
      <h4 style="margin:0 0 8px; font-size:13px; font-weight:800; text-transform:uppercase; color:#0f172a;">To'lov Usullari Taqsimoti:</h4>
      <div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0;">
        <span>💵 Naqd pul:</span>
        <b>${formatMoney(s.cashTotal)} so'm</b>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0;">
        <span>💳 Plastik karta (Uzcard/Humo):</span>
        <b>${formatMoney(s.cardTotal)} so'm</b>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0;">
        <span>📱 Click / Payme:</span>
        <b>${formatMoney(s.clickTotal)} so'm</b>
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <h4 style="margin:0 0 8px; font-size:13px; font-weight:800; text-transform:uppercase; color:#0f172a;">Eng Ko'p Sotilgan Taomlar (Top 5):</h4>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="background:#f1f5f9; text-align:left;">
          <th style="padding:6px;">№</th>
          <th style="padding:6px;">Taom nomi</th>
          <th style="padding:6px; text-align:center;">Soni</th>
          <th style="padding:6px; text-align:right;">Summasi</th>
        </tr>
        ${(s.topDishes || []).map((d, i) => `
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:6px;">${i + 1}</td>
            <td style="padding:6px;"><b>${d.name}</b></td>
            <td style="padding:6px; text-align:center;">${d.count}</td>
            <td style="padding:6px; text-align:right;">${formatMoney(d.revenue)} so'm</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div style="margin-top:24px; padding-top:14px; border-top:1px dashed #94a3b8; display:flex; justify-content:space-between; font-size:12px;">
      <div>Rahbar imzosi: ______________</div>
      <div>Kassir / Hisobchi: ______________</div>
    </div>
  `;
}

function printBossReport() {
  const content = document.getElementById('printableBossReport').innerHTML;
  const printWindow = window.open('', '_blank', 'width=600,height=700');
  printWindow.document.write(`
    <html>
      <head>
        <title>Moliyaviy Hisobot - ${currentRestaurant.name}</title>
        <style>
          body { font-family: sans-serif; font-size: 13px; margin: 30px; line-height: 1.5; color: #000; }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ==================== 7. KASSA (TO'LOVLAR & CHEK) ====================
let selectedPayMethodType = 'cash';
let currentPayOrder = null;
let currentPayDiscount = 0;
let currentPayFinalAmount = 0;

async function loadCashierData() {
  if (!currentRestaurant) return;
  try {
    const res = await fetch(`/api/admin/orders/${currentRestaurant.id}`);
    const data = await res.json();
    if (data.success) {
      const orders = data.orders;

      // 1. To'lanmagan stollar (unpaid)
      const unpaidOrders = orders.filter(o => o.paymentStatus !== 'paid' && o.type !== 'call_waiter' && o.type !== 'bill_request' && o.status !== 'cancelled');
      const unpaidGrid = document.getElementById('cashierUnpaidGrid');

      if (unpaidOrders.length === 0) {
        unpaidGrid.innerHTML = `
          <div style="grid-column: 1 / -1; background: var(--white); padding: 24px; border-radius: var(--radius-md); text-align: center; color: var(--gray-400); border: 1px solid var(--gray-200);">
            <i class="fa-solid fa-circle-check" style="font-size: 32px; color: #10b981; margin-bottom: 8px;"></i>
            <p style="font-weight: 700; color: var(--dark);">Barcha stollar hisob-kitob qilingan!</p>
            <span style="font-size: 12px;">Hozirda to'lov kutilayotgan stollar mavjud emas.</span>
          </div>
        `;
      } else {
        let html = '';
        unpaidOrders.forEach(o => {
          html += `
            <div class="order-card" style="border: 2px solid #fdba74;">
              <div class="order-header">
                <div class="order-table-num" style="background:#ffedd5; padding:4px 10px; border-radius:8px; color:#ea580c;">
                  <i class="fa-solid fa-chair"></i>
                  <span style="font-weight:900; font-size:16px;">STOL ${o.tableNumber}</span>
                </div>
                <span class="order-status-badge badge-preparing">To'lanmagan</span>
              </div>
              <div style="font-size: 12px; color: var(--gray-600); margin: 8px 0;">
                ${o.items.map(it => `<div>${it.quantity}x ${it.name} (${formatMoney(it.price * it.quantity)} so'm)</div>`).join('')}
              </div>
              <div class="order-total-row" style="margin-top: 10px; font-size: 16px;">
                <span>Jami to'lov:</span>
                <span>${formatMoney(o.totalPrice)} so'm</span>
              </div>
              <button class="btn-submit" style="margin-top: 12px; background: #16a34a;" onclick="openPaymentModal('${o.id}')">
                <i class="fa-solid fa-money-bill-wave"></i> To'lovni qabul qilish
              </button>
            </div>
          `;
        });
        unpaidGrid.innerHTML = html;
      }

      // 2. Bugun to'langan cheklar (paid)
      const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
      const paidTbody = document.getElementById('cashierPaidTableBody');

      if (paidOrders.length === 0) {
        paidTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--gray-400);">Hozircha yopilgan cheklar yo'q</td></tr>`;
      } else {
        let html = '';
        paidOrders.slice(0, 15).forEach(o => {
          let methodIcon = '💵 Naqd';
          if (o.paymentMethod === 'card') methodIcon = '💳 Karta';
          if (o.paymentMethod === 'click') methodIcon = '📱 Click';

          const finalPaid = o.finalAmount !== undefined ? o.finalAmount : o.totalPrice;

          html += `
            <tr>
              <td><code style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-weight:700;">${o.receiptId || o.id}</code></td>
              <td><b>Stol ${o.tableNumber}</b></td>
              <td>${formatDate(o.paidAt || o.createdAt)}</td>
              <td><b>${formatMoney(finalPaid)} so'm</b></td>
              <td><span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700;">${methodIcon}</span></td>
              <td style="text-align:right;">
                <button class="btn-icon" title="Chekni ko'rish / chop etish" onclick="openReceiptModalById('${o.id}')">
                  <i class="fa-solid fa-print"></i>
                </button>
              </td>
            </tr>
          `;
        });
        paidTbody.innerHTML = html;
      }
    }
  } catch (e) {
    console.error("Kassa ma'lumotlarini yuklashda xatolik:", e);
  }
}

function openPaymentModal(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order) return;

  currentPayOrder = order;
  currentPayDiscount = 0;
  currentPayFinalAmount = order.totalPrice;

  document.getElementById('paymentOrderId').value = order.id;
  document.getElementById('paymentModalTitle').innerText = `Stol ${order.tableNumber} - To'lov Qabul Qilish`;

  let itemsHtml = order.items.map(it => `
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
      <span>${it.quantity}x ${it.name}</span>
      <b>${formatMoney(it.price * it.quantity)} so'm</b>
    </div>
  `).join('');

  if (order.serviceFee > 0) {
    itemsHtml += `
      <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:6px; border-top:1px dashed #cbd5e1; color:var(--gray-600);">
        <span>Xizmat haqi:</span>
        <span>${formatMoney(order.serviceFee)} so'm</span>
      </div>
    `;
  }

  itemsHtml += `
    <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:2px solid #cbd5e1; font-size:15px; font-weight:900; color:var(--primary);">
      <span>Jami Summa:</span>
      <span>${formatMoney(order.totalPrice)} so'm</span>
    </div>
  `;

  document.getElementById('paymentOrderDetails').innerHTML = itemsHtml;
  document.getElementById('payDiscountPercent').value = '0';
  document.getElementById('paymentDiscountAmountText').innerText = "0 so'm";
  document.getElementById('payFinalAmountText').innerText = `${formatMoney(currentPayFinalAmount)} so'm`;
  document.getElementById('payReceivedInput').value = '';
  document.getElementById('payChangeText').innerText = "0 so'm";

  const savedCashier = localStorage.getItem('cashier_name') || 'Kassir';
  document.getElementById('payCashierName').value = savedCashier;

  selectPayMethod('cash');
  document.getElementById('paymentModal').style.display = 'flex';
}

function closePaymentModal() {
  document.getElementById('paymentModal').style.display = 'none';
  currentPayOrder = null;
}

function setDiscount(percent, btn) {
  currentPayDiscount = percent;
  document.getElementById('payDiscountPercent').value = percent;

  document.querySelectorAll('.discount-btn').forEach(b => {
    b.classList.toggle('active', b === btn);
  });

  if (currentPayOrder) {
    const discountAmount = Math.round((currentPayOrder.totalPrice * percent) / 100);
    currentPayFinalAmount = Math.max(0, currentPayOrder.totalPrice - discountAmount);
    document.getElementById('paymentDiscountAmountText').innerText = `${formatMoney(discountAmount)} so'm (${percent}%)`;
    document.getElementById('payFinalAmountText').innerText = `${formatMoney(currentPayFinalAmount)} so'm`;
    calcChange();
  }
}

function calcChange() {
  const recInput = document.getElementById('payReceivedInput');
  const received = Number(recInput.value) || 0;
  const change = Math.max(0, received - currentPayFinalAmount);
  document.getElementById('payChangeText').innerText = `${formatMoney(change)} so'm`;
}

function selectPayMethod(method) {
  selectedPayMethodType = method;
  ['cash', 'card', 'click'].forEach(m => {
    const btn = document.getElementById(`payMethod-${m}`);
    if (btn) {
      btn.style.border = (m === method ? '2px solid var(--primary)' : '1px solid var(--gray-200)');
      btn.style.background = (m === method ? 'var(--primary-light)' : 'var(--white)');
    }
  });

  // Naqd bo'lsa qaytim kalkulyatorini ko'rsatish
  const cashBlock = document.getElementById('cashCalcBlock');
  if (cashBlock) cashBlock.style.display = (method === 'cash' ? 'block' : 'none');
}

async function confirmPayment() {
  const orderId = document.getElementById('paymentOrderId').value;
  if (!orderId) return;

  const cashierName = document.getElementById('payCashierName')?.value.trim() || 'Kassir';
  localStorage.setItem('cashier_name', cashierName);

  const discountPercent = Number(document.getElementById('payDiscountPercent')?.value) || 0;
  const receivedAmount = Number(document.getElementById('payReceivedInput')?.value) || currentPayFinalAmount;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: selectedPayMethodType,
        discountPercent,
        receivedAmount,
        cashierName
      })
    });
    const data = await res.json();
    if (data.success) {
      closePaymentModal();
      loadCashierData();
      loadOrders();
      openReceiptModal(data.order);
    } else {
      alert("Xatolik: " + data.message);
    }
  } catch (e) {
    alert("To'lovni tasdiqlashda xatolik: " + e.message);
  }
}

function openReceiptModalById(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (order) openReceiptModal(order);
}

function openReceiptModal(order) {
  const receiptDiv = document.getElementById('printableReceipt');
  let payText = 'NAQD PUL';
  if (order.paymentMethod === 'card') payText = 'PLASTIK KARTA';
  if (order.paymentMethod === 'click') payText = 'CLICK / PAYME';

  const finalAmount = order.finalAmount !== undefined ? order.finalAmount : order.totalPrice;

  receiptDiv.innerHTML = `
    <div style="text-align:center; margin-bottom:12px;">
      <h3 style="margin:0; font-size:16px; font-weight:900;">${currentRestaurant.name}</h3>
      <p style="margin:2px 0 0; font-size:11px;">${currentRestaurant.address || 'Toshkent sh.'}</p>
      <p style="margin:0; font-size:11px;">Tel: ${currentRestaurant.phone || '-'}</p>
    </div>
    <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; margin-bottom:10px;">
      <div>CHEK №: <b>${order.receiptId || order.id}</b></div>
      ${currentRestaurant.inn ? `<div>INN: <b>${currentRestaurant.inn}</b></div>` : ''}
      <div>SANA: <b>${formatDate(order.paidAt || order.createdAt)}</b></div>
      <div>STOL: <b>STOL ${order.tableNumber}</b></div>
      <div>KASSIR: <b>${order.cashierName || 'Kassir'}</b></div>
    </div>
    <div style="margin-bottom:10px;">
      ${order.items.map(it => `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>${it.name} x ${it.quantity}</span>
          <span>${formatMoney(it.price * it.quantity)}</span>
        </div>
      `).join('')}
    </div>
    <div style="border-top:1px dashed #000; padding-top:6px; margin-bottom:6px;">
      ${order.serviceFee > 0 ? `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>Xizmat haqi:</span>
          <span>${formatMoney(order.serviceFee)}</span>
        </div>
      ` : ''}
      ${(order.discountAmount > 0) ? `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#ef4444;">
          <span>Chegirma (${order.discountPercent}%):</span>
          <span>-${formatMoney(order.discountAmount)}</span>
        </div>
      ` : ''}
      <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:900;">
        <span>JAMI TO'LOV:</span>
        <span>${formatMoney(finalAmount)} SO'M</span>
      </div>
      <div style="margin-top:4px; font-size:11px;">
        To'lov usuli: <b>${payText}</b>
      </div>
      ${(order.paymentMethod === 'cash' && order.receivedAmount > finalAmount) ? `
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:2px;">
          <span>Berildi:</span>
          <span>${formatMoney(order.receivedAmount)} SO'M</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:2px; font-weight:700;">
          <span>Qaytim:</span>
          <span>${formatMoney(order.changeAmount)} SO'M</span>
        </div>
      ` : ''}
    </div>
    <div style="text-align:center; margin-top:14px; border-top:1px dashed #000; padding-top:8px;">
      <p style="margin:0; font-weight:700; font-size:12px;">${(currentRestaurant.receiptFooter || 'TASHRIFINGIZ UCHUN RAHMAT!').toUpperCase()}</p>
    </div>
  `;

  document.getElementById('receiptModal').style.display = 'flex';
}

function closeReceiptModal() {
  document.getElementById('receiptModal').style.display = 'none';
}

function printReceipt() {
  const content = document.getElementById('printableReceipt').innerHTML;
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  printWindow.document.write(`
    <html>
      <head>
        <title>Kassa Cheki</title>
        <style>
          body { font-family: monospace; font-size: 12px; margin: 20px; line-height: 1.4; color: #000; }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// Z-Hisobot (Smena Yopish)
async function openZReportModal() {
  if (!currentRestaurant) return;
  try {
    const res = await fetch(`/api/admin/cashier/z-report/${currentRestaurant.id}`);
    const data = await res.json();
    if (data.success) {
      const z = data.report;
      const printable = document.getElementById('printableZReport');
      printable.innerHTML = `
        <div style="text-align:center; margin-bottom:12px;">
          <h3 style="margin:0; font-size:15px; font-weight:900;">${currentRestaurant.name}</h3>
          <p style="margin:2px 0 0; font-size:11px;">KUNLIK SMENA YOPISH (Z-HISOBOT)</p>
          <p style="margin:0; font-size:10px;">ID: <b>${z.reportId}</b></p>
        </div>
        <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; margin-bottom:8px; font-size:11px;">
          <div>SANA: <b>${z.date}</b></div>
          <div>VAQT: <b>${new Date(z.generatedAt).toLocaleTimeString()}</b></div>
          <div>JAMI CHEKLAR SONI: <b>${z.totalReceipts} ta</b></div>
        </div>
        <div style="margin-bottom:8px; font-size:11px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span>💵 Naqd tushum:</span>
            <b>${formatMoney(z.cashTotal)} so'm</b>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span>💳 Plastik karta:</span>
            <b>${formatMoney(z.cardTotal)} so'm</b>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span>📱 Click/Payme:</span>
            <b>${formatMoney(z.clickTotal)} so'm</b>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px; color:#ef4444;">
            <span>Chegirmalar summasi:</span>
            <b>-${formatMoney(z.discountsTotal)} so'm</b>
          </div>
        </div>
        <div style="border-top:1px dashed #000; padding-top:6px; font-size:13px; font-weight:900; display:flex; justify-content:space-between;">
          <span>SOF KASSA SUMMASI:</span>
          <span>${formatMoney(z.netTotal)} SO'M</span>
        </div>
        <div style="text-align:center; margin-top:14px; border-top:1px dashed #000; padding-top:8px; font-size:10px;">
          <p style="margin:0;">SMENA MUVAFFAQIYATLI YOPILDI</p>
        </div>
      `;
      document.getElementById('zReportModal').style.display = 'flex';
    }
  } catch (e) {
    alert("Z-Hisobot olishda xatolik: " + e.message);
  }
}

function closeZReportModal() {
  document.getElementById('zReportModal').style.display = 'none';
}

function printZReport() {
  const content = document.getElementById('printableZReport').innerHTML;
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  printWindow.document.write(`
    <html>
      <head>
        <title>Z-Hisobot</title>
        <style>
          body { font-family: monospace; font-size: 12px; margin: 20px; line-height: 1.4; color: #000; }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ==================== 8. OFITSIANT (CHAQIRUVLAR & YETKAZISH) ====================
let previousCallsCount = 0;
let waiterOrderCart = {}; // { dishId: qty }

function playWaiterChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {}
}

function saveWaiterName(val) {
  localStorage.setItem('waiter_name', val.trim() || 'Jasur');
}

async function loadWaiterData() {
  if (!currentRestaurant) return;
  try {
    const waiterNameInput = document.getElementById('waiterCurrentName');
    if (waiterNameInput && !waiterNameInput.value) {
      waiterNameInput.value = localStorage.getItem('waiter_name') || 'Jasur';
    }

    const res = await fetch(`/api/admin/orders/${currentRestaurant.id}`);
    const data = await res.json();
    if (data.success) {
      const orders = data.orders;

      // 1. Chaqiruvlar (Ofitsiant & Hisob)
      const calls = orders.filter(o => (o.type === 'call_waiter' || o.type === 'bill_request') && o.status === 'new');
      const callsGrid = document.getElementById('waiterCallsGrid');

      // Ovozli bildirishnoma
      if (calls.length > previousCallsCount) {
        playWaiterChime();
      }
      previousCallsCount = calls.length;

      const waiterBadge = document.getElementById('waiterBadge');
      if (waiterBadge) {
        if (calls.length > 0) {
          waiterBadge.style.display = 'inline-block';
          waiterBadge.innerText = calls.length;
        } else {
          waiterBadge.style.display = 'none';
        }
      }

      if (calls.length === 0) {
        callsGrid.innerHTML = `
          <div style="grid-column: 1 / -1; background: var(--white); padding: 24px; border-radius: var(--radius-md); text-align: center; color: var(--gray-400); border: 1px solid var(--gray-200);">
            <i class="fa-solid fa-bell-slash" style="font-size: 30px; margin-bottom: 8px;"></i>
            <p style="font-weight: 700; color: var(--dark);">Hozirda faol chaqiruvlar yo'q</p>
          </div>
        `;
      } else {
        let html = '';
        calls.forEach(c => {
          const isBill = c.type === 'bill_request';
          html += `
            <div class="order-card new-alert" style="border: 2px solid ${isBill ? '#f59e0b' : '#86198f'};">
              <div class="order-header">
                <div class="order-table-num" style="background:#ffedd5; padding:4px 10px; border-radius:8px; color:#ea580c;">
                  <i class="fa-solid fa-chair"></i>
                  <span style="font-weight:900; font-size:16px;">STOL ${c.tableNumber}</span>
                </div>
                <span class="order-status-badge badge-waiter">${isBill ? "Hisob so'rovi" : "Ofitsiant chaqiruvi"}</span>
              </div>
              <div style="font-size: 14px; font-weight: 700; color: ${isBill ? '#b45309' : '#86198f'}; margin: 12px 0; text-align: center;">
                <i class="fa-solid ${isBill ? 'fa-receipt' : 'fa-bell'}" style="font-size: 24px; display: block; margin-bottom: 4px;"></i>
                ${c.note}
              </div>
              <button class="btn-submit" style="background: #86198f; padding: 12px;" onclick="acknowledgeWaiterCall('${c.id}')">
                <i class="fa-solid fa-person-walking"></i> Bordim / Qabul qilindi
              </button>
            </div>
          `;
        });
        callsGrid.innerHTML = html;
      }

      // 2. Oshxonada tayyor taomlar (ready)
      const readyOrders = orders.filter(o => o.status === 'ready');
      const readyGrid = document.getElementById('waiterReadyGrid');

      if (readyOrders.length === 0) {
        readyGrid.innerHTML = `
          <div style="grid-column: 1 / -1; background: var(--white); padding: 24px; border-radius: var(--radius-md); text-align: center; color: var(--gray-400); border: 1px solid var(--gray-200);">
            <i class="fa-solid fa-utensils" style="font-size: 30px; margin-bottom: 8px;"></i>
            <p style="font-weight: 700; color: var(--dark);">Hozircha yetkazilishi kerak bo'lgan taomlar yo'q</p>
          </div>
        `;
      } else {
        let html = '';
        readyOrders.forEach(o => {
          html += `
            <div class="order-card" style="border: 2px solid #3b82f6;">
              <div class="order-header">
                <div class="order-table-num" style="background:#dbeafe; padding:4px 10px; border-radius:8px; color:#1d4ed8;">
                  <i class="fa-solid fa-chair"></i>
                  <span style="font-weight:900; font-size:16px;">STOL ${o.tableNumber}</span>
                </div>
                <span class="order-status-badge badge-ready">Oshxonada tayyor</span>
              </div>
              <div style="font-size: 13px; margin: 10px 0;">
                ${o.items.map(it => `<div><b>${it.quantity}x</b> ${it.name}</div>`).join('')}
              </div>
              <button class="btn-submit" style="background: #10b981; padding: 12px;" onclick="deliverWaiterOrder('${o.id}')">
                <i class="fa-solid fa-check"></i> Stolga yetkazildi
              </button>
            </div>
          `;
        });
        readyGrid.innerHTML = html;
      }
    }
  } catch (e) {
    console.error("Ofitsiant ma'lumotlarini yuklashda xatolik:", e);
  }
}

async function acknowledgeWaiterCall(orderId) {
  const waiterName = document.getElementById('waiterCurrentName')?.value.trim() || 'Ofitsiant';
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/acknowledge-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waiterName })
    });
    const data = await res.json();
    if (data.success) {
      loadWaiterData();
      loadOrders();
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

async function deliverWaiterOrder(orderId) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'delivered' })
    });
    const data = await res.json();
    if (data.success) {
      loadWaiterData();
      loadOrders();
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

// Ofitsiant: Qo'lda Yangi Buyurtma Olish
function openWaiterOrderModal() {
  waiterOrderCart = {};
  const tableSelect = document.getElementById('waiterOrderTableSelect');
  const count = currentRestaurant.tablesCount || 15;
  let html = '';
  for (let i = 1; i <= count; i++) {
    html += `<option value="${i}">Stol ${i}</option>`;
  }
  tableSelect.innerHTML = html;

  if (currentMenu.length === 0) {
    loadMenu().then(() => renderWaiterDishesList());
  } else {
    renderWaiterDishesList();
  }

  document.getElementById('waiterOrderModal').style.display = 'flex';
}

function closeWaiterOrderModal() {
  document.getElementById('waiterOrderModal').style.display = 'none';
  waiterOrderCart = {};
}

function renderWaiterDishesList() {
  const search = (document.getElementById('waiterDishSearch')?.value || '').toLowerCase();
  const container = document.getElementById('waiterDishesList');
  let items = currentMenu.filter(d => d.isAvailable !== false);

  if (search) {
    items = items.filter(d => d.nameUz.toLowerCase().includes(search));
  }

  let html = '';
  let total = 0;

  items.forEach(d => {
    const qty = waiterOrderCart[d.id] || 0;
    if (qty > 0) total += (d.price * qty);

    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--gray-100); border-radius:8px;">
        <div style="flex:1;">
          <b style="font-size:13px;">${d.nameUz}</b>
          <div style="font-size:12px; color:var(--primary); font-weight:700;">${formatMoney(d.price)} so'm</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button type="button" class="btn-icon" style="width:28px; height:28px;" onclick="changeWaiterQty('${d.id}', -1)">-</button>
          <span style="font-weight:800; min-width:20px; text-align:center;">${qty}</span>
          <button type="button" class="btn-icon" style="width:28px; height:28px;" onclick="changeWaiterQty('${d.id}', 1)">+</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html || '<div style="text-align:center; padding:10px; color:var(--gray-400);">Taomlar topilmadi</div>';
  document.getElementById('waiterOrderTotalText').innerText = `${formatMoney(total)} so'm`;
}

function changeWaiterQty(dishId, delta) {
  const current = waiterOrderCart[dishId] || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) {
    delete waiterOrderCart[dishId];
  } else {
    waiterOrderCart[dishId] = next;
  }
  renderWaiterDishesList();
}

async function submitWaiterOrder() {
  const tableNumber = Number(document.getElementById('waiterOrderTableSelect').value);
  const items = [];
  let subtotal = 0;

  Object.keys(waiterOrderCart).forEach(dishId => {
    const dish = currentMenu.find(d => d.id === dishId);
    const qty = waiterOrderCart[dishId];
    if (dish && qty > 0) {
      items.push({
        id: dish.id,
        name: dish.nameUz,
        price: dish.price,
        quantity: qty
      });
      subtotal += (dish.price * qty);
    }
  });

  if (items.length === 0) {
    alert("Iltimos, kamida bitta taom tanlang!");
    return;
  }

  const feePercent = currentRestaurant.serviceFeePercent || 0;
  const serviceFee = Math.round((subtotal * feePercent) / 100);
  const totalPrice = subtotal + serviceFee;
  const waiterName = document.getElementById('waiterCurrentName')?.value.trim() || 'Ofitsiant';

  try {
    const res = await fetch(`/api/r/${currentRestaurant.slug}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber,
        items,
        subtotal,
        serviceFee,
        totalPrice,
        note: `Ofitsiant tomonidan qo'shildi (${waiterName})`
      })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Stol ${tableNumber} uchun buyurtma (#${data.order.id}) oshxonaga yuborildi!`);
      closeWaiterOrderModal();
      loadOrders();
      if (currentRole === 'waiter') loadWaiterData();
    }
  } catch (e) {
    alert("Buyurtma yuborishda xatolik: " + e.message);
  }
}

// Ishga tushirish
init();
