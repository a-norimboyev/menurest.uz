let restaurants = [];
let superToken = localStorage.getItem('super_admin_token') || null;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function superFetch(url, options = {}) {
  const headers = options.headers || {};
  if (superToken) {
    headers['Authorization'] = 'Bearer ' + superToken;
  }
  options.headers = headers;

  const res = await fetch(url, options);
  if (res.status === 401 || res.status === 403) {
    handleSuperLogout();
    throw new Error("Sessiya muddati tugadi yoki ruxsat yo'q. Qayta kiring.");
  }
  return res;
}

// Boshlang'ich tekshiruv
function checkAuth() {
  if (superToken) {
    document.getElementById('superAuthWrapper').style.display = 'none';
    document.getElementById('superLayout').style.display = 'flex';
    initDashboard();
  } else {
    document.getElementById('superAuthWrapper').style.display = 'flex';
    document.getElementById('superLayout').style.display = 'none';
  }
}

async function handleSuperLogin(e) {
  e.preventDefault();
  const username = document.getElementById('superLoginUser').value.trim();
  const password = document.getElementById('superLoginPass').value.trim();

  try {
    const res = await fetch('/api/super/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success && data.token) {
      superToken = data.token;
      localStorage.setItem('super_admin_token', data.token);
      checkAuth();
    } else {
      alert(data.message || "Login yoki parol noto'g'ri");
    }
  } catch (err) {
    alert("Server bilan aloqa uzildi: " + err.message);
  }
}

function handleSuperLogout() {
  superToken = null;
  localStorage.removeItem('super_admin_token');
  checkAuth();
}

async function initDashboard() {
  loadStats();
  loadRestaurants();
  loadLeads();
}

async function loadStats() {
  try {
    const res = await superFetch('/api/super/stats');
    const data = await res.json();
    if (data.success) {
      document.getElementById('statRestCount').innerText = data.totalRestaurants;
      document.getElementById('statMenuCount').innerText = data.totalMenuItems;
      document.getElementById('statOrdersCount').innerText = data.totalOrders;
    }
  } catch (e) {
    console.error("Statistikani yuklashda xatolik:", e);
  }

  // Leads count
  try {
    const leadsRes = await superFetch('/api/super/leads');
    const leadsData = await leadsRes.json();
    if (leadsData.success) {
      const newLeads = leadsData.leads.filter(l => l.status === 'new').length;
      document.getElementById('statLeadsCount').innerText = newLeads;
    }
  } catch (e) {}
}

