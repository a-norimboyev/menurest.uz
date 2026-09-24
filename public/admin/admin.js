let currentRestaurant = null;
let currentOrders = [];
let currentMenu = [];
let currentCategories = [];
let ordersPollInterval = null;
let adminSocket = null;

// Global fetch interceptor: Barcha /api/admin/ so'rovlariga avtomatik JWT Bearer tokenni biriktiradi
const _nativeFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const token = localStorage.getItem('admin_token');
  if (token && typeof url === 'string' && url.startsWith('/api/admin/')) {
    options = options || {};
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      if (!options.headers.has('Authorization')) {
        options.headers.set('Authorization', 'Bearer ' + token);
      }
    } else if (Array.isArray(options.headers)) {
      options.headers.push(['Authorization', 'Bearer ' + token]);
    } else {
      if (!options.headers['Authorization']) {
        options.headers['Authorization'] = 'Bearer ' + token;
      }
    }
  }
  const response = await _nativeFetch(url, options);
  if (response.status === 401 && typeof url === 'string' && url.startsWith('/api/admin/')) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_restaurant');
    if (typeof showLoginScreen === 'function') {
      showLoginScreen();
    }
  }
  return response;
};

// Formatlash
function formatMoney(amount) {
  return (amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Qora / Oq rejim (Dark / Light mode)
function initAdminTheme() {
  const savedTheme = localStorage.getItem('admin_theme') || 'light';
  applyAdminTheme(savedTheme);
}

function applyAdminTheme(theme) {
  const isDark = (theme === 'dark');
  document.body.classList.toggle('dark-theme', isDark);
  localStorage.setItem('admin_theme', theme);

  const icon = document.getElementById('themeToggleIcon');
  const btn = document.getElementById('themeToggleBtn');
  if (icon) {
    if (isDark) {
      icon.className = 'fa-solid fa-sun';
      icon.style.color = '#fbbf24';
    } else {
      icon.className = 'fa-solid fa-moon';
      icon.style.color = '#334155';
    }
  }
  if (btn) {
    btn.title = isDark
      ? (typeof at === 'function' ? at('theme_light') : 'Yorug\' rejim (Kunduzgi)')
      : (typeof at === 'function' ? at('theme_dark') : 'Qora rejim (Tungi)');
  }
}

function toggleAdminTheme() {
  const current = localStorage.getItem('admin_theme') || 'light';
  const nextTheme = (current === 'dark') ? 'light' : 'dark';
  applyAdminTheme(nextTheme);
}

window.initAdminTheme = initAdminTheme;
window.applyAdminTheme = applyAdminTheme;
window.toggleAdminTheme = toggleAdminTheme;

// Boshlang'ich yuklash
async function init() {
  initAdminTheme();
  const params = new URLSearchParams(window.location.search);
  const roleParam = params.get('role');
  const slugParam = params.get('slug');

  if (roleParam && ['manager', 'boss', 'cashier', 'waiter'].includes(roleParam)) {
    currentRole = roleParam;
    localStorage.setItem('admin_role', currentRole);
  }

  const saved = localStorage.getItem('admin_restaurant');
  const token = localStorage.getItem('admin_token');
  if (saved && token) {
    try {
      currentRestaurant = JSON.parse(saved);
      showAdminLayout();
      if (roleParam) {
        switchRole(roleParam);
      }
      return;
    } catch (e) {}
  }
  showLoginScreen();
  if (roleParam) {
    const roleSelect = document.getElementById('loginRole');
    if (roleSelect) roleSelect.value = roleParam;
  }
  if (slugParam) {
    const slugInput = document.getElementById('loginSlug');
    if (slugInput) slugInput.value = slugParam;
  }
}

// Kirish oynasini ko'rsatish
async function showLoginScreen() {
  document.getElementById('authWrapper').style.display = 'flex';
  document.getElementById('adminLayout').style.display = 'none';

  const params = new URLSearchParams(window.location.search);
  const roleParam = params.get('role');
  const slugParam = params.get('slug');
  if (roleParam) {
    const roleSelect = document.getElementById('loginRole');
    if (roleSelect) roleSelect.value = roleParam;
  }
  if (slugParam) {
    const slugInput = document.getElementById('loginSlug');
    if (slugInput) slugInput.value = slugParam;
  }

  // Restoranlar ro'yxatini select ga yuklash (Ommaviy xavfsiz API dan)
  try {
    const res = await fetch('/api/public/restaurants');
    const data = await res.json();
    if (data.success) {
      const select = document.getElementById('loginSlugSelect');
      select.innerHTML = '<option value="">-- Ro\'yxatdan tanlang --</option>';
      data.restaurants.forEach(r => {
        select.innerHTML += `<option value="${r.slug}">${r.name} (${r.slug})</option>`;
      });
      if (slugParam) {
        select.value = slugParam;
      }
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
      body: JSON.stringify({ slug, password, role })
    });
    const data = await res.json();

    if (data.success && data.token) {
      currentRestaurant = data.restaurant;
      currentRole = data.role || role;
      localStorage.setItem('admin_token', data.token);
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
  const btnBossDishes = document.getElementById('tabBtn-boss-dishes');
  const btnCashier = document.getElementById('tabBtn-cashier');
  const btnWaiter = document.getElementById('tabBtn-waiter');
  const btnOrders = document.getElementById('tabBtn-orders');
  const btnMenu = document.getElementById('tabBtn-menu');
  const btnCategories = document.getElementById('tabBtn-categories');
  const btnQr = document.getElementById('tabBtn-qr');
  const kitchenLink = document.getElementById('sidebarKitchenLink');
  const sidebarLiveMenuLink = document.getElementById('sidebarLiveMenuLink');
  const btnStaff = document.getElementById('tabBtn-staff');
  const btnSettings = document.getElementById('tabBtn-settings');
  const sectionRoles = document.getElementById('sidebarSectionRoles');
  const sectionManager = document.getElementById('sidebarSectionManager');
  const viewLiveMenuLink = document.getElementById('viewLiveMenuLink');
  const btnAddNewDish = document.getElementById('btnAddNewDish');
  const thDishActions = document.getElementById('thDishActions');

  if (role === 'boss') {
    // Boshliq uchun faqat strategik va tahliliy bo'limlar:
    if (btnBoss) btnBoss.style.display = 'flex';
    if (btnBossDishes) btnBossDishes.style.display = 'flex';
    if (btnMenu) btnMenu.style.display = 'none'; // Taomlar boshqaruv menyusi faqat Menejer rolida bo'ladi
    if (btnCategories) btnCategories.style.display = 'none'; // Kategoriyalar faqat Menejer rolida bo'ladi
    if (btnQr) btnQr.style.display = 'none'; // Stollar & QR Kodlar faqat Menejer rolida bo'ladi
    if (btnStaff) btnStaff.style.display = 'none'; // Xodimlar faqat Menejer rolida bo'ladi
    if (btnSettings) btnSettings.style.display = 'flex';

    // Ortiqcha operatsion bo'limlarni yashirish:
    if (btnCashier) btnCashier.style.display = 'none';
    if (btnWaiter) btnWaiter.style.display = 'none';
    if (btnOrders) btnOrders.style.display = 'none';
    if (kitchenLink) kitchenLink.style.display = 'none';
    if (sidebarLiveMenuLink) sidebarLiveMenuLink.style.display = 'none';
    if (sectionRoles) sectionRoles.style.display = 'none';
    if (sectionManager) sectionManager.style.display = 'none';
    if (viewLiveMenuLink) viewLiveMenuLink.style.display = 'none';
  } else if (role === 'cashier') {
    if (btnBoss) btnBoss.style.display = 'none';
    if (btnBossDishes) btnBossDishes.style.display = 'none';
    if (btnCashier) btnCashier.style.display = 'flex';
    if (btnWaiter) btnWaiter.style.display = 'none';
    if (btnOrders) btnOrders.style.display = 'none';
    if (btnMenu) btnMenu.style.display = 'none';
    if (btnCategories) btnCategories.style.display = 'none';
    if (btnQr) btnQr.style.display = 'none';
    if (kitchenLink) kitchenLink.style.display = 'none';
    if (sidebarLiveMenuLink) sidebarLiveMenuLink.style.display = 'none';
    if (btnStaff) btnStaff.style.display = 'none';
    if (btnSettings) btnSettings.style.display = 'none';
    if (sectionRoles) sectionRoles.style.display = 'none';
    if (sectionManager) sectionManager.style.display = 'none';
    if (viewLiveMenuLink) viewLiveMenuLink.style.display = 'none';
  } else if (role === 'waiter') {
    if (btnBoss) btnBoss.style.display = 'none';
    if (btnBossDishes) btnBossDishes.style.display = 'none';
    if (btnCashier) btnCashier.style.display = 'none';
    if (btnWaiter) btnWaiter.style.display = 'flex';
    if (btnOrders) btnOrders.style.display = 'flex';
    if (btnMenu) btnMenu.style.display = 'flex'; // Ofitsiant menyuni ichki ko'ra oladi
    if (btnCategories) btnCategories.style.display = 'none';
    if (btnQr) btnQr.style.display = 'none';
    if (kitchenLink) kitchenLink.style.display = 'none';
    if (sidebarLiveMenuLink) sidebarLiveMenuLink.style.display = 'none'; // Tashqi sayt linki yashiriladi
    if (btnStaff) btnStaff.style.display = 'none';
    if (btnSettings) btnSettings.style.display = 'none';
    if (sectionRoles) sectionRoles.style.display = 'none';
    if (sectionManager) sectionManager.style.display = 'none';
    if (viewLiveMenuLink) viewLiveMenuLink.style.display = 'none';
  } else {
    // manager (Sof boshqaruv bo'limlari - ortiqcha xodim darchalari yashiriladi)
    if (btnBoss) btnBoss.style.display = 'none';
    if (btnBossDishes) btnBossDishes.style.display = 'none';
    if (btnCashier) btnCashier.style.display = 'none';
    if (btnWaiter) btnWaiter.style.display = 'none';
    if (sectionRoles) sectionRoles.style.display = 'none';
    if (sectionManager) sectionManager.style.display = 'none';

    // Boshqaruv bo'limlari:
    if (btnOrders) btnOrders.style.display = 'flex';
    if (btnMenu) btnMenu.style.display = 'flex';
    if (btnCategories) btnCategories.style.display = 'flex';
    if (btnQr) btnQr.style.display = 'flex';
    if (kitchenLink) kitchenLink.style.display = 'flex';
    if (btnStaff) btnStaff.style.display = 'flex';
    if (sidebarLiveMenuLink) sidebarLiveMenuLink.style.display = 'flex';
    if (btnSettings) btnSettings.style.display = 'none'; // Sozlamalar faqat Boshliqqa beriladi
    if (viewLiveMenuLink) viewLiveMenuLink.style.display = 'inline-flex';
  }

  if (btnAddNewDish) btnAddNewDish.style.display = (role === 'waiter' ? 'none' : 'inline-flex');
  if (thDishActions) thDishActions.style.display = (role === 'waiter' ? 'none' : '');
}

// Sidebar foydalanuvchi ma'lumotlarini (Avatar, Ism, Rol) yangilash
function updateSidebarUserInfo() {
  if (!currentRestaurant) return;

  const avatarBox = document.getElementById('sideAvatarBox');
  const avatarIcon = document.getElementById('sideAvatarIcon');
  const avatarImg = document.getElementById('sideAvatarImg');
  const brandEl = document.getElementById('sideBrand');
  const roleBadge = document.getElementById('sideRoleBadge');

  if (avatarBox) {
    avatarBox.className = 'sidebar-avatar-box role-' + currentRole;
  }

  if (currentRole === 'boss') {
    if (brandEl) {
      brandEl.innerText = currentRestaurant.ownerName || currentRestaurant.name || 'Boshliq';
    }
    if (roleBadge) {
      roleBadge.innerText = currentRestaurant.ownerName ? currentRestaurant.name : at('role_boss');
    }
    if (currentRestaurant.ownerAvatar) {
      if (avatarImg) {
        avatarImg.src = currentRestaurant.ownerAvatar;
        avatarImg.style.display = 'block';
      }
      if (avatarIcon) avatarIcon.style.display = 'none';
    } else {
      if (avatarImg) avatarImg.style.display = 'none';
      if (avatarIcon) {
        avatarIcon.style.display = 'block';
        avatarIcon.className = 'fa-solid fa-crown';
      }
    }
  } else {
    if (brandEl) brandEl.innerText = currentRestaurant.name || 'Restoran';
    if (roleBadge) roleBadge.innerText = at('role_' + currentRole);
    if (avatarImg) avatarImg.style.display = 'none';
    if (avatarIcon) {
      avatarIcon.style.display = 'block';
      if (currentRole === 'cashier') avatarIcon.className = 'fa-solid fa-cash-register';
      else if (currentRole === 'waiter') avatarIcon.className = 'fa-solid fa-bell-concierge';
      else avatarIcon.className = 'fa-solid fa-user-tie';
    }
  }
}

// Rolni almashtirish
function switchRole(role) {
  currentRole = role;
  localStorage.setItem('admin_role', currentRole);

  const switcher = document.getElementById('topRoleSwitcher');
  if (switcher) switcher.value = role;

  updateSidebarUserInfo();
  updateSidebarByRole(role);

  if (role === 'boss') switchTab('boss');
  else if (role === 'cashier') switchTab('cashier');
  else if (role === 'waiter') switchTab('waiter');
  else switchTab('orders');
}

// Chiqish
function logout() {
  localStorage.removeItem('admin_restaurant');
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_role');
  currentRestaurant = null;
  if (ordersPollInterval) clearInterval(ordersPollInterval);
  if (adminSocket) {
    adminSocket.disconnect();
    adminSocket = null;
  }
  showLoginScreen();
}

// Real-Time Socket.io ulanishi (Instant Push bildirishnomalar)
function initAdminSocket() {
  if (!currentRestaurant) return;
  if (adminSocket) {
    adminSocket.disconnect();
    adminSocket = null;
  }
  if (typeof io !== 'undefined') {
    adminSocket = io();
    adminSocket.emit('join:restaurant', currentRestaurant.id);

    adminSocket.on('order:new', (order) => {
      loadOrders();
      if (typeof playNotificationSound === 'function') playNotificationSound('order');
    });

    adminSocket.on('waiter:call', (callOrder) => {
      loadOrders();
      if (typeof playNotificationSound === 'function') playNotificationSound('call');
    });

    adminSocket.on('order:status_updated', () => {
      loadOrders();
    });

    adminSocket.on('order:paid', () => {
      loadOrders();
      if (currentRole === 'cashier' && typeof loadCashierData === 'function') loadCashierData();
    });

    adminSocket.on('orders:paid', () => {
      loadOrders();
      if (currentRole === 'cashier' && typeof loadCashierData === 'function') loadCashierData();
    });
  }
}

// Admin panelini ko'rsatish
function showAdminLayout() {
  document.getElementById('authWrapper').style.display = 'none';
  document.getElementById('adminLayout').style.display = 'flex';

  updateSidebarUserInfo();

  // Jonli menyuga havola
  const liveLink = document.getElementById('viewLiveMenuLink');
  if (liveLink) liveLink.href = `/r/${currentRestaurant.slug}?table=1`;
  const sidebarLiveLink = document.getElementById('sidebarLiveMenuLink');
  if (sidebarLiveLink) sidebarLiveLink.href = `/r/${currentRestaurant.slug}?table=1`;

  // Rolni sozlash
  switchRole(currentRole);
  applyAdminLanguage();

  // Real-Time WebSocket ulanishini ishga tushirish
  initAdminSocket();

  // Zaxira yangilanish (Tarmoq uzilishiga qarshi 20 soniyalik fallback)
  if (ordersPollInterval) clearInterval(ordersPollInterval);
  ordersPollInterval = setInterval(() => {
    loadOrders();
    if (currentRole === 'waiter') loadWaiterData();
    if (currentRole === 'cashier') loadCashierData();
  }, 20000);
}

// Tablarni almashtirish
function switchTab(tabName) {
  // Sozlamalar faqat Restoran Boshlig'i (boss) uchun ruxsat etilgan
  if (tabName === 'settings' && currentRole !== 'boss') {
    alert("Sozlamalar bo'limi faqat Restoran Boshlig'i (Boshliq) uchun ruxsat etilgan!");
    switchTab('orders');
    return;
  }

  // Boshliq rolida faqat Boshliq bo'limlari (boss, boss-dishes, settings) ruxsat etilgan
  // Stollar & QR Kodlar, Menyular, Kategoriyalar, Xodimlar va barcha operatsion bo'limlar Boshliqdan olib tashlangan
  if (currentRole === 'boss' && !['boss', 'boss-dishes', 'settings'].includes(tabName)) {
    switchTab('boss');
    return;
  }

  const tabs = ['orders', 'menu', 'categories', 'qr', 'staff', 'settings', 'boss', 'boss-dishes', 'cashier', 'waiter'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = (t === tabName ? 'block' : 'none');
    const btn = document.getElementById(`tabBtn-${t}`);
    if (btn) btn.classList.toggle('active', t === tabName);
  });

  const titleKey = 'title_' + tabName.replace(/-/g, '_');
  document.getElementById('pageTitle').innerText = at(titleKey) || at('title_' + tabName) || 'Admin';

  if (tabName === 'orders') loadOrders();
  if (tabName === 'menu') loadMenu();
  if (tabName === 'categories') loadCategories();
  if (tabName === 'qr') loadQRCodes();
  if (tabName === 'staff') loadStaff();
  if (tabName === 'settings') loadSettings();
  if (tabName === 'boss') loadBossData();
  if (tabName === 'boss-dishes') loadBossDishRanking();
  if (tabName === 'cashier') loadCashierData();
  if (tabName === 'waiter') loadWaiterData();
}

// Admin Paneli uchun tilni to'liq yangilash
function applyAdminLanguage() {
  // 1. Switcher tugmalari faol holati
  document.querySelectorAll('.admin-lang-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-lang') === currentAdminLang);
  });

  // 2. Rol almashtirgich
  const switcher = document.getElementById('topRoleSwitcher');
  if (switcher && switcher.options.length >= 4) {
    switcher.options[0].text = `👔 ${at('role_manager')}`;
    switcher.options[1].text = `👑 ${at('role_boss')}`;
    switcher.options[2].text = `💳 ${at('role_cashier')}`;
    switcher.options[3].text = `🛎️ ${at('role_waiter')}`;
  }
  const lblRole = document.getElementById('lblRoleTitle');
  if (lblRole) lblRole.innerHTML = `<i class="fa-solid fa-user-shield" style="color:var(--primary);"></i> ${at('role_label')}`;
  const badge = document.getElementById('sideRoleBadge');
  if (badge) badge.innerText = at('role_' + currentRole);

  // 3. Sidebar matnlari
  updateSidebarByRole(currentRole);

  const mapNav = {
    boss: at('nav_boss'),
    'boss-dishes': at('nav_boss_dishes'),
    cashier: at('nav_cashier'),
    waiter: at('nav_waiter'),
    orders: at('nav_orders'),
    menu: at('nav_menu'),
    categories: at('nav_categories'),
    qr: at('nav_qr'),
    staff: at('nav_staff'),
    settings: at('nav_settings'),
  };
  for (const [id, txt] of Object.entries(mapNav)) {
    const el = document.querySelector(`#tabBtn-${id} span`);
    if (el) el.innerText = txt;
  }
  const kitchenSpan = document.querySelector('#sidebarKitchenLink span');
  if (kitchenSpan) kitchenSpan.innerText = at('nav_kitchen');
  const logoutSpan = document.querySelector('.btn-logout span');
  if (logoutSpan) logoutSpan.innerText = at('nav_logout');
  const viewMenuSpan = document.querySelector('#viewLiveMenuLink span');
  if (viewMenuSpan) viewMenuSpan.innerText = at('view_live_menu');
  const sidebarMenuSpan = document.getElementById('lblSidebarLiveMenu');
  if (sidebarMenuSpan) sidebarMenuSpan.innerText = at('view_live_menu');

  // Qora / Oq rejim tugmasi matni
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    const isDark = document.body.classList.contains('dark-theme');
    themeBtn.title = isDark ? at('theme_light') : at('theme_dark');
  }

  // 4. Joriy sahifa sarlavhasi
  const currentActiveTab = document.querySelector('.nav-link.active');
  if (currentActiveTab) {
    const tabId = currentActiveTab.id.replace('tabBtn-', '');
    const titleKey = 'title_' + tabId;
    const pt = document.getElementById('pageTitle');
    if (pt && at(titleKey)) pt.innerText = at(titleKey);
  }

  // 5. Boshliq (Boss) paneli matnlari
  const bossH3 = document.querySelector('#tab-boss h3');
  if (bossH3) bossH3.innerHTML = `<i class="fa-solid fa-chart-line" style="color: var(--primary);"></i> ${at('boss_header_title')}`;
  const bossP = document.querySelector('#tab-boss p');
  if (bossP) bossP.innerText = at('boss_header_desc');

  const bossBtnExcel = document.querySelector("button[onclick='exportSalesReportCSV()']");
  if (bossBtnExcel) bossBtnExcel.innerHTML = `<i class="fa-solid fa-file-excel"></i> ${at('boss_btn_excel')}`;
  const bossBtnPrint = document.querySelector("button[onclick='openBossReportModal()']");
  if (bossBtnPrint) bossBtnPrint.innerHTML = `<i class="fa-solid fa-print"></i> ${at('boss_btn_print')}`;

  document.querySelectorAll('.boss-period-btn[data-period]').forEach(btn => {
    const p = btn.getAttribute('data-period');
    if (p === 'today') btn.innerText = at('boss_p_today');
    else if (p === 'yesterday') btn.innerText = at('boss_p_yesterday');
    else if (p === 'week') btn.innerText = at('boss_p_week');
    else if (p === 'month') btn.innerText = at('boss_p_month');
    else if (p === 'all') btn.innerText = at('boss_p_all');
  });

  const bossPeriodLbl = document.getElementById('bossPeriodLabel');
  if (bossPeriodLbl) {
    bossPeriodLbl.innerText = currentBossPeriod === 'today' ? at('kpi_today_revenue') : at('kpi_period_revenue');
  }
  const lblAvgCheck = document.getElementById('lblKpiAvgCheck');
  if (lblAvgCheck) lblAvgCheck.innerText = at('kpi_avg_check');
  const bossAvgDesc = document.getElementById('lblKpiAvgCheckDesc');
  if (bossAvgDesc) bossAvgDesc.innerText = at('kpi_avg_check_desc');

  const lblCashDrawer = document.getElementById('lblKpiCashDrawer');
  if (lblCashDrawer) lblCashDrawer.innerText = at('kpi_cash_drawer');
  const bossCashDesc = document.getElementById('lblKpiCashDesc');
  if (bossCashDesc) bossCashDesc.innerText = at('kpi_cash_desc');

  const lblTotalOrders = document.getElementById('lblKpiTotalOrders');
  if (lblTotalOrders) lblTotalOrders.innerText = at('kpi_total_orders');

  const lblServiceFee = document.getElementById('lblKpiServiceFee');
  if (lblServiceFee) lblServiceFee.innerText = at('kpi_service_fee');
  const lblServiceFund = document.getElementById('lblKpiServiceFund');
  if (lblServiceFund) lblServiceFund.innerText = at('kpi_service_desc');

  const lblCancelled = document.getElementById('lblKpiCancelled');
  if (lblCancelled) lblCancelled.innerText = at('kpi_cancelled_loss');

  // Chart titles
  const chartSales = document.getElementById('lblChartSales');
  if (chartSales) chartSales.innerHTML = `<i class="fa-solid fa-chart-line" style="color: #10b981;"></i> ${at('chart_sales_title')}`;
  const chartSalesSub = document.getElementById('lblChartSalesSub');
  if (chartSalesSub) chartSalesSub.innerText = at('chart_sales_sub');

  const chartPeak = document.getElementById('lblChartPeak');
  if (chartPeak) chartPeak.innerHTML = `<i class="fa-solid fa-clock" style="color: #f59e0b;"></i> ${at('chart_peak_title')}`;
  const chartPeakSub = document.getElementById('lblChartPeakSub');
  if (chartPeakSub) chartPeakSub.innerText = at('chart_peak_sub');

  const chartWaiters = document.getElementById('lblChartWaiters');
  if (chartWaiters) chartWaiters.innerHTML = `<i class="fa-solid fa-award" style="color: #8b5cf6;"></i> ${at('chart_waiters_title')}`;
  const chartWaitersSub = document.getElementById('lblChartWaitersSub');
  if (chartWaitersSub) chartWaitersSub.innerText = at('chart_waiters_sub');

  const chartPayments = document.getElementById('lblChartPayments');
  if (chartPayments) chartPayments.innerHTML = `<i class="fa-solid fa-chart-pie" style="color: #3b82f6;"></i> ${at('chart_payments_title')}`;
  const chartPaymentsSub = document.getElementById('lblChartPaymentsSub');
  if (chartPaymentsSub) chartPaymentsSub.innerText = at('chart_payments_sub');

  const dishesAnalysis = document.getElementById('lblDishesAnalysis');
  if (dishesAnalysis) dishesAnalysis.innerHTML = `<i class="fa-solid fa-utensils" style="color: #f59e0b;"></i> ${at('dishes_analysis_title')}`;

  const reviewsTitle = document.getElementById('lblReviewsTitle');
  if (reviewsTitle) reviewsTitle.innerHTML = `<i class="fa-solid fa-star" style="color: #f59e0b;"></i> ${at('reviews_title')}`;

  const btnTop = document.getElementById('btnDishesTop');
  if (btnTop) btnTop.innerText = at('btn_top_dishes');
  const btnLeast = document.getElementById('btnDishesLeast');
  if (btnLeast) btnLeast.innerText = at('btn_least_dishes');

  const thRank = document.getElementById('thRank');
  if (thRank) thRank.innerText = at('th_rank');
  const thWaiter = document.getElementById('thWaiter');
  if (thWaiter) thWaiter.innerText = at('th_waiter');
  const thOrders = document.getElementById('thOrders');
  if (thOrders) thOrders.innerText = at('th_orders_count');
  const thRevenue = document.getElementById('thRevenue');
  if (thRevenue) thRevenue.innerText = at('th_total_revenue');
  const thAvgCheck = document.getElementById('thAvgCheck');
  if (thAvgCheck) thAvgCheck.innerText = at('th_avg_check');

  // 5.5 Taomlar Sotuv Reytingi (Boss Dishes)
  const dishRankTitle = document.getElementById('lblDishRankingTitle');
  if (dishRankTitle) dishRankTitle.innerHTML = `<i class="fa-solid fa-ranking-star" style="color: var(--primary);"></i> ${at('dish_rank_title')}`;
  const dishRankDesc = document.getElementById('lblDishRankingDesc');
  if (dishRankDesc) dishRankDesc.innerText = at('dish_rank_desc');

  const btnExportRank = document.getElementById('lblBtnExportDishRanking');
  if (btnExportRank) btnExportRank.innerText = at('dish_rank_btn_excel');

  const lblDishRankPeriod = document.getElementById('lblDishRankPeriod');
  if (lblDishRankPeriod) lblDishRankPeriod.innerText = at('dish_rank_period');

  document.querySelectorAll('.dish-period-btn[data-period]').forEach(btn => {
    const p = btn.getAttribute('data-period');
    if (p === 'today') btn.innerText = at('boss_p_today');
    else if (p === 'yesterday') btn.innerText = at('boss_p_yesterday');
    else if (p === 'week') btn.innerText = at('boss_p_week');
    else if (p === 'month') btn.innerText = at('boss_p_month');
    else if (p === 'all') btn.innerText = at('boss_p_all');
  });

  const dishSearch = document.getElementById('dishRankingSearch');
  if (dishSearch) dishSearch.placeholder = at('dish_rank_search_ph');

  const dishSort = document.getElementById('dishRankingSort');
  if (dishSort && dishSort.options.length >= 4) {
    dishSort.options[0].text = at('dish_rank_sort_top');
    dishSort.options[1].text = at('dish_rank_sort_least');
    dishSort.options[2].text = at('dish_rank_sort_rev');
    dishSort.options[3].text = at('dish_rank_sort_name');
  }

  const thRankNum = document.getElementById('thRankNum');
  if (thRankNum) thRankNum.innerText = at('th_dish_rank_num');
  const thRankDish = document.getElementById('thRankDish');
  if (thRankDish) thRankDish.innerText = at('th_dish_rank_dish');
  const thRankCat = document.getElementById('thRankCat');
  if (thRankCat) thRankCat.innerText = at('th_dish_rank_cat');
  const thRankPrice = document.getElementById('thRankPrice');
  if (thRankPrice) thRankPrice.innerText = at('th_dish_rank_price');
  const thRankSold = document.getElementById('thRankSold');
  if (thRankSold) thRankSold.innerText = at('th_dish_rank_sold');
  const thRankRev = document.getElementById('thRankRev');
  if (thRankRev) thRankRev.innerText = at('th_dish_rank_rev');
  const thRankShare = document.getElementById('thRankShare');
  if (thRankShare) thRankShare.innerText = at('th_dish_rank_share');
  const thRankStatus = document.getElementById('thRankStatus');
  if (thRankStatus) thRankStatus.innerText = at('th_dish_rank_status');

  // 6. Kategoriya boshqaruvi matnlari
  const lblCatListTitle = document.getElementById('lblCatListTitle');
  if (lblCatListTitle) lblCatListTitle.innerText = at('cat_list_title');
  const lblCatListDesc = document.getElementById('lblCatListDesc');
  if (lblCatListDesc) lblCatListDesc.innerText = at('cat_list_desc');
  const lblBtnNewCat = document.getElementById('lblBtnNewCat');
  if (lblBtnNewCat) lblBtnNewCat.innerText = at('btn_new_cat');

  const lblCatStatTotal = document.getElementById('lblCatStatTotal');
  if (lblCatStatTotal) lblCatStatTotal.innerText = at('cat_stat_total');
  const lblCatStatActive = document.getElementById('lblCatStatActive');
  if (lblCatStatActive) lblCatStatActive.innerText = at('cat_stat_active');
  const lblCatStatDishes = document.getElementById('lblCatStatDishes');
  if (lblCatStatDishes) lblCatStatDishes.innerText = at('cat_stat_dishes');

  const catSearchInput = document.getElementById('catSearchInput');
  if (catSearchInput) catSearchInput.placeholder = at('cat_search_ph');

  const thCatOrder = document.getElementById('thCatOrder');
  if (thCatOrder) thCatOrder.innerText = at('th_cat_order');
  const thCatIcon = document.getElementById('thCatIcon');
  if (thCatIcon) thCatIcon.innerText = at('th_cat_icon');
  const thCatNameUz = document.getElementById('thCatNameUz');
  if (thCatNameUz) thCatNameUz.innerText = at('th_cat_name_uz');
  const thCatNameRu = document.getElementById('thCatNameRu');
  if (thCatNameRu) thCatNameRu.innerText = at('th_cat_name_ru');
  const thCatNameEn = document.getElementById('thCatNameEn');
  if (thCatNameEn) thCatNameEn.innerText = at('th_cat_name_en');
  const thCatDishes = document.getElementById('thCatDishes');
  if (thCatDishes) thCatDishes.innerText = at('th_cat_dishes');
  const thCatStatus = document.getElementById('thCatStatus');
  if (thCatStatus) thCatStatus.innerText = at('th_cat_status');
  const thCatActions = document.getElementById('thCatActions');
  if (thCatActions) thCatActions.innerText = at('th_cat_actions');

  const lblCatActive = document.getElementById('lblCatActive');
  if (lblCatActive) lblCatActive.innerText = at('cat_active_label');

  // 7. Kassa matnlari
  const cashierZBtn = document.querySelector("button[onclick='openZReportModal()']");
  if (cashierZBtn) cashierZBtn.innerHTML = `<i class="fa-solid fa-file-invoice-dollar"></i> ${at('btn_z_report')}`;

  // 8. Ofitsiant matnlari
  const lblWaiterTitle = document.getElementById('lblWaiterTitle');
  if (lblWaiterTitle) lblWaiterTitle.innerText = at('waiter_banner_title');
  const lblWaiterDesc = document.getElementById('lblWaiterDesc');
  if (lblWaiterDesc) lblWaiterDesc.innerText = at('waiter_banner_desc');
  const lblBtnWaiterNewOrder = document.getElementById('lblBtnWaiterNewOrder');
  if (lblBtnWaiterNewOrder) lblBtnWaiterNewOrder.innerText = at('btn_waiter_new_order');

  // 9. Stollar va QR Kodlar matnlari
  const lblQrSecTitle = document.getElementById('lblQrSectionTitle');
  if (lblQrSecTitle) lblQrSecTitle.innerHTML = `<i class="fa-solid fa-qrcode" style="color: var(--primary);"></i> ${at('qr_section_title')}`;
  const lblQrSecDesc = document.getElementById('lblQrSectionDesc');
  if (lblQrSecDesc) lblQrSecDesc.innerText = at('qr_section_desc');

  const lblBtnDlZip = document.getElementById('lblBtnDownloadZip');
  if (lblBtnDlZip) lblBtnDlZip.innerText = at('btn_download_zip');
  const lblBtnPrAll = document.getElementById('lblBtnPrintAll');
  if (lblBtnPrAll) lblBtnPrAll.innerText = at('btn_print_all');

  const lblQrTCount = document.getElementById('lblQrTablesCount');
  if (lblQrTCount) lblQrTCount.innerText = at('qr_tables_count_lbl');
  const lblBtnSaveT = document.getElementById('lblBtnSaveTables');
  if (lblBtnSaveT) lblBtnSaveT.innerText = at('btn_save_tables');

  const lblQrRangeP = document.getElementById('lblQrRangePrint');
  if (lblQrRangeP) lblQrRangeP.innerText = at('qr_range_print_lbl');
  const lblBtnPrRange = document.getElementById('lblBtnPrintRange');
  if (lblBtnPrRange) lblBtnPrRange.innerText = at('btn_print_range');

  const qrSearchInp = document.getElementById('qrSearchInput');
  if (qrSearchInp) qrSearchInp.placeholder = at('qr_search_ph');

  const qrZoneSel = document.getElementById('qrZoneFilter');
  if (qrZoneSel && qrZoneSel.options.length >= 4) {
    qrZoneSel.options[0].text = at('zone_all');
    qrZoneSel.options[1].text = at('zone_main');
    qrZoneSel.options[2].text = at('zone_terrace');
    qrZoneSel.options[3].text = at('zone_vip');
  }

  const qrThemeSel = document.getElementById('qrThemeSelect');
  if (qrThemeSel && qrThemeSel.options.length >= 3) {
    qrThemeSel.options[0].text = at('theme_classic');
    qrThemeSel.options[1].text = at('theme_dark');
    qrThemeSel.options[2].text = at('theme_tstand');
  }

  const lblShowWifi = document.getElementById('lblShowWifi');
  if (lblShowWifi) lblShowWifi.innerHTML = `<i class="fa-solid fa-wifi" style="color: #0284c7;"></i> ${at('lbl_show_wifi')}`;

  // 10. Boshliq & Xodimlar Xavfsizligi matnlari
  const lblSetTitle = document.getElementById('lblSettingsTitle');
  if (lblSetTitle) lblSetTitle.innerHTML = `<i class="fa-solid fa-user-shield" style="color: var(--primary);"></i> ${at('settings_sec_title')}`;
  const lblSetDesc = document.getElementById('lblSettingsDesc');
  if (lblSetDesc) lblSetDesc.innerText = at('settings_sec_desc');

  const lblBossProf = document.getElementById('lblBossProfileSection');
  if (lblBossProf) lblBossProf.innerHTML = `<i class="fa-solid fa-crown"></i> ${at('boss_profile_section')}`;

  const lblAvTitle = document.getElementById('lblBossAvatarTitle');
  if (lblAvTitle) lblAvTitle.innerText = at('lbl_boss_avatar_title');
  const lblBtnAv = document.getElementById('lblBtnUploadAvatar');
  if (lblBtnAv) lblBtnAv.innerText = at('btn_upload_avatar');
  const lblAvHint = document.getElementById('lblAvatarHint');
  if (lblAvHint) lblAvHint.innerText = at('avatar_hint');

  const lblOwnName = document.getElementById('lblOwnerName');
  if (lblOwnName) lblOwnName.innerText = at('owner_name_lbl');

  const lblOldPass = document.getElementById('lblOldPass');
  if (lblOldPass) lblOldPass.innerText = at('old_pass_lbl');
  const settingOldPass = document.getElementById('settingOldPass');
  if (settingOldPass) settingOldPass.placeholder = at('old_pass_ph');

  const lblAdmPass = document.getElementById('lblAdminPass');
  if (lblAdmPass) lblAdmPass.innerText = at('new_pass_lbl');
  const settingNewPass = document.getElementById('settingNewPass');
  if (settingNewPass) settingNewPass.placeholder = at('new_pass_ph');

  const lblPassHint = document.getElementById('lblPassHint');
  if (lblPassHint) lblPassHint.innerText = at('pass_hint');

  const lblSaveBoss = document.getElementById('lblBtnSaveBossProfile');
  if (lblSaveBoss) lblSaveBoss.innerText = at('btn_save_boss_profile');

  const lblStaffTitle = document.getElementById('lblStaffSectionTitle');
  if (lblStaffTitle) lblStaffTitle.innerHTML = `<i class="fa-solid fa-users-gear" style="color: #8b5cf6;"></i> ${at('staff_section_title')}`;
  const lblStaffDesc = document.getElementById('lblStaffSectionDesc');
  if (lblStaffDesc) lblStaffDesc.innerText = at('staff_section_desc');

  const lblAddStaff = document.getElementById('lblBtnAddStaff');
  if (lblAddStaff) lblAddStaff.innerText = at('btn_add_staff');

  const thStRole = document.getElementById('thStaffRole');
  if (thStRole) thStRole.innerText = at('th_staff_role');
  const thStName = document.getElementById('thStaffName');
  if (thStName) thStName.innerText = at('th_staff_name');
  const thStPhone = document.getElementById('thStaffPhone');
  if (thStPhone) thStPhone.innerText = at('th_staff_phone');
  const thStPin = document.getElementById('thStaffPin');
  if (thStPin) thStPin.innerText = at('th_staff_pin');
  const thStStatus = document.getElementById('thStaffStatus');
  if (thStStatus) thStStatus.innerText = at('th_staff_status');
  const thStActions = document.getElementById('thStaffActions');
  if (thStActions) thStActions.innerText = at('th_staff_actions');

  const lblMName = document.getElementById('lblModalStaffName');
  if (lblMName) lblMName.innerText = at('lbl_modal_staff_name');
  const lblMRole = document.getElementById('lblModalStaffRole');
  if (lblMRole) lblMRole.innerText = at('lbl_modal_staff_role');
  const lblMPhone = document.getElementById('lblModalStaffPhone');
  if (lblMPhone) lblMPhone.innerText = at('lbl_modal_staff_phone');
  const lblMPin = document.getElementById('lblModalStaffPin');
  if (lblMPin) lblMPin.innerText = at('lbl_modal_staff_pin');
  const lblMAct = document.getElementById('lblModalStaffActive');
  if (lblMAct) lblMAct.innerText = at('lbl_modal_staff_active');

  // Boss grafiklarini qayta chizish
  if (currentBossStats) {
    renderBossCharts(currentBossStats);
    renderDishesList();
  }
}
window.applyAdminLanguage = applyAdminLanguage;

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
  const curr = at('currency');
  filtered.forEach(order => {
    const isNew = order.status === 'new';
    const isWaiterCall = order.type === 'call_waiter' || order.type === 'bill_request';

    let statusBadgeClass = `badge-${order.status}`;
    let statusText = at('status_' + order.status) || order.status;

    if (isWaiterCall) {
      statusBadgeClass = 'badge-waiter';
      statusText = order.type === 'bill_request' ? at('status_bill_request') : at('status_waiter_call');
    }

    html += `
      <div class="order-card ${isNew ? 'new-alert' : ''}">
        <div class="order-header">
          <div class="order-table-num" style="background:#ffedd5; padding:4px 10px; border-radius:8px; color:#ea580c;">
            <i class="fa-solid fa-chair"></i>
            <span style="font-size:17px; font-weight:900;">${at('table_num')} ${order.tableNumber}</span>
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
                <span>${formatMoney(item.price * item.quantity)} ${curr}</span>
              </div>
            `).join('')}

            ${order.serviceFee > 0 ? `
              <div class="order-item-row" style="color: var(--gray-600); font-size: 12px;">
                <span>${at('service_fee')}</span>
                <span>${formatMoney(order.serviceFee)} ${curr}</span>
              </div>
            ` : ''}

            <div class="order-total-row">
              <span>${at('order_total')}</span>
              <span>${formatMoney(order.totalPrice)} ${curr}</span>
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
              <i class="fa-solid fa-fire"></i> ${at('btn_prepare')}
            </button>
            <button class="btn-status" style="background:#fee2e2; color:#b91c1c;" onclick="setOrderStatus('${order.id}', 'cancelled')">
              ${at('btn_cancel')}
            </button>
          ` : ''}

          ${order.status === 'preparing' ? `
            <button class="btn-status" style="background:#dbeafe; color:#1d4ed8;" onclick="setOrderStatus('${order.id}', 'ready')">
              <i class="fa-solid fa-bell-concierge"></i> ${at('btn_ready')}
            </button>
          ` : ''}

          ${order.status === 'ready' ? `
            <button class="btn-status" style="background:#dcfce7; color:#15803d;" onclick="setOrderStatus('${order.id}', 'delivered')">
              <i class="fa-solid fa-check"></i> ${at('btn_delivered')}
            </button>
          ` : ''}

          ${['delivered', 'cancelled'].includes(order.status) ? `
            <div style="text-align: center; width: 100%; font-size: 12px; color: var(--gray-400);">
              ${at('order_closed')}
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
    const defaultReason = currentAdminLang === 'ru' ? 'Гость отказался' : (currentAdminLang === 'en' ? 'Guest cancelled' : 'Mijoz rad etdi');
    reason = prompt(at('cancel_reason_prompt'), defaultReason);
    if (reason === null) return; // Bekor qilish oynasida 'Cancel' bosilsa
    reason = reason.trim() || (currentAdminLang === 'ru' ? 'Причина не указана' : (currentAdminLang === 'en' ? 'Reason not specified' : 'Sabab ko\'rsatilmadi'));
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
    if (catData.success) {
      currentCategories = catData.categories;
      populateDishFilterCategories();
    }

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

