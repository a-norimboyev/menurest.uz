const socket = io();
let restaurantId = localStorage.getItem('waiter_restaurantId');
let waiterToken = localStorage.getItem('waiter_token');
let waiterInfo = JSON.parse(localStorage.getItem('waiter_info') || '{}');

if (!waiterToken || !restaurantId) {
  // Waiter assumes they log in through the admin panel or separate login. 
  // For now, redirect to login if no token.
  window.location.href = '/login.html?role=waiter';
}

document.getElementById('waiterName').innerText = waiterInfo.name || 'Ofitsiant';

// Views
function switchView(viewId, el) {
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(v => v.classList.remove('active'));
  
  document.getElementById(`view-${viewId}`).classList.add('active');
  if (el) el.classList.add('active');
  
  loadData();
}

async function loadData() {
  try {
    // We will build a unified API for waiter to fetch their assignments, calls, and ready orders
    // For now, using mock fetch to show how it connects
    const res = await fetch(`/api/waiter/dashboard`, {
      headers: { 'Authorization': `Bearer ${waiterToken}` }
    });
    if (!res.ok) throw new Error("Avtorizatsiya xatosi");
    const data = await res.json();
    
    renderTables(data.tables);
    renderCalls(data.calls);
    renderReady(data.readyItems);
  } catch (err) {
    console.error(err);
  }
}

function renderTables(tables = []) {
  const container = document.getElementById('tablesContainer');
  if (tables.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-border-all"></i><p>Sizga biriktirilgan stollar yo'q</p></div>`;
    return;
  }
  container.innerHTML = tables.map(t => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Stol ${t.tableNumber}</div>
        <div class="badge ${t.status === 'OCCUPIED' ? 'warning' : 'success'}">${t.status}</div>
      </div>
      <div class="card-actions">
        <button class="btn btn-primary" onclick="openMenu(${t.tableNumber})">
          <i class="fa-solid fa-plus"></i> Buyurtma qo'shish
        </button>
      </div>
    </div>
  `).join('');
}

function renderCalls(calls = []) {
  const container = document.getElementById('callsContainer');
  if (calls.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bell"></i><p>Yangi chaqiruvlar yo'q</p></div>`;
    return;
  }
  container.innerHTML = calls.map(c => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Stol ${c.tableNumber}</div>
        <div class="badge new">Yangi</div>
      </div>
      <div class="card-body">
        ${c.note}
      </div>
      <div class="card-actions">
        <button class="btn btn-success" onclick="acknowledgeCall('${c.id}')">
          <i class="fa-solid fa-check"></i> Qabul qildim
        </button>
      </div>
    </div>
  `).join('');
}

function renderReady(items = []) {
  const container = document.getElementById('readyContainer');
  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-utensils"></i><p>Tayyor taomlar yo'q</p></div>`;
    return;
  }
  container.innerHTML = items.map(i => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Stol ${i.order.tableNumber}</div>
        <div class="badge warning">Tayyor</div>
      </div>
      <div class="card-body">
        <b>${i.quantity}x</b> ${i.name}
      </div>
      <div class="card-actions">
        <button class="btn btn-primary" onclick="markDelivered('${i.id}')">
          <i class="fa-solid fa-truck"></i> Yetkazildi
        </button>
      </div>
    </div>
  `).join('');
}

async function acknowledgeCall(id) {
  try {
    const res = await fetch(`/api/waiter/calls/${id}/acknowledge`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${waiterToken}` }
    });
    if (res.ok) loadData();
  } catch(e) { alert(e.message); }
}

async function markDelivered(id) {
  try {
    const res = await fetch(`/api/waiter/items/${id}/deliver`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${waiterToken}` }
    });
    if (res.ok) loadData();
  } catch(e) { alert(e.message); }
}

// Socket events
socket.emit('join:waiter', restaurantId);

socket.on('waiter:call', (data) => {
  // alert or beep
  loadData();
});

socket.on('kitchen:ready', (data) => {
  loadData();
});

// Init
// In a real app we'd fetch data here immediately. For now, show empty states.
renderTables([]);
renderCalls([]);
renderReady([]);
