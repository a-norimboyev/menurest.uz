let restaurants = [];

async function init() {
  loadStats();
  loadRestaurants();
}

async function loadStats() {
  try {
    const res = await fetch('/api/super/stats');
    const data = await res.json();
    if (data.success) {
      document.getElementById('statRestCount').innerText = data.totalRestaurants;
      document.getElementById('statMenuCount').innerText = data.totalMenuItems;
      document.getElementById('statOrdersCount').innerText = data.totalOrders;
    }
  } catch (e) {
    console.error("Statistikani yuklashda xatolik:", e);
  }
}

async function loadRestaurants() {
  try {
    const res = await fetch('/api/super/restaurants');
    const data = await res.json();
    if (data.success) {
      restaurants = data.restaurants;
      renderTable();
    }
  } catch (e) {
    console.error("Restoranlarni yuklashda xatolik:", e);
  }
}

function renderTable() {
  const tbody = document.getElementById('superRestTableBody');
  if (restaurants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--gray-600);">Hozircha birorta ham restoran mavjud emas. Yangi restoran qo'shing!</td></tr>`;
    return;
  }

  let html = '';
  restaurants.forEach(rest => {
    html += `
      <tr>
        <td>
          <img src="${rest.logo || '/images/default-logo.png'}" class="rest-avatar" alt="${rest.name}">
        </td>
        <td>
          <b>${rest.name}</b>
          <div style="font-size: 11px; color: var(--gray-600);">${rest.address || 'Manzil kiritilmagan'}</div>
        </td>
        <td>
          <code style="background: #e0e7ff; color: #4338ca; padding: 3px 8px; border-radius: 6px; font-weight: 700;">/r/${rest.slug}</code>
        </td>
        <td>${rest.phone || '-'}</td>
        <td><b>${rest.tablesCount || 10} ta</b></td>
        <td><b>${rest.dishesCount || 0} ta</b></td>
        <td>
          <span class="badge-active">Faol</span>
        </td>
        <td style="text-align: right;">
          <div class="action-btns" style="justify-content: flex-end;">
            <a href="/r/${rest.slug}?table=1" target="_blank" class="btn-icon" title="Mijozlar menyusi">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
            <button class="btn-icon" title="Tahrirlash" onclick="openEditRestModal('${rest.id}')">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon delete" title="O'chirish" onclick="deleteRestaurant('${rest.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function autoGenerateSlug(name) {
  if (document.getElementById('restEditId').value) return; // Tahrirlanayotgan bo'lsa tegilmaydi
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  document.getElementById('restSlugInput').value = slug;
}

function openAddRestModal() {
  document.getElementById('restModalTitle').innerText = "Yangi Restoran Ochish";
  document.getElementById('restEditId').value = '';
  document.getElementById('addRestForm').reset();
  document.getElementById('restModal').style.display = 'flex';
}

function openEditRestModal(id) {
  const rest = restaurants.find(r => r.id === id);
  if (!rest) return;

  document.getElementById('restModalTitle').innerText = "Restoranni Tahrirlash";
  document.getElementById('restEditId').value = rest.id;
  document.getElementById('restNameInput').value = rest.name;
  document.getElementById('restSlugInput').value = rest.slug;
  document.getElementById('restPasswordInput').value = rest.password || '123';
  document.getElementById('restPhoneInput').value = rest.phone || '';
  document.getElementById('restTablesInput').value = rest.tablesCount || 15;
  document.getElementById('restAddressInput').value = rest.address || '';
  document.getElementById('restLogoInput').value = rest.logo || '';
  document.getElementById('restBannerInput').value = rest.banner || '';
  document.getElementById('restDescInput').value = rest.description || '';
  document.getElementById('restFeeInput').value = rest.serviceFeePercent || 0;

  document.getElementById('restModal').style.display = 'flex';
}

function closeAddRestModal() {
  document.getElementById('restModal').style.display = 'none';
}

async function saveRestaurant(e) {
  e.preventDefault();
  const editId = document.getElementById('restEditId').value;
  const payload = {
    name: document.getElementById('restNameInput').value,
    slug: document.getElementById('restSlugInput').value,
    password: document.getElementById('restPasswordInput').value,
    phone: document.getElementById('restPhoneInput').value,
    tablesCount: Number(document.getElementById('restTablesInput').value) || 10,
    address: document.getElementById('restAddressInput').value,
    logo: document.getElementById('restLogoInput').value || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300',
    banner: document.getElementById('restBannerInput').value || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200',
    description: document.getElementById('restDescInput').value,
    serviceFeePercent: Number(document.getElementById('restFeeInput').value) || 0
  };

  try {
    let url = '/api/super/restaurants';
    let method = 'POST';
    if (editId) {
      url = `/api/super/restaurants/${editId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeAddRestModal();
      loadRestaurants();
      loadStats();
      alert("Restoran muvaffaqiyatli saqlandi!");
    } else {
      alert("Xatolik: " + data.message);
    }
  } catch (err) {
    alert("Saqlashda xatolik: " + err.message);
  }
}

async function deleteRestaurant(id) {
  if (!confirm("Diqqat! Restoran va uning barcha taomlari, stollari va buyurtmalari butunlay o'chiriladi. Rozimisiz?")) return;
  try {
    const res = await fetch(`/api/super/restaurants/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadRestaurants();
      loadStats();
    }
  } catch (e) {
    alert("O'chirishda xatolik: " + e.message);
  }
}

init();