function populateDishFilterCategories() {
  const sel = document.getElementById('dishFilterCategorySelect');
  if (!sel) return;
  const currentVal = sel.value;
  let html = `<option value="all">${currentAdminLang === 'ru' ? 'Все категории' : (currentAdminLang === 'en' ? 'All categories' : 'Barcha kategoriyalar')}</option>`;
  currentCategories.forEach(c => {
    const name = currentAdminLang === 'ru' ? (c.nameRu || c.nameUz) : (currentAdminLang === 'en' ? (c.nameEn || c.nameUz) : c.nameUz);
    html += `<option value="${c.id}">${name}</option>`;
  });
  sel.innerHTML = html;
  if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
    sel.value = currentVal;
  }
}
window.populateDishFilterCategories = populateDishFilterCategories;

function onCategoryFilterChange(val) {
  renderDishesTable();
}
window.onCategoryFilterChange = onCategoryFilterChange;

function renderDishesTable() {
  const tbody = document.getElementById('dishesTableBody');
  const search = document.getElementById('dishSearchInput')?.value.toLowerCase().trim() || '';
  const filterCat = document.getElementById('dishFilterCategorySelect')?.value || 'all';

  let list = currentMenu;
  if (filterCat !== 'all') {
    list = list.filter(d => d.categoryId === filterCat);
  }
  if (search) {
    list = list.filter(d => (d.nameUz + ' ' + (d.nameRu || '') + ' ' + (d.nameEn || '')).toLowerCase().includes(search));
  }

  const isWaiter = currentRole === 'waiter';

  if (list.length === 0) {
    const emptyText = currentAdminLang === 'ru' ? 'Блюда не найдены' : (currentAdminLang === 'en' ? 'No dishes found' : 'Taomlar topilmadi');
    tbody.innerHTML = `<tr><td colspan="${isWaiter ? 6 : 7}" style="text-align: center; color: var(--gray-400); padding: 30px;">${emptyText}</td></tr>`;
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
        ${!isWaiter ? `
        <td style="text-align: right;">
          <div class="action-btns" style="justify-content: flex-end;">
            <button class="btn-icon" title="Tahrirlash" onclick="openDishModal('${dish.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon delete" title="O'chirish" onclick="deleteDish('${dish.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>` : ''}
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
      populateDishFilterCategories();
    }
  } catch (e) {
    console.error("Kategoriyalarni yuklashda xatolik:", e);
  }
}

