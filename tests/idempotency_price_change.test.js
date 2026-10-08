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

async function runPriceChangeTest() {
  console.log('--- TESTING IDEMPOTENCY WHEN MENU PRICE CHANGES LATER ---');

  const rest = await prisma.restaurant.findFirst();
  const table = await prisma.table.findFirst({ where: { restaurantId: rest.id } });
  const visit = await prisma.visit.create({
    data: { restaurantId: rest.id, tableId: table.id, status: 'ACTIVE' }
  });

  const cat = await prisma.category.findFirst({ where: { restaurantId: rest.id } });
  const dish = await prisma.menuItem.create({
    data: {
      restaurantId: rest.id,
      categoryId: cat.id,
      nameUz: 'Sinov Taomi (Narx o\'zgarishi)',
      price: 40000
    }
  });

  const clientToken = jwt.sign(
    { visitId: visit.id, restaurantId: rest.id, tableId: table.id },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  const idempotencyKey = 'price_change_key_' + Date.now();

  // 1. Initial Order with price = 40,000
  const initialPayload = {
    tableNumber: table.tableNumber,
    items: [{ id: dish.id, name: dish.nameUz, price: 40000, quantity: 1 }],
    subtotal: 40000,
    serviceFee: 0,
    totalPrice: 40000,
    idempotencyKey
  };

  const res1 = await sendRequest(`/api/r/${rest.slug}/order`, 'POST', initialPayload, clientToken);
  console.log('1. Initial Order Created:', res1.status, res1.data.order?.id, 'Total:', res1.data.order?.totalPrice);

  // 2. Admin updates the price of the dish in the menu to 80,000 so'm!
  await prisma.menuItem.update({
    where: { id: dish.id },
    data: { price: 80000 }
  });
  console.log('2. Admin updated dish menu price from 40,000 to 80,000 so\'m in DB.');

  // 3. Client retries the original request with original price (40,000) and same key
  const resRetry = await sendRequest(`/api/r/${rest.slug}/order`, 'POST', initialPayload, clientToken);
  console.log('3. Client Retry Result:', resRetry.status, resRetry.data.order?.id, resRetry.data.message);

  const isExactOrder = resRetry.status === 200 && resRetry.data.order.id === res1.data.order.id && resRetry.data.order.totalPrice === 40000;
  if (isExactOrder) {
    console.log('[PASS] Subsequent menu price change did NOT interfere with idempotency retry of previous order!');
  } else {
    console.error('[FAIL] Retry failed after menu price change!');
    process.exit(1);
  }
}

runPriceChangeTest()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