async function loadLeads() {
  const tbody = document.getElementById('leadsTableBody');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Yuklanmoqda...</td></tr>`;
  try {
    const res = await superFetch('/api/super/leads');
    const data = await res.json();
    if (data.success && data.leads.length > 0) {
      const planLabel = { start: '🟢 Start', standart: '🔵 Standart', standard: '🔵 Standart', premium: '🟣 Premium' };
      tbody.innerHTML = data.leads.map(lead => `
        <tr>
          <td><b>${escapeHtml(lead.restaurantName || '-')}</b></td>
          <td>${escapeHtml(lead.ownerName || '-')}</td>
          <td><a href="tel:${escapeHtml(lead.phone)}" style="color: #0284c7; font-weight: 700;">${escapeHtml(lead.phone)}</a></td>
          <td>${planLabel[lead.plan] || escapeHtml(lead.plan) || '-'}</td>
          <td style="max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(lead.message || '—')}</td>
          <td style="font-size: 12px; color: #64748b;">${new Date(lead.createdAt).toLocaleString('uz-UZ', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Hozircha birorta ham ariza yo'q</td></tr>`;
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Yuklashda xatolik: ${escapeHtml(e.message)}</td></tr>`;
  }
}

function showLeads() {
  document.getElementById('leadsSection').scrollIntoView({ behavior: 'smooth' });
  loadLeads();
}

async function loadRestaurants() {
  try {
    const res = await superFetch('/api/super/restaurants');
    const data = await res.json();
    if (data.success) {
      restaurants = data.restaurants;
      renderTable();
    }
  } catch (e) {
    console.error("Restoranlarni yuklashda xatolik:", e);
  }
}

function renderTable(list = restaurants) {
  const tbody = document.getElementById('superRestTableBody');
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--gray-600);">Hozircha birorta ham restoran mavjud emas. Yangi restoran qo'shing!</td></tr>`;
    return;
  }

  let html = '';
  list.forEach(rest => {
    html += `
      <tr>
        <td>
          <img src="${escapeHtml(rest.logo || '/images/default-logo.png')}" class="rest-avatar" alt="${escapeHtml(rest.name)}">
        </td>
        <td>
          <b>${escapeHtml(rest.name)}</b>
          <div style="font-size: 11px; color: var(--gray-600);">${escapeHtml(rest.address || 'Manzil kiritilmagan')}</div>
        </td>
        <td>
          <code style="background: #e0e7ff; color: #4338ca; padding: 3px 8px; border-radius: 6px; font-weight: 700;">/r/${escapeHtml(rest.slug)}</code>
        </td>
        <td>${escapeHtml(rest.phone || '-')}</td>
        <td><b>${rest.dishesCount || 0} ta</b></td>
        <td><b>${rest.ordersCount || 0} ta</b></td>
        <td>
          <span class="badge ${rest.isActive ? 'badge-active' : 'badge-inactive'}">
            ${rest.isActive ? 'Faol' : 'Nofaol'}
          </span>
        </td>
        <td>
          <div class="actions">
            <a href="/r/${escapeHtml(rest.slug)}?table=1" target="_blank" class="btn-icon view" title="Mijoz menyusini ko'rish">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
            <button class="btn-icon edit" onclick="editRestaurant('${rest.id}')" title="Tahrirlash">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-icon delete" onclick="deleteRestaurant('${rest.id}', '${escapeHtml(rest.name)}')" title="O'chirish">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function filterRestaurants() {
  const query = document.getElementById('restSearch').value.toLowerCase().trim();
  const filtered = restaurants.filter(r => 
    r.name.toLowerCase().includes(query) || 
    r.slug.toLowerCase().includes(query) ||
    (r.phone && r.phone.includes(query))
  );
  renderTable(filtered);
}

function generateSlug() {
  const name = document.getElementById('restNameInput').value;
  const editId = document.getElementById('editRestId').value;
  if (!editId) {
    const slug = name.toLowerCase().trim()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');
    document.getElementById('restSlugInput').value = slug;
  }
}

function openAddRestModal() {
  document.getElementById('editRestId').value = '';
  document.getElementById('modalRestTitle').innerText = "Yangi Restoran Qo'shish";
  document.getElementById('addRestForm').reset();
  document.getElementById('restPasswordInput').required = true;
  document.getElementById('addRestModal').classList.add('active');
}

function closeAddRestModal() {
  document.getElementById('addRestModal').classList.remove('active');
}

function closeModalOnOverlay(e) {
  if (e.target.id === 'addRestModal') {
    closeAddRestModal();
  }
}

function editRestaurant(id) {
  const rest = restaurants.find(r => r.id === id);
  if (!rest) return;

  document.getElementById('editRestId').value = rest.id;
  document.getElementById('modalRestTitle').innerText = "Restoranni Tahrirlash";
  document.getElementById('restNameInput').value = rest.name;
  document.getElementById('restSlugInput').value = rest.slug;
  document.getElementById('restPasswordInput').value = '';
  document.getElementById('restPasswordInput').placeholder = "O'zgartirmaslik uchun bo'sh qoldiring";
  document.getElementById('restPasswordInput').required = false;
  document.getElementById('restPhoneInput').value = rest.phone || '';
  document.getElementById('restTablesInput').value = rest.tablesCount || 10;
  document.getElementById('restAddressInput').value = rest.address || '';
  document.getElementById('restLogoInput').value = rest.logo || '';
  document.getElementById('restBannerInput').value = rest.banner || '';
  document.getElementById('restDescInput').value = rest.description || '';
  document.getElementById('restFeeInput').value = rest.serviceFeePercent || 0;

  document.getElementById('addRestModal').classList.add('active');
}

async function handleSaveRestaurant(e) {
  e.preventDefault();

  const id = document.getElementById('editRestId').value;
  const data = {
    name: document.getElementById('restNameInput').value,
    slug: document.getElementById('restSlugInput').value,
    phone: document.getElementById('restPhoneInput').value,
    tablesCount: Number(document.getElementById('restTablesInput').value),
    address: document.getElementById('restAddressInput').value,
    logo: document.getElementById('restLogoInput').value,
    banner: document.getElementById('restBannerInput').value,
    description: document.getElementById('restDescInput').value,
    serviceFeePercent: Number(document.getElementById('restFeeInput').value)
  };

  const pass = document.getElementById('restPasswordInput').value;
  if (pass && pass.trim() !== '') {
    data.password = pass.trim();
  }

  try {
    let res;
    if (id) {
      res = await superFetch(`/api/super/restaurants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      res = await superFetch('/api/super/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    const result = await res.json();
    if (result.success) {
      closeAddRestModal();
      loadRestaurants();
      loadStats();
    } else {
      alert("Xatolik: " + result.message);
    }
  } catch (err) {
    alert("Serverga ulanishda xatolik: " + err.message);
  }
}

async function deleteRestaurant(id, name) {
  if (!confirm(`Haqiqatdan ham "${name}" restoranini butunlay o'chirib tashlamoqchimisiz?\nUnga tegishli barcha taomlar va buyurtmalar ham o'chib ketadi!`)) {
    return;
  }

  try {
    const res = await superFetch(`/api/super/restaurants/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
      loadRestaurants();
      loadStats();
    } else {
      alert("O'chirishda xatolik: " + result.message);
    }
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

// Boshlang'ich autentifikatsiyani tekshirish
checkAuth();