function renderCategoriesTable(catsToRender = currentCategories) {
  const tbody = document.getElementById('categoriesTableBody');
  if (!tbody) return;

  // 1. Yuqori statistikalar
  const totalCount = currentCategories.length;
  const activeCount = currentCategories.filter(c => c.isActive !== false).length;
  const totalDishes = currentCategories.reduce((sum, c) => sum + (c.dishesCount || 0), 0);

  const unitItem = currentAdminLang === 'ru' ? 'категорий' : (currentAdminLang === 'en' ? 'categories' : 'ta');
  const unitDish = currentAdminLang === 'ru' ? 'блюд' : (currentAdminLang === 'en' ? 'dishes' : 'ta');

  const elStatTotal = document.getElementById('catStatTotal');
  if (elStatTotal) elStatTotal.innerText = `${totalCount} ${unitItem}`;
  const elStatActive = document.getElementById('catStatActive');
  if (elStatActive) elStatActive.innerText = `${activeCount} ${unitItem}`;
  const elStatDishes = document.getElementById('catStatDishes');
  if (elStatDishes) elStatDishes.innerText = `${totalDishes} ${unitDish}`;

  if (!catsToRender || catsToRender.length === 0) {
    const emptyMsg = currentAdminLang === 'ru' ? 'Категории не найдены' : (currentAdminLang === 'en' ? 'No categories found' : 'Kategoriyalar mavjud emas');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:36px; color:var(--gray-400);">${emptyMsg}</td></tr>`;
    return;
  }

  let html = '';
  const dishesUnit = currentAdminLang === 'ru' ? 'блюд' : (currentAdminLang === 'en' ? 'dishes' : 'ta taom');

  catsToRender.forEach((cat, idx) => {
    const isActive = cat.isActive !== false;
    const isFirst = idx === 0;
    const isLast = idx === catsToRender.length - 1;

    html += `
      <tr>
        <td style="text-align: center; vertical-align: middle;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <button type="button" class="btn-icon" style="width: 28px; height: 28px; font-size: 11px; padding:0;" title="${at('move_up') || 'Yuqoriga'}" onclick="moveCategory('${cat.id}', 'up')" ${isFirst ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''}>
              <i class="fa-solid fa-arrow-up"></i>
            </button>
            <span style="font-weight: 800; font-size: 13px; min-width: 22px; text-align: center; color: var(--gray-700);">${cat.sortOrder ? Math.round(cat.sortOrder / 10) || (idx + 1) : idx + 1}</span>
            <button type="button" class="btn-icon" style="width: 28px; height: 28px; font-size: 11px; padding:0;" title="${at('move_down') || 'Pastga'}" onclick="moveCategory('${cat.id}', 'down')" ${isLast ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''}>
              <i class="fa-solid fa-arrow-down"></i>
            </button>
          </div>
        </td>
        <td style="text-align: center; vertical-align: middle;">
          <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(235, 94, 40, 0.08); display: flex; align-items: center; justify-content: center; margin: 0 auto;">
            <i class="${cat.icon || 'fa-solid fa-utensils'}" style="color: var(--primary); font-size: 16px;"></i>
          </div>
        </td>
        <td style="vertical-align: middle;"><b>${cat.nameUz}</b></td>
        <td style="vertical-align: middle; color: var(--gray-600);">${cat.nameRu || '-'}</td>
        <td style="vertical-align: middle; color: var(--gray-600);">${cat.nameEn || '-'}</td>
        <td style="text-align: center; vertical-align: middle;">
          <button type="button" onclick="goToCategoryDishes('${cat.id}')" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: .2s;" title="${at('btn_view_dishes')}">
            <i class="fa-solid fa-utensils" style="font-size: 10px;"></i>
            <span>${cat.dishesCount || 0} ${dishesUnit}</span>
            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px; opacity: 0.7;"></i>
          </button>
        </td>
        <td style="text-align: center; vertical-align: middle;">
          <button type="button" onclick="toggleCategoryStatus('${cat.id}')" style="background: ${isActive ? '#ecfdf5' : '#f1f5f9'}; color: ${isActive ? '#059669' : '#64748b'}; border: 1px solid ${isActive ? '#a7f3d0' : '#cbd5e1'}; padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: .2s;" title="Holatni o'zgartirish">
            <i class="fa-solid ${isActive ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
            <span>${isActive ? at('status_active') : at('status_inactive')}</span>
          </button>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <div class="action-btns" style="justify-content: flex-end;">
            <button class="btn-icon" title="Tahrirlash" onclick="openCategoryModal('${cat.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon delete" title="O'chirish" onclick="deleteCategory('${cat.id}', ${cat.dishesCount || 0})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function filterCategoriesTable() {
  const query = document.getElementById('catSearchInput')?.value.toLowerCase().trim() || '';
  if (!query) {
    renderCategoriesTable(currentCategories);
    return;
  }
  const filtered = currentCategories.filter(c => 
    (c.nameUz || '').toLowerCase().includes(query) ||
    (c.nameRu || '').toLowerCase().includes(query) ||
    (c.nameEn || '').toLowerCase().includes(query)
  );
  renderCategoriesTable(filtered);
}
window.filterCategoriesTable = filterCategoriesTable;

async function moveCategory(catId, direction) {
  if (!currentRestaurant) return;
  try {
    const res = await fetch('/api/admin/categories/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: catId,
        direction,
        restaurantId: currentRestaurant.id
      })
    });
    const data = await res.json();
    if (data.success && data.categories) {
      currentCategories = data.categories;
      renderCategoriesTable();
      populateDishFilterCategories();
    }
  } catch (err) {
    console.error("Kategoriya tartibini o'zgartirishda xatolik:", err);
  }
}
window.moveCategory = moveCategory;

async function toggleCategoryStatus(catId) {
  try {
    const res = await fetch(`/api/admin/categories/${catId}/toggle-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success && data.category) {
      const idx = currentCategories.findIndex(c => c.id === catId);
      if (idx !== -1) {
        currentCategories[idx].isActive = data.category.isActive;
      }
      renderCategoriesTable();
    }
  } catch (err) {
    alert("Kategoriya holatini o'zgartirishda xatolik: " + err.message);
  }
}
window.toggleCategoryStatus = toggleCategoryStatus;

