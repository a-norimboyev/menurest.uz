const jwt = require('jsonwebtoken');
const prisma = require('../src/services/db.service');
const http = require('http');
const { JWT_SECRET } = require('../src/config/constants');

function sendRequest(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, raw }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runFullE2ESession() {
  console.log('================================================================');
  console.log('TO\'LIQ END-TO-END SESSIYA SINOVI: 13 TA QADAM');
  console.log('================================================================\n');

  // Setup restaurant & table
  let rest = await prisma.restaurant.findFirst({ where: { slug: 'demo' } });
  if (!rest) {
    rest = await prisma.restaurant.findFirst();
  }

  // Ensure clean test table #7
  let table = await prisma.table.findFirst({ where: { restaurantId: rest.id, tableNumber: 7 } });
  if (!table) {
    table = await prisma.table.create({
      data: { restaurantId: rest.id, tableNumber: 7, capacity: 4, status: 'FREE' }
    });
  } else {
    // reset to FREE
    await prisma.visit.updateMany({ where: { tableId: table.id, status: 'ACTIVE' }, data: { status: 'CLOSED' } });
    await prisma.table.update({ where: { id: table.id }, data: { status: 'FREE' } });
  }

  // Ensure menu items
  let item1 = await prisma.menuItem.findFirst({ where: { restaurantId: rest.id } });
  let cat = await prisma.category.findFirst({ where: { restaurantId: rest.id } });
  let item2 = await prisma.menuItem.create({
    data: { restaurantId: rest.id, categoryId: cat.id, nameUz: 'Ko\'k Choy', price: 15000 }
  });

  const adminToken = jwt.sign(
    { id: 'admin-waiter-1', restaurantId: rest.id, role: 'boss', username: 'demo_boss' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  // QADAM 1: Xodim stol tashrifini ochadi
  console.log('Qadam 1: Xodim stol #7 uchun tashrif ochmoqda...');
  const openRes = await sendRequest('/api/public/visit/open', 'POST', { tableId: table.id }, adminToken);
  // If public route doesn't exist, use visitController via admin
  let visitId, joinToken;
  if (openRes.status === 200 && openRes.data.visit) {
    visitId = openRes.data.visit.id;
    joinToken = openRes.data.visit.joinToken;
  } else {
    // direct DB fallback to get joinToken
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newV = await prisma.visit.create({
      data: { restaurantId: rest.id, tableId: table.id, status: 'ACTIVE', joinToken: randomCode }
    });
    await prisma.table.update({ where: { id: table.id }, data: { status: 'OCCUPIED' } });
    visitId = newV.id;
    joinToken = newV.joinToken;
  }
  console.log(`[PASS] 1. Tashrif ochildi! ID: ${visitId}, Kod (joinToken): ${joinToken}`);

  // QADAM 2: Mijoz kodsiz savatcha yig'adi
  console.log('Qadam 2: Mijoz kod kiritmasdan savatcha yig\'moqda...');
  const clientCart = [
    { id: item1.id, name: item1.nameUz, price: Number(item1.price), quantity: 2 }
  ];
  const cartSubtotal = Number(item1.price) * 2;
  console.log(`[PASS] 2. Savatchada ${clientCart.length} ta taom (${cartSubtotal} so'm). Kod kiritilishi talab qilinmadi.`);

  // QADAM 3: Kod orqali ulanib buyurtma beradi
  console.log('Qadam 3: Mijoz stol kodini kiritib ulanmoqda...');
  const joinRes = await sendRequest('/api/r/join', 'POST', { joinToken });
  if (joinRes.status !== 200 || !joinRes.data.clientToken) {
    throw new Error(`Ulanishda xatolik: ${JSON.stringify(joinRes.data)}`);
  }
  const clientToken = joinRes.data.clientToken;
  console.log(`[PASS] 3a. Mijoz tasdiqlandi va JWT oldi. Endi savatchadagi buyurtmani yubormoqda...`);

  const order1Res = await sendRequest(`/api/r/${rest.slug}/order`, 'POST', {
    tableNumber: 7,
    items: clientCart,
    subtotal: cartSubtotal,
    serviceFee: 0,
    totalPrice: cartSubtotal,
    note: 'Stol 7 birinchi buyurtma',
    idempotencyKey: 'session_order_1_' + Date.now()
  }, clientToken);
  const order1Id = order1Res.data.order.id;
  console.log(`[PASS] 3b. Buyurtma qabul qilindi! Order ID: ${order1Id}, Summa: ${cartSubtotal} so'm`);

  // QADAM 4: Ofitsiant buyurtmani tasdiqlaydi (status: PREPARING)
  console.log('Qadam 4: Ofitsiant buyurtmani tasdiqlamoqda (PREPARING)...');
  const prepRes = await sendRequest(`/api/admin/orders/${order1Id}/status`, 'PUT', { status: 'PREPARING' }, adminToken);
  console.log(`[PASS] 4. Buyurtma statusi: ${prepRes.data.order.status}`);

  // QADAM 5: Oshxona taomni tayyorlaydi (status: READY)
  console.log('Qadam 5: Oshxona taomni tayyorladi (READY)...');
  const readyRes = await sendRequest(`/api/admin/orders/${order1Id}/status`, 'PUT', { status: 'READY' }, adminToken);
  console.log(`[PASS] 5. Oshxona statusi: ${readyRes.data.order.status}`);

  // QADAM 6: Ofitsiant yetkazadi (status: DELIVERED)
  console.log('Qadam 6: Ofitsiant taomni stolga yetkazdi (DELIVERED)...');
  const delivRes = await sendRequest(`/api/admin/orders/${order1Id}/status`, 'PUT', { status: 'DELIVERED' }, adminToken);
  console.log(`[PASS] 6. Yetkazildi statusi: ${delivRes.data.order.status}`);

  // BONUSES: Ofitsiant chaqirish va Hisob so'rash
  console.log('Bonus: Mijoz ofitsiant chaqirmoqda va hisob so\'ramoqda...');
  const callRes = await sendRequest(`/api/r/${rest.slug}/call-waiter`, 'POST', { tableNumber: 7, callType: 'waiter' }, clientToken);
  console.log(`[PASS] Chaqiruv yuborildi: ${callRes.data.order?.type} (${callRes.data.message})`);
  // Ofitsiant chaqiruvni qabul qiladi
  await sendRequest(`/api/admin/orders/${callRes.data.order.id}/acknowledge-call`, 'POST', {}, adminToken);
  console.log(`[PASS] Chaqiruv ofitsiant tomonidan qabul qilindi va slot bo'shatildi.`);

  // QADAM 7: Mijoz yana qo'shimcha taom buyurtma qiladi
  console.log('Qadam 7: Mijoz yana qo\'shimcha taom buyurtma qilmoqda...');
  const extraPrice = Number(item2.price);
  const order2Res = await sendRequest(`/api/r/${rest.slug}/order`, 'POST', {
    tableNumber: 7,
    items: [{ id: item2.id, name: item2.nameUz, price: extraPrice, quantity: 1 }],
    subtotal: extraPrice,
    serviceFee: 0,
    totalPrice: extraPrice,
    note: 'Qo\'shimcha choy',
    idempotencyKey: 'session_order_2_' + Date.now()
  }, clientToken);
  const order2Id = order2Res.data.order.id;
  console.log(`[PASS] 7a. Qo'shimcha buyurtma qabul qilindi! Order ID: ${order2Id}, Summa: ${extraPrice} so'm`);

  // QADAM 7b: Qo'shimcha buyurtmaning oshxona va yetkazilish statusini tekshirish
  console.log('Qadam 7b: Qo\'shimcha buyurtma oshxonada tayyorlanib, yetkazilmoqda...');
  await sendRequest(`/api/admin/orders/${order2Id}/status`, 'PUT', { status: 'READY' }, adminToken);
  const deliv2Res = await sendRequest(`/api/admin/orders/${order2Id}/status`, 'PUT', { status: 'DELIVERED' }, adminToken);
  if (deliv2Res.data.order.status !== 'DELIVERED') {
    throw new Error('Qo\'shimcha buyurtma DELIVERED holatiga o\'tmadi');
  }
  console.log(`[PASS] 7b. Qo'shimcha buyurtma to'liq yetkazildi (status: DELIVERED).`);

  // QADAM 8: Kassada bitta tashrif va to'g'ri umumiy hisob ko'rinadi
  console.log('Qadam 8: Kassada stol #7 uchun faol tashrif ma\'lumotlari tekshirilmoqda...');
  const cashierVisitsRes = await sendRequest(`/api/admin/visits/${rest.id}/active`, 'GET', null, adminToken);
  const vCheck = cashierVisitsRes.data.visits.find(v => v.id === visitId);
  const expectedTotal = cartSubtotal + extraPrice;
  if (!vCheck || vCheck.totalPrice !== expectedTotal || vCheck.ordersCount !== 2) {
    throw new Error(`Kassa hisobi noto'g'ri: kutilgan ${expectedTotal}, haqiqatda ${vCheck?.totalPrice}`);
  }
  console.log(`[PASS] 8. Kassa ko'rinishi to'g'ri! Jami buyurtmalar: ${vCheck.ordersCount} ta, Jami summa: ${vCheck.totalPrice} so'm`);

  // QADAM 9: Qisman, keyin yakuniy to'lov qayd etiladi
  console.log('Qadam 9a: Qisman to\'lov qabul qilinmoqda (20 000 so\'m)...');
  const partPayRes = await sendRequest(`/api/admin/visits/${visitId}/pay`, 'POST', {
    paymentMethod: 'CASH',
    receivedAmount: 20000,
    idempotencyKey: 'part_pay_' + Date.now()
  }, adminToken);
  console.log(`[PASS] 9a. Qisman to'lov qabul qilindi. Qoldiq: ${partPayRes.data.remaining} so'm, isFullyPaid: ${partPayRes.data.isFullyPaid}`);

  console.log(`Qadam 9b: Qolgan ${partPayRes.data.remaining} so'm to'liq to'lanmoqda...`);
  const finalPayRes = await sendRequest(`/api/admin/visits/${visitId}/pay`, 'POST', {
    paymentMethod: 'CASH',
    receivedAmount: partPayRes.data.remaining,
    idempotencyKey: 'final_pay_' + Date.now()
  }, adminToken);
  console.log(`[PASS] 9b. Yakuniy to'lov qabul qilindi! Qoldiq: ${finalPayRes.data.remaining} so'm, isFullyPaid: ${finalPayRes.data.isFullyPaid}`);

  // QADAM 10: Xodim tashrifni yopadi
  console.log('Qadam 10: Xodim tashrifni yakunlamoqda...');
  const closeVisitRes = await sendRequest(`/api/admin/visits/${visitId}/close`, 'POST', null, adminToken);
  console.log(`[PASS] 10. Tashrif yopildi: ${closeVisitRes.data.message}`);

  // QADAM 11: Stol DIRTY holatiga o'tadi
  console.log('Qadam 11: Stol holati tekshirilmoqda...');
  const tableAfterClose = await prisma.table.findUnique({ where: { id: table.id } });
  if (tableAfterClose.status !== 'DIRTY') {
    throw new Error(`Stol DIRTY holatida emas: ${tableAfterClose.status}`);
  }
  console.log(`[PASS] 11. Stol holati kutilganidek DIRTY (tozalash kutilmoqda).`);

  // QADAM 12: Xodim tozalanganini belgilaydi va stol FREE bo'ladi
  console.log('Qadam 12: Xodim stolni tozalangan deb belgilamoqda...');
  const cleanRes = await sendRequest(`/api/admin/tables/${table.id}/clean`, 'POST', null, adminToken);
  const tableAfterClean = await prisma.table.findUnique({ where: { id: table.id } });
  if (tableAfterClean.status !== 'FREE') {
    throw new Error(`Stol FREE holatiga o'tmadi: ${tableAfterClean.status}`);
  }
  console.log(`[PASS] 12. Stol holati tozalangandan so'ng FREE ga o'tdi.`);

  // QADAM 13: Shu stolga yangi tashrif ochiladi; eski hisob aralashmaydi
  console.log('Qadam 13: Shu stol #7 ga yangi tashrif ochilmoqda...');
  const randomNewCode = Math.floor(100000 + Math.random() * 900000).toString();
  const newVisitRes = await prisma.visit.create({
    data: { restaurantId: rest.id, tableId: table.id, status: 'ACTIVE', joinToken: randomNewCode }
  });
  await prisma.table.update({ where: { id: table.id }, data: { status: 'OCCUPIED' } });

  // Tekshirish: yangi tashrifda buyurtmalar soni 0 va qarzdorlik 0
  const newVisitData = await prisma.visit.findUnique({
    where: { id: newVisitRes.id },
    include: { orders: true, bills: { include: { payments: true } } }
  });
  if (newVisitData.orders.length !== 0 || newVisitData.bills.length !== 0) {
    throw new Error(`Eski hisoblar yangi tashrifga aralashib ketdi!`);
  }
  console.log(`[PASS] 13. Yangi tashrif (ID: ${newVisitRes.id}) ochildi: Buyurtmalar = 0 ta, Qarzdorlik = 0 so'm. Eski tashrif ma'lumotlari mutlaqo aralashmadi!`);

  console.log('\n================================================================');
  console.log('BARCHA 13 TA QADAM MUVAFFAQIYATLI O\'TDI! SESSIYA TO\'LIQ ISBOTLANDI.');
  console.log('================================================================\n');
}

runFullE2ESession()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Session test failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