function goToCategoryDishes(catId) {
  switchTab('menu');
  const sel = document.getElementById('dishFilterCategorySelect');
  if (sel) {
    sel.value = catId;
  }
  const searchInput = document.getElementById('dishSearchInput');
  if (searchInput) searchInput.value = '';
  renderDishesTable();
}
window.goToCategoryDishes = goToCategoryDishes;

function openCategoryModal(catId = null) {
  const form = document.getElementById('categoryForm');
  const title = document.getElementById('catModalTitle');
  form.reset();

  if (catId) {
    const cat = currentCategories.find(c => c.id === catId);
    if (cat) {
      if (title) title.innerText = currentAdminLang === 'ru' ? "Редактировать категорию" : (currentAdminLang === 'en' ? "Edit Category" : "Kategoriyani tahrirlash");
      document.getElementById('catEditId').value = cat.id;
      document.getElementById('catNameUz').value = cat.nameUz;
      document.getElementById('catNameRu').value = cat.nameRu || '';
      document.getElementById('catNameEn').value = cat.nameEn || '';
      document.getElementById('catIcon').value = cat.icon || '';
      document.getElementById('catIsActive').checked = cat.isActive !== false;
    }
  } else {
    if (title) title.innerText = at('btn_new_cat') || "Yangi kategoriya";
    document.getElementById('catEditId').value = '';
    document.getElementById('catIsActive').checked = true;
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
    icon: document.getElementById('catIcon').value || 'fa-solid fa-utensils',
    isActive: document.getElementById('catIsActive').checked
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

async function deleteCategory(id, dishesCount = 0) {
  let warningText = "Rostdan ham ushbu kategoriyani o'chirmoqchimisiz?";
  if (dishesCount > 0) {
    warningText = (at('confirm_delete_cat_dishes') || "Diqqat! Bu kategoriyada {n} ta taom mavjud. O'chirishni tasdiqlaysizmi?").replace('{n}', dishesCount);
  }
  if (!confirm(warningText)) return;

  try {
    const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadCategories();
      loadMenu();
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

// ==================== 4. STOLLAR & QR KODLAR ====================
let currentQrTheme = 'classic';
let currentQrWifi = true;
let allQrCodes = [];

function getTableZone(tableNumber) {
  const num = parseInt(tableNumber) || 1;
  if (num <= 20) return { key: 'main', badge: at('zone_main_badge'), icon: '🛋️' };
  if (num <= 35) return { key: 'terrace', badge: at('zone_terrace_badge'), icon: '🌿' };
  return { key: 'vip', badge: at('zone_vip_badge'), icon: '👑' };
}

async function loadQRCodes() {
  if (!currentRestaurant) return;
  const countInput = document.getElementById('qrTablesCount');
  if (countInput) countInput.value = currentRestaurant.tablesCount || 10;

  const grid = document.getElementById('qrStickersGrid');
  if (grid && (!allQrCodes || !allQrCodes.length)) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--primary);">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 36px; margin-bottom: 12px; display: block;"></i>
        <div style="font-weight: 700; font-size: 15px; color: var(--gray-700);">${at('loading_qr_codes') || 'QR kodlar yuklanmoqda...'}</div>
      </div>
    `;
  }

  try {
    const res = await fetch(`/api/admin/qr-codes/${currentRestaurant.id}`);
    const data = await res.json();
    if (data.success) {
      allQrCodes = data.qrCodes || [];
      renderQRCodes();
    }
  } catch (e) {
    console.error("QR kodlarni yuklashda xatolik:", e);
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: #ef4444; font-weight: 600; background: var(--white); border-radius: var(--radius-md); border: 2px dashed #fca5a5;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 36px; margin-bottom: 12px; display: block;"></i>
          QR kodlarni yuklashda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.
        </div>
      `;
    }
  }
}

function renderQRCodes() {
  const grid = document.getElementById('qrStickersGrid');
  if (!grid) return;

  const searchQuery = (document.getElementById('qrSearchInput')?.value || '').trim().toLowerCase();
  const selectedZone = document.getElementById('qrZoneFilter')?.value || 'all';

  let filtered = allQrCodes.filter(qr => {
    // 1. Qidiruv bo'yicha filter (stol raqami)
    if (searchQuery && !String(qr.tableNumber).includes(searchQuery)) {
      return false;
    }
    // 2. Zona bo'yicha filter
    if (selectedZone !== 'all') {
      const zone = getTableZone(qr.tableNumber);
      if (zone.key !== selectedZone) return false;
    }
    return true;
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; color: var(--gray-500); font-weight: 600; background: var(--white); border-radius: var(--radius-md); border: 2px dashed var(--gray-300);">
        <i class="fa-solid fa-qrcode" style="font-size: 40px; margin-bottom: 12px; display: block; opacity: 0.35;"></i>
        ${at('no_qr_found')}
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(qr => {
    const zone = getTableZone(qr.tableNumber);
    const hasWifi = currentQrWifi && (currentRestaurant.wifiName || currentRestaurant.wifiPass);
    const wifiHtml = hasWifi ? `
      <div class="qr-wifi-box">
        <i class="fa-solid fa-wifi"></i>
        <span>${escapeHtml(currentRestaurant.wifiName || 'Wi-Fi')}: <b>${escapeHtml(currentRestaurant.wifiPass || '')}</b></span>
      </div>
    ` : '';

    html += `
      <div class="qr-card theme-${currentQrTheme}" data-table="${qr.tableNumber}">
        <span class="qr-zone-pill zone-${zone.key}">${zone.icon} ${zone.badge}</span>
        <div class="qr-rest-title">${escapeHtml(currentRestaurant.name || '')}</div>
        <div class="qr-table-badge">${at('table_badge_text')} ${qr.tableNumber}</div>
        <img class="qr-image" src="${qr.qrDataUrl}" alt="QR Stol ${qr.tableNumber}">
        <div class="qr-instruction">
          <i class="fa-solid fa-camera" style="color:var(--primary);"></i> ${at('scan_for_menu')}
        </div>
        ${wifiHtml}
        <div class="qr-card-actions no-print">
          <a href="${qr.targetUrl}" target="_blank" class="qr-action-btn" title="${at('btn_open_menu_tooltip')}">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
          <a href="${qr.qrDataUrl}" download="${currentRestaurant.slug || 'restoran'}-stol-${qr.tableNumber}.png" class="qr-action-btn" title="${at('btn_download_png_tooltip')}">
            <i class="fa-solid fa-download"></i>
          </a>
          <button type="button" class="qr-action-btn" onclick="printSingleQRCode(${qr.tableNumber})" title="${at('btn_print_single_tooltip')}">
            <i class="fa-solid fa-print"></i>
          </button>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

function filterQRCodes() {
  renderQRCodes();
}

function changeQrTheme(theme) {
  currentQrTheme = theme;
  renderQRCodes();
}

function toggleQrWifi(checked) {
  currentQrWifi = checked;
  renderQRCodes();
}

async function downloadAllQRZip() {
  if (!allQrCodes || !allQrCodes.length) {
    return alert("QR kodlar mavjud emas!");
  }
  if (typeof JSZip === 'undefined' || typeof saveAs === 'undefined') {
    return alert("ZIP yuklash kutubxonasi yuklanmadi. Iltimos sahifani qayta yuklang.");
  }

  try {
    const zip = new JSZip();
    const folderName = `${currentRestaurant.slug || 'restoran'}-qr-stikerlar`;
    const folder = zip.folder(folderName);

    allQrCodes.forEach(qr => {
      // Base64 ma'lumotni tozalash
      const base64Data = qr.qrDataUrl.replace(/^data:image\/png;base64,/, "");
      folder.file(`stol-${qr.tableNumber}.png`, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${folderName}.zip`);
  } catch (e) {
    alert("ZIP yaratishda xatolik: " + e.message);
  }
}

function printFilteredQRCodes() {
  window.print();
}

function printSingleQRCode(tableNum) {
  const grid = document.getElementById('qrStickersGrid');
  if (!grid) return;
  grid.classList.add('print-selected-only');
  document.querySelectorAll('.qr-card').forEach(c => {
    if (c.getAttribute('data-table') == tableNum) {
      c.classList.add('print-include');
    } else {
      c.classList.remove('print-include');
    }
  });

  window.print();

  setTimeout(() => {
    grid.classList.remove('print-selected-only');
    document.querySelectorAll('.qr-card').forEach(c => c.classList.remove('print-include'));
  }, 1000);
}

function printRangeQRCodes() {
  const from = parseInt(document.getElementById('qrRangeFrom')?.value) || 1;
  const to = parseInt(document.getElementById('qrRangeTo')?.value) || (allQrCodes.length || 100);
  if (from > to) {
    return alert("Boshlang'ich raqam yakuniy raqamdan kichik yoki teng bo'lishi kerak!");
  }

  const grid = document.getElementById('qrStickersGrid');
  if (!grid) return;
  grid.classList.add('print-selected-only');
  document.querySelectorAll('.qr-card').forEach(c => {
    const num = parseInt(c.getAttribute('data-table')) || 0;
    if (num >= from && num <= to) {
      c.classList.add('print-include');
    } else {
      c.classList.remove('print-include');
    }
  });

  window.print();

  setTimeout(() => {
    grid.classList.remove('print-selected-only');
    document.querySelectorAll('.qr-card').forEach(c => c.classList.remove('print-include'));
  }, 1000);
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
      alert(at('tables_saved_alert'));
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

// ==================== 5. BOSHLIQ SOZLAMALARI & XODIMLAR ====================
let currentStaffList = [];

function loadStaff() {
  if (!currentRestaurant) return;

  // Xodimlar ro'yxati (agar hali kiritilmagan bo'lsa namunaviy xodimlar taqdim etiladi)
  currentStaffList = currentRestaurant.staff || [
    { id: 'staff-1', name: 'Sardor Rahimov', role: 'manager', phone: '+998 90 111-22-33', pin: '7788', isActive: true },
    { id: 'staff-2', name: 'Nilufar Karimova', role: 'cashier', phone: '+998 93 222-33-44', pin: '1234', isActive: true },
    { id: 'staff-3', name: 'Jasurbek Bekzodov', role: 'waiter', phone: '+998 97 333-44-55', pin: '5555', isActive: true }
  ];

  renderStaffTable();
}

let selectedBossAvatarFile = null;
let removeBossAvatarFlag = false;

function previewBossAvatar(input) {
  if (input.files && input.files[0]) {
    selectedBossAvatarFile = input.files[0];
    removeBossAvatarFlag = false;
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('bossAvatarPreview');
      const placeholder = document.getElementById('bossAvatarPlaceholder');
      const btnRemove = document.getElementById('btnRemoveAvatar');
      if (preview) {
        preview.src = e.target.result;
        preview.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (btnRemove) btnRemove.style.display = 'inline-flex';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function removeBossAvatar() {
  selectedBossAvatarFile = null;
  removeBossAvatarFlag = true;
  const fileInput = document.getElementById('settingOwnerAvatarFile');
  if (fileInput) fileInput.value = '';
  const preview = document.getElementById('bossAvatarPreview');
  const placeholder = document.getElementById('bossAvatarPlaceholder');
  const btnRemove = document.getElementById('btnRemoveAvatar');
  if (preview) preview.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';
  if (btnRemove) btnRemove.style.display = 'none';
}

function loadSettings() {
  if (!currentRestaurant) return;

  // Boshliq ma'lumotlari
  const ownerNameInput = document.getElementById('settingOwnerName');
  if (ownerNameInput) ownerNameInput.value = currentRestaurant.ownerName || '';

  const passInput = document.getElementById('settingNewPass');
  if (passInput) passInput.value = '';

  // Avatar rasmini ko'rsatish
  selectedBossAvatarFile = null;
  removeBossAvatarFlag = false;
  const fileInput = document.getElementById('settingOwnerAvatarFile');
  if (fileInput) fileInput.value = '';

  const preview = document.getElementById('bossAvatarPreview');
  const placeholder = document.getElementById('bossAvatarPlaceholder');
  const btnRemove = document.getElementById('btnRemoveAvatar');

  if (currentRestaurant.ownerAvatar) {
    if (preview) {
      preview.src = currentRestaurant.ownerAvatar;
      preview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (btnRemove) btnRemove.style.display = 'inline-flex';
  } else {
    if (preview) preview.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
    if (btnRemove) btnRemove.style.display = 'none';
  }
}

function renderStaffTable() {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;

  if (!currentStaffList || currentStaffList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 36px 16px; color: var(--gray-500); font-size: 13px; font-weight: 600;">
          <i class="fa-solid fa-users-slash" style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.4;"></i>
          ${at('no_staff_records')}
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  currentStaffList.forEach(s => {
    let roleBadge = '';
    if (s.role === 'manager') {
      roleBadge = `<span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-user-tie"></i> ${at('role_manager')}</span>`;
    } else if (s.role === 'cashier') {
      roleBadge = `<span style="background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-cash-register"></i> ${at('role_cashier')}</span>`;
    } else {
      roleBadge = `<span style="background: #f3e8ff; color: #7e22ce; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-bell-concierge"></i> ${at('role_waiter')}</span>`;
    }

    const statusBadge = s.isActive !== false ?
      `<span style="color: #16a34a; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-circle-check"></i> ${at('status_active')}</span>` :
      `<span style="color: #94a3b8; font-weight: 600; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-circle-xmark"></i> ${at('status_inactive')}</span>`;

    html += `
      <tr style="border-bottom: 1px solid var(--gray-200);">
        <td style="padding: 12px 10px;">${roleBadge}</td>
        <td style="padding: 12px 10px; font-weight: 700; color: var(--gray-800);">${escapeHtml(s.name)}</td>
        <td style="padding: 12px 10px; color: var(--gray-600); font-size: 13px;">${escapeHtml(s.phone || '-')}</td>
        <td style="padding: 12px 10px;">
          <span style="background: var(--gray-100); border: 1px solid var(--gray-200); padding: 4px 10px; border-radius: 6px; font-family: monospace; font-weight: 800; letter-spacing: 2px; font-size: 13px; color: var(--gray-800);">
            ${escapeHtml(s.pin || '••••')}
          </span>
        </td>
        <td style="padding: 12px 10px;">${statusBadge}</td>
        <td style="padding: 12px 10px; text-align: right;">
          <button class="btn-icon" onclick="editStaff('${s.id}')" title="Tahrirlash" style="width: 32px; height: 32px; margin-right: 4px;">
            <i class="fa-solid fa-pen" style="color: #3b82f6;"></i>
          </button>
          <button class="btn-icon" onclick="deleteStaff('${s.id}')" title="O'chirish" style="width: 32px; height: 32px;">
            <i class="fa-solid fa-trash" style="color: #ef4444;"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Boshliq profili va parolini saqlash
async function saveBossProfile(e) {
  e.preventDefault();
  const ownerName = document.getElementById('settingOwnerName').value.trim();
  const oldPass = document.getElementById('settingOldPass')?.value.trim();
  const newPass = document.getElementById('settingNewPass')?.value.trim();

  if (newPass && !oldPass) {
    alert(at('prompt_enter_old_pass') || "Yangi parol o'rnatish uchun joriy (eski) parolni kiriting!");
    document.getElementById('settingOldPass')?.focus();
    return;
  }

  const formData = new FormData();
  formData.append('ownerName', ownerName);
  if (newPass) {
    formData.append('oldPassword', oldPass);
    formData.append('password', newPass);
  }
  if (selectedBossAvatarFile) {
    formData.append('ownerAvatarFile', selectedBossAvatarFile);
  } else if (removeBossAvatarFlag) {
    formData.append('ownerAvatar', '');
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
      if (document.getElementById('settingOldPass')) {
        document.getElementById('settingOldPass').value = '';
      }
      if (document.getElementById('settingNewPass')) {
        document.getElementById('settingNewPass').value = '';
      }
      selectedBossAvatarFile = null;
      removeBossAvatarFlag = false;
      updateSidebarUserInfo();
      alert(at('boss_profile_saved_alert'));
    } else {
      alert(data.message || "Xatolik yuz berdi");
    }
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

// Xodim qo'shish / tahrirlash modali
function openStaffModal(staffId = null) {
  const modal = document.getElementById('staffModal');
  const title = document.getElementById('staffModalTitle');
  const editId = document.getElementById('staffEditId');
  const nameInp = document.getElementById('staffNameInput');
  const roleSel = document.getElementById('staffRoleSelect');
  const phoneInp = document.getElementById('staffPhoneInput');
  const pinInp = document.getElementById('staffPinInput');
  const activeChk = document.getElementById('staffIsActive');

  if (staffId) {
    const s = currentStaffList.find(x => x.id === staffId);
    if (s) {
      title.innerText = at('modal_edit_staff');
      editId.value = s.id;
      nameInp.value = s.name;
      roleSel.value = s.role;
      phoneInp.value = s.phone || '';
      pinInp.value = s.pin || '';
      activeChk.checked = s.isActive !== false;
    }
  } else {
    title.innerText = at('modal_add_staff');
    editId.value = '';
    nameInp.value = '';
    roleSel.value = 'manager';
    phoneInp.value = '';
    pinInp.value = '';
    activeChk.checked = true;
  }

  modal.style.display = 'flex';
}

function closeStaffModal() {
  const modal = document.getElementById('staffModal');
  if (modal) modal.style.display = 'none';
}

async function saveStaff(e) {
  e.preventDefault();
  const editId = document.getElementById('staffEditId').value;
  const name = document.getElementById('staffNameInput').value.trim();
  const role = document.getElementById('staffRoleSelect').value;
  const phone = document.getElementById('staffPhoneInput').value.trim();
  const pin = document.getElementById('staffPinInput').value.trim();
  const isActive = document.getElementById('staffIsActive').checked;

  if (!name || !pin) return alert("Ism va PIN-kod kiritilishi shart!");

  if (editId) {
    const idx = currentStaffList.findIndex(s => s.id === editId);
    if (idx !== -1) {
      currentStaffList[idx] = { ...currentStaffList[idx], name, role, phone, pin, isActive };
    }
  } else {
    currentStaffList.push({
      id: 'staff-' + Date.now(),
      name,
      role,
      phone,
      pin,
      isActive
    });
  }

  closeStaffModal();
  renderStaffTable();
  await persistStaffList();
  alert(at('staff_saved_alert'));
}

async function deleteStaff(id) {
  if (!confirm("Haqiqatan ham ushbu xodimni o'chirmoqchimisiz?")) return;
  currentStaffList = currentStaffList.filter(s => s.id !== id);
  renderStaffTable();
  await persistStaffList();
  alert(at('staff_deleted_alert'));
}

function editStaff(id) {
  openStaffModal(id);
}

async function persistStaffList() {
  try {
    const res = await fetch(`/api/admin/restaurant/${currentRestaurant.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff: currentStaffList })
    });
    const data = await res.json();
    if (data.success) {
      currentRestaurant = { ...currentRestaurant, ...data.restaurant };
      localStorage.setItem('admin_restaurant', JSON.stringify(currentRestaurant));
    }
  } catch (err) {
    console.error("Xodimlarni saqlashda xatolik:", err);
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
      const curr = at('currency');
      const orderCountLabel = currentAdminLang === 'ru' ? `${a.ordersCount} заказов` : (currentAdminLang === 'en' ? `${a.ordersCount} orders` : `${a.ordersCount} ta buyurtma`);
      const totalOrdersLabel = currentAdminLang === 'ru' ? `${a.ordersCount} шт` : (currentAdminLang === 'en' ? `${a.ordersCount}` : `${a.ordersCount} ta`);
      const peakSalesLabel = currentAdminLang === 'ru' ? `Макс. часовая выручка: ${formatMoney(a.peakHourRevenue || 0)} ${curr}` : (currentAdminLang === 'en' ? `Peak hourly sales: ${formatMoney(a.peakHourRevenue || 0)} ${curr}` : `Maksimal soatlik savdo: ${formatMoney(a.peakHourRevenue || 0)} ${curr}`);
      const cancelledBadgeLabel = currentAdminLang === 'ru' ? `${a.cancelledOrdersCount || 0} отмен` : (currentAdminLang === 'en' ? `${a.cancelledOrdersCount || 0} cancelled` : `${a.cancelledOrdersCount || 0} ta bekor`);

      if (document.getElementById('bossTodayRevenue')) {
        document.getElementById('bossTodayRevenue').innerText = `${formatMoney(a.totalRevenue)} ${curr}`;
      }
      if (document.getElementById('bossTodayOrders')) {
        document.getElementById('bossTodayOrders').innerText = orderCountLabel;
      }
      if (document.getElementById('bossAvgCheck')) {
        document.getElementById('bossAvgCheck').innerText = `${formatMoney(a.averageCheck)} ${curr}`;
      }
      if (document.getElementById('bossCashDrawer')) {
        document.getElementById('bossCashDrawer').innerText = `${formatMoney(a.cashTotal || 0)} ${curr}`;
      }
      if (document.getElementById('bossTotalOrdersCount')) {
        document.getElementById('bossTotalOrdersCount').innerText = totalOrdersLabel;
      }
      if (document.getElementById('bossTableTurnover')) {
        const tablesCount = Number(currentRestaurant?.tablesCount) || 10;
        const turnoverVal = (tablesCount > 0 && a.ordersCount > 0) ? (a.ordersCount / tablesCount).toFixed(1) : '0';
        const turnoverUnit = currentAdminLang === 'ru' ? 'раз' : (currentAdminLang === 'en' ? 'times' : 'marta');
        document.getElementById('bossTableTurnover').innerText = `${at('kpi_turnover_desc')} ${turnoverVal} ${turnoverUnit}`;
      }

      // Xizmat haqi va Bekor qilinganlar (Zarar)
      if (document.getElementById('bossServiceFeeTotal')) {
        document.getElementById('bossServiceFeeTotal').innerText = `${formatMoney(a.serviceFeeTotal || 0)} ${curr}`;
      }
      if (document.getElementById('bossCancelledTotal')) {
        document.getElementById('bossCancelledTotal').innerText = `${formatMoney(a.cancelledTotal || 0)} ${curr}`;
      }
      if (document.getElementById('bossCancelledBadge')) {
        document.getElementById('bossCancelledBadge').innerText = cancelledBadgeLabel;
      }

      // 2. To'lov usullari matnlari
      if (document.getElementById('bossCashTotal')) {
        document.getElementById('bossCashTotal').innerText = `${formatMoney(a.cashTotal)} ${curr}`;
      }
      if (document.getElementById('bossCardTotal')) {
        document.getElementById('bossCardTotal').innerText = `${formatMoney(a.cardTotal)} ${curr}`;
      }
      if (document.getElementById('bossClickTotal')) {
        document.getElementById('bossClickTotal').innerText = `${formatMoney(a.clickTotal)} ${curr}`;
      }

      // 3. Taomlar ro'yxati (Top 5 yoki Kam sotilganlar)
      renderDishesList();

      // 4. Ofitsiantlar reyting jadvali
      const waiterTableBody = document.getElementById('bossWaitersTableBody');
      if (waiterTableBody) {
        if (!a.waiterPerformance || a.waiterPerformance.length === 0) {
          const emptyMsg = currentAdminLang === 'ru' ? 'Нет данных по сотрудникам' : (currentAdminLang === 'en' ? 'No staff data' : "Xodimlar bo'yicha ma'lumot yo'q");
          waiterTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--gray-400);">${emptyMsg}</td></tr>`;
        } else {
          let html = '';
          const ordersSuffix = currentAdminLang === 'ru' ? 'заказов' : (currentAdminLang === 'en' ? 'orders' : 'ta');
          a.waiterPerformance.forEach((w, idx) => {
            let medal = '';
            if (idx === 0) medal = '<span style="font-size:18px;">🥇</span>';
            else if (idx === 1) medal = '<span style="font-size:18px;">🥈</span>';
            else if (idx === 2) medal = '<span style="font-size:18px;">🥉</span>';
            else medal = `<span style="font-weight:700; color:var(--gray-400); font-size:12px;">#${idx + 1}</span>`;

            html += `
              <tr>
                <td style="text-align:center; vertical-align:middle;">${medal}</td>
                <td style="vertical-align:middle;"><b><i class="fa-solid fa-user-tie" style="color:#8b5cf6; margin-right:6px;"></i>${w.name}</b></td>
                <td style="text-align:center; vertical-align:middle;"><span style="background:#f3e8ff; color:#7e22ce; padding:3px 10px; border-radius:999px; font-weight:700; font-size:12px;">${w.count} ${ordersSuffix}</span></td>
                <td style="text-align:right; font-weight:800; color:#16a34a; vertical-align:middle;">${formatMoney(w.revenue)} ${curr}</td>
                <td style="text-align:right; color:#2563eb; font-weight:700; vertical-align:middle;">${formatMoney(w.averageCheck)} ${curr}</td>
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
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const pKey = 'boss_p_' + currentBossPeriod;
  const periodTitle = at(pKey) || at('boss_p_today');

  const curr = at('currency');
  let text = '';

  if (currentAdminLang === 'ru') {
    text = [
      `📊 ${restName} — Финансовая Сводка (${periodTitle})`,
      `📅 Дата: ${dateStr} ${timeStr}`,
      `--------------------------------`,
      `💰 Общая выручка: ${formatMoney(s.totalRevenue || 0)} ${curr}`,
      `🧾 Количество заказов: ${s.ordersCount || 0}`,
      `🎯 Средний чек: ${formatMoney(s.averageCheck || 0)} ${curr}`,
      `⚡ Пиковый час: ${s.peakHour || '--'}`,
      `--------------------------------`,
      `💵 Наличные: ${formatMoney(s.cashTotal || 0)} ${curr}`,
      `💳 Банковская карта: ${formatMoney(s.cardTotal || 0)} ${curr}`,
      `📱 Click / Payme: ${formatMoney(s.clickTotal || 0)} ${curr}`,
      `🛎️ Доход от обслуживания: ${formatMoney(s.serviceFeeTotal || 0)} ${curr}`,
      `🚫 Отменено: ${s.cancelledOrdersCount || 0} шт (${formatMoney(s.cancelledTotal || 0)} ${curr})`,
      `--------------------------------`,
      `🏆 Топ блюдо: ${s.topDishes?.[0] ? `${s.topDishes[0].name} (${s.topDishes[0].count} шт)` : "Нет"}`
    ].join('\n');
  } else if (currentAdminLang === 'en') {
    text = [
      `📊 ${restName} — Financial Summary (${periodTitle})`,
      `📅 Date: ${dateStr} ${timeStr}`,
      `--------------------------------`,
      `💰 Total revenue: ${formatMoney(s.totalRevenue || 0)} ${curr}`,
      `🧾 Total orders: ${s.ordersCount || 0}`,
      `🎯 Average check: ${formatMoney(s.averageCheck || 0)} ${curr}`,
      `⚡ Peak hour: ${s.peakHour || '--'}`,
      `--------------------------------`,
      `💵 Cash: ${formatMoney(s.cashTotal || 0)} ${curr}`,
      `💳 Card: ${formatMoney(s.cardTotal || 0)} ${curr}`,
      `📱 Click / Payme: ${formatMoney(s.clickTotal || 0)} ${curr}`,
      `🛎️ Service fee: ${formatMoney(s.serviceFeeTotal || 0)} ${curr}`,
      `🚫 Cancelled: ${s.cancelledOrdersCount || 0} (${formatMoney(s.cancelledTotal || 0)} ${curr})`,
      `--------------------------------`,
      `🏆 Top dish: ${s.topDishes?.[0] ? `${s.topDishes[0].name} (${s.topDishes[0].count})` : "None"}`
    ].join('\n');
  } else {
    text = [
      `📊 ${restName} — Moliyaviy Xulosa (${periodTitle})`,
      `📅 Sana: ${dateStr} ${timeStr}`,
      `--------------------------------`,
      `💰 Jami tushum: ${formatMoney(s.totalRevenue || 0)} ${curr}`,
      `🧾 Buyurtmalar soni: ${s.ordersCount || 0} ta`,
      `🎯 O'rtacha chek: ${formatMoney(s.averageCheck || 0)} ${curr}`,
      `⚡ Eng qizg'in vaqt: ${s.peakHour || '--'}`,
      `--------------------------------`,
      `💵 Naqd pul: ${formatMoney(s.cashTotal || 0)} ${curr}`,
      `💳 Plastik karta: ${formatMoney(s.cardTotal || 0)} ${curr}`,
      `📱 Click / Payme: ${formatMoney(s.clickTotal || 0)} ${curr}`,
      `🛎️ Xizmat haqi: ${formatMoney(s.serviceFeeTotal || 0)} ${curr}`,
      `🚫 Bekor qilingan: ${s.cancelledOrdersCount || 0} ta (${formatMoney(s.cancelledTotal || 0)} ${curr})`,
      `--------------------------------`,
      `🏆 Top taom: ${s.topDishes?.[0] ? `${s.topDishes[0].name} (${s.topDishes[0].count} ta)` : "Yo'q"}`
    ].join('\n');
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      alert(at('copied_alert'));
    }).catch(() => {
      prompt("Summary:", text);
    });
  } else {
    prompt("Summary:", text);
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

function exportSalesReportCSV() {
  const s = currentBossStats || {};
  const restName = currentRestaurant?.name || 'Restoran';
  const curr = at('currency');
  const pKey = 'boss_p_' + currentBossPeriod;
  const periodLabel = at(pKey) || currentBossPeriod;

  let csv = '\uFEFF';
  csv += `"${restName} - ${at('boss_header_title')} (${periodLabel})"\n`;
  csv += `"Ko'rsatkich","Qiymat"\n`;
  csv += `"${at('kpi_period_revenue')}","${s.totalRevenue || 0} ${curr}"\n`;
  csv += `"${at('kpi_total_orders')}","${s.ordersCount || 0}"\n`;
  csv += `"${at('kpi_avg_check')}","${s.averageCheck || 0} ${curr}"\n`;
  csv += `"${at('kpi_cash_drawer')}","${s.cashTotal || 0} ${curr}"\n`;
  csv += `"Plastik karta","${s.cardTotal || 0} ${curr}"\n`;
  csv += `"Click / Payme","${s.clickTotal || 0} ${curr}"\n`;
  csv += `"${at('kpi_service_fee')}","${s.serviceFeeTotal || 0} ${curr}"\n`;
  csv += `"${at('kpi_cancelled_loss')}","${s.cancelledTotal || 0} ${curr} (${s.cancelledOrdersCount || 0} ta)"\n\n`;

  csv += `"№","${at('th_dish_rank_dish')}","${at('th_dish_rank_sold')}","${at('th_dish_rank_rev')}"\n`;
  (s.topDishes || []).forEach((d, idx) => {
    csv += `"${idx + 1}","${d.name.replace(/"/g, '""')}","${d.count}","${d.revenue} ${curr}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `savdo_hisoboti_${currentBossPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.exportSalesReportCSV = exportSalesReportCSV;

// ==================== TAOMLAR SOTUV REYTINGI (BOSHLIQ) ====================
let currentDishRankingPeriod = 'today';
let allDishRankingsData = [];

async function loadBossDishRanking() {
  if (!currentRestaurant) return;

  try {
    const url = `/api/admin/boss/analytics/${currentRestaurant.id}?period=${currentDishRankingPeriod}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.success && data.analytics) {
      const a = data.analytics;
      allDishRankingsData = a.allDishRankings || [];

      // 1. KPI kartochkalari
      const curr = at('currency');
      const topDish = allDishRankingsData.length > 0 && allDishRankingsData[0].soldCount > 0 ? allDishRankingsData[0] : null;

      const elTopName = document.getElementById('kpiTopDishName');
      const elTopCount = document.getElementById('kpiTopDishCount');
      if (elTopName) {
        elTopName.innerText = topDish ? (currentAdminLang === 'ru' ? (topDish.nameRu || topDish.name) : (currentAdminLang === 'en' ? (topDish.nameEn || topDish.name) : topDish.name)) : '--';
      }
      if (elTopCount) {
        if (topDish) {
          const soldText = currentAdminLang === 'ru' ? `${topDish.soldCount} шт (${formatMoney(topDish.totalRevenue)} ${curr})` : (currentAdminLang === 'en' ? `${topDish.soldCount} sold (${formatMoney(topDish.totalRevenue)} ${curr})` : `${topDish.soldCount} ta sotildi (${formatMoney(topDish.totalRevenue)} ${curr})`);
          elTopCount.innerText = soldText;
        } else {
          elTopCount.innerText = currentAdminLang === 'ru' ? '0 шт' : (currentAdminLang === 'en' ? '0 sold' : '0 ta sotildi');
        }
      }

      const elTotalCount = document.getElementById('kpiTotalDishesCount');
      if (elTotalCount) {
        const totalDishes = a.totalDishesCount || 0;
        elTotalCount.innerText = currentAdminLang === 'ru' ? `${totalDishes} шт` : (currentAdminLang === 'en' ? `${totalDishes}` : `${totalDishes} ta`);
      }

      const elTotalRev = document.getElementById('kpiTotalDishesRevenue');
      if (elTotalRev) {
        elTotalRev.innerText = `${formatMoney(a.totalDishesRevenue || 0)} ${curr}`;
      }

      const elActiveMenu = document.getElementById('kpiActiveMenuCount');
      if (elActiveMenu) {
        elActiveMenu.innerText = currentAdminLang === 'ru' ? `${allDishRankingsData.length} шт` : (currentAdminLang === 'en' ? `${allDishRankingsData.length}` : `${allDishRankingsData.length} ta`);
      }

      // 2. Kategoriya filtrini to'ldirish
      populateDishRankingCategories();

      // 3. Filtrlash va jadvalni chizish
      filterDishRanking();
    }
  } catch (err) {
    console.error("Taomlar reytingini yuklashda xatolik:", err);
  }
}
window.loadBossDishRanking = loadBossDishRanking;

function changeDishRankingPeriod(period, btn) {
  currentDishRankingPeriod = period;
  document.querySelectorAll('.dish-period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadBossDishRanking();
}
window.changeDishRankingPeriod = changeDishRankingPeriod;

function populateDishRankingCategories() {
  const select = document.getElementById('dishRankingCatFilter');
  if (!select) return;

  const currentVal = select.value;
  const catsMap = new Map();
  allDishRankingsData.forEach(d => {
    if (d.categoryId && d.categoryName) {
      catsMap.set(d.categoryId, d.categoryName);
    }
  });

  let optionsHtml = `<option value="all">${at('dish_rank_all_cats')}</option>`;
  catsMap.forEach((name, id) => {
    optionsHtml += `<option value="${id}">${escapeHtml(name)}</option>`;
  });
  select.innerHTML = optionsHtml;
  if (catsMap.has(currentVal)) {
    select.value = currentVal;
  }
}

function filterDishRanking() {
  const searchInput = document.getElementById('dishRankingSearch');
  const catSelect = document.getElementById('dishRankingCatFilter');
  const sortSelect = document.getElementById('dishRankingSort');

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const selectedCat = catSelect ? catSelect.value : 'all';
  const sortBy = sortSelect ? sortSelect.value : 'sold_desc';

  let list = allDishRankingsData.slice();

  // 1. Kategoriya bo'yicha filtrlash
  if (selectedCat !== 'all') {
    list = list.filter(d => d.categoryId === selectedCat);
  }

  // 2. Qidiruv bo'yicha filtrlash (UZ, RU, EN)
  if (query) {
    list = list.filter(d => {
      const nameUz = (d.name || '').toLowerCase();
      const nameRu = (d.nameRu || '').toLowerCase();
      const nameEn = (d.nameEn || '').toLowerCase();
      const catName = (d.categoryName || '').toLowerCase();
      return nameUz.includes(query) || nameRu.includes(query) || nameEn.includes(query) || catName.includes(query);
    });
  }

  // 3. Saralash
  if (sortBy === 'sold_desc') {
    list.sort((a, b) => b.soldCount - a.soldCount || b.totalRevenue - a.totalRevenue);
  } else if (sortBy === 'sold_asc') {
    list.sort((a, b) => a.soldCount - b.soldCount || a.totalRevenue - b.totalRevenue);
  } else if (sortBy === 'rev_desc') {
    list.sort((a, b) => b.totalRevenue - a.totalRevenue || b.soldCount - a.soldCount);
  } else if (sortBy === 'name_asc') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  renderDishRankingTable(list);
}
window.filterDishRanking = filterDishRanking;

function renderDishRankingTable(list) {
  const tbody = document.getElementById('dishRankingTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    const emptyMsg = at('dish_rank_empty');
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:40px 16px; color:var(--gray-400);">
          <i class="fa-solid fa-utensils" style="font-size:32px; margin-bottom:10px; display:block; color:var(--gray-300);"></i>
          <span style="font-weight:600; font-size:14px;">${emptyMsg}</span>
        </td>
      </tr>
    `;
    return;
  }

  const curr = at('currency');
  const maxSold = Math.max(...list.map(d => d.soldCount || 0), 1);

  let html = '';
  list.forEach((d, idx) => {
    // 1. O'rin (Rank)
    let rankBadge = '';
    if (idx === 0 && d.soldCount > 0) {
      rankBadge = `<span style="font-size:20px;" title="1-o'rin">🥇</span>`;
    } else if (idx === 1 && d.soldCount > 0) {
      rankBadge = `<span style="font-size:20px;" title="2-o'rin">🥈</span>`;
    } else if (idx === 2 && d.soldCount > 0) {
      rankBadge = `<span style="font-size:20px;" title="3-o'rin">🥉</span>`;
    } else {
      rankBadge = `<span style="font-weight:800; color:var(--gray-500); font-size:13px;">#${idx + 1}</span>`;
    }

    // 2. Taom nomi (Tilga qarab)
    const displayName = currentAdminLang === 'ru' ? (d.nameRu || d.name) : (currentAdminLang === 'en' ? (d.nameEn || d.name) : d.name);

    // 3. Rasm
    const imgHtml = d.image
      ? `<img src="${d.image}" alt="${escapeHtml(displayName)}" style="width:42px; height:42px; object-fit:cover; border-radius:8px; border:1px solid var(--gray-200);">`
      : `<div style="width:42px; height:42px; border-radius:8px; background:var(--gray-100); display:flex; align-items:center; justify-content:center; color:var(--gray-400); font-size:16px;"><i class="fa-solid fa-bowl-food"></i></div>`;

    // 4. Progress bar (Sotilgan miqdoriga nisbatan)
    const pct = d.soldCount > 0 ? Math.min(100, Math.round((d.soldCount / maxSold) * 100)) : 0;
    const barColor = idx === 0 ? '#ea580c' : (idx < 3 ? '#f59e0b' : '#10b981');

    // 5. Holati / Trend
    let statusBadge = '';
    if (d.soldCount >= 10) {
      statusBadge = `<span style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:4px 8px; border-radius:6px; font-weight:800; font-size:11px; white-space:nowrap;">${at('dish_rank_status_hit')}</span>`;
    } else if (d.soldCount >= 3) {
      statusBadge = `<span style="background:#fffbeb; color:#d97706; border:1px solid #fde68a; padding:4px 8px; border-radius:6px; font-weight:800; font-size:11px; white-space:nowrap;">${at('dish_rank_status_popular')}</span>`;
    } else if (d.soldCount > 0) {
      statusBadge = `<span style="background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; padding:4px 8px; border-radius:6px; font-weight:700; font-size:11px; white-space:nowrap;">${at('dish_rank_status_normal')}</span>`;
    } else {
      statusBadge = `<span style="background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; padding:4px 8px; border-radius:6px; font-weight:600; font-size:11px; white-space:nowrap;">${at('dish_rank_status_low')}</span>`;
    }

    const soldCountText = currentAdminLang === 'ru' ? `${d.soldCount} шт` : (currentAdminLang === 'en' ? `${d.soldCount} sold` : `${d.soldCount} ta`);

    html += `
      <tr style="border-bottom:1px solid var(--gray-200); transition:background 0.15s;" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background='transparent'">
        <td style="text-align:center; padding:12px 10px; vertical-align:middle;">${rankBadge}</td>
        <td style="padding:12px 10px; vertical-align:middle;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${imgHtml}
            <div>
              <div style="font-weight:800; font-size:14px; color:var(--dark);">${escapeHtml(displayName)}</div>
              <div style="font-size:11px; color:var(--gray-400);">${escapeHtml(d.categoryName || '')}</div>
            </div>
          </div>
        </td>
        <td style="padding:12px 10px; vertical-align:middle;">
          <span style="background:var(--gray-100); color:var(--gray-700); padding:4px 10px; border-radius:6px; font-weight:600; font-size:12px;">
            ${escapeHtml(d.categoryName || '--')}
          </span>
        </td>
        <td style="padding:12px 10px; text-align:right; font-weight:700; color:var(--gray-700); font-size:13px; vertical-align:middle;">
          ${formatMoney(d.price)} ${curr}
        </td>
        <td style="padding:12px 10px; vertical-align:middle;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:4px;">
            <b style="color:var(--dark); font-size:13px;">${soldCountText}</b>
            <span style="font-size:11px; color:var(--gray-400); font-weight:600;">${pct}%</span>
          </div>
          <div style="height:6px; width:100%; background:var(--gray-200); border-radius:999px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:${barColor}; border-radius:999px; transition:width 0.3s;"></div>
          </div>
        </td>
        <td style="padding:12px 10px; text-align:right; font-weight:900; color:#16a34a; font-size:14px; vertical-align:middle;">
          ${formatMoney(d.totalRevenue)} ${curr}
        </td>
        <td style="padding:12px 10px; text-align:center; vertical-align:middle;">
          <span style="font-weight:800; font-size:12px; color:var(--primary); background:rgba(235, 94, 40, 0.08); padding:3px 8px; border-radius:6px;">
            ${d.sharePercent}%
          </span>
        </td>
        <td style="padding:12px 10px; text-align:center; vertical-align:middle;">
          ${statusBadge}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function exportDishRankingCSV() {
  if (!allDishRankingsData || allDishRankingsData.length === 0) {
    alert(currentAdminLang === 'ru' ? "Нет данных для экспорта!" : (currentAdminLang === 'en' ? "No data to export!" : "Eksport qilish uchun ma'lumot yo'q!"));
    return;
  }

  const pKey = 'boss_p_' + currentDishRankingPeriod;
  const periodLabel = at(pKey) || currentDishRankingPeriod;
  const restName = currentRestaurant?.name || 'Restoran';

  // UTF-8 BOM qo'shiladi (\uFEFF) toki Excel kirill va o'zbek lotin harflarini xatosiz ochsin
  let csv = '\uFEFF';
  csv += `"${restName} - ${at('dish_rank_title')} (${periodLabel})"\n`;
  csv += `"${at('th_dish_rank_num')}","${at('th_dish_rank_dish')}","${at('th_dish_rank_cat')}","${at('th_dish_rank_price')}","${at('th_dish_rank_sold')}","${at('th_dish_rank_rev')}","${at('th_dish_rank_share')} (%)"\n`;

  allDishRankingsData.forEach((d, idx) => {
    const name = currentAdminLang === 'ru' ? (d.nameRu || d.name) : (currentAdminLang === 'en' ? (d.nameEn || d.name) : d.name);
    const cat = d.categoryName || '';
    csv += `"${idx + 1}","${name.replace(/"/g, '""')}","${cat.replace(/"/g, '""')}","${d.price}","${d.soldCount}","${d.totalRevenue}","${d.sharePercent}%"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const filename = `taomlar_reytingi_${currentDishRankingPeriod}_${new Date().toISOString().split('T')[0]}.csv`;
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.exportDishRankingCSV = exportDishRankingCSV;

function printDishRanking() {
  if (!allDishRankingsData || allDishRankingsData.length === 0) {
    alert(currentAdminLang === 'ru' ? "Нет данных для печати!" : (currentAdminLang === 'en' ? "No data to print!" : "Chop etish uchun ma'lumot yo'q!"));
    return;
  }

  const restName = currentRestaurant?.name || 'Restoran';
  const pKey = 'boss_p_' + currentDishRankingPeriod;
  const periodLabel = at(pKey) || currentDishRankingPeriod;
  const curr = at('currency');
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let totalSold = 0;
  let totalRev = 0;
  allDishRankingsData.forEach(d => {
    totalSold += (d.soldCount || 0);
    totalRev += (d.totalRevenue || 0);
  });

  let rowsHtml = '';
  allDishRankingsData.forEach((d, idx) => {
    const name = currentAdminLang === 'ru' ? (d.nameRu || d.name) : (currentAdminLang === 'en' ? (d.nameEn || d.name) : d.name);
    rowsHtml += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px;"><b>${escapeHtml(name)}</b></td>
        <td style="padding: 6px;">${escapeHtml(d.categoryName || '')}</td>
        <td style="padding: 6px; text-align: right;">${formatMoney(d.price)} ${curr}</td>
        <td style="padding: 6px; text-align: center;"><b>${d.soldCount}</b></td>
        <td style="padding: 6px; text-align: right;"><b>${formatMoney(d.totalRevenue)} ${curr}</b></td>
        <td style="padding: 6px; text-align: center;">${d.sharePercent}%</td>
      </tr>
    `;
  });

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${at('dish_rank_title')} - ${restName}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; margin: 20px; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th { background: #f1f5f9; padding: 8px 6px; text-align: left; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
          td { font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px; }
          .summary { display: flex; justify-content: space-around; background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 14px; }
          .summary-item { text-align: center; }
          .summary-item b { font-size: 15px; color: #0f172a; display: block; }
          @media print {
            body { margin: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0 0 4px; font-size: 18px; color: #0f172a;">${restName}</h2>
          <h3 style="margin: 0 0 6px; font-size: 14px; color: #475569;">${at('dish_rank_title')}</h3>
          <div style="font-size: 11px; color: #64748b;">
            <span><b>${at('dish_rank_period')}</b> ${periodLabel}</span> | 
            <span><b>Sana:</b> ${dateStr} ${timeStr}</span>
          </div>
        </div>

        <div class="summary">
          <div class="summary-item">
            <span style="font-size: 11px; color: #64748b;">${at('dish_rank_kpi_sold_total')}</span>
            <b>${totalSold} ta</b>
          </div>
          <div class="summary-item">
            <span style="font-size: 11px; color: #64748b;">${at('dish_rank_kpi_rev_total')}</span>
            <b style="color: #16a34a;">${formatMoney(totalRev)} ${curr}</b>
          </div>
          <div class="summary-item">
            <span style="font-size: 11px; color: #64748b;">${at('dish_rank_kpi_active_menu')}</span>
            <b>${allDishRankingsData.length} ta</b>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">${at('th_dish_rank_num')}</th>
              <th>${at('th_dish_rank_dish')}</th>
              <th>${at('th_dish_rank_cat')}</th>
              <th style="text-align: right;">${at('th_dish_rank_price')}</th>
              <th style="text-align: center;">${at('th_dish_rank_sold')}</th>
              <th style="text-align: right;">${at('th_dish_rank_rev')}</th>
              <th style="text-align: center;">${at('th_dish_rank_share')}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; border-top: 1px dashed #cbd5e1; padding-top: 14px;">
          <div>Rahbar: _____________________</div>
          <div>Menejer / Hisobchi: _____________________</div>
        </div>

        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
window.printDishRanking = printDishRanking;

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
