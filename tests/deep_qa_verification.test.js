const jwt = require('jsonwebtoken');
const prisma = require('../src/services/db.service');
const http = require('http');
const { JWT_SECRET } = require('../src/config/constants');

// Helper to make local HTTP requests
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
        try {
          const json = JSON.parse(raw);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAllTests() {
  console.log('====================================================');
  console.log('MENUREST.UZ DEEP QA TEST SUITE STARTING');
  console.log('====================================================\n');

  // 1. Setup clean test restaurant and table
  let restaurant = await prisma.restaurant.findFirst({ where: { slug: 'test-qa-rest' } });
  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: 'Test QA Restaurant',
        slug: 'test-qa-rest',
        currency: "so'm",
        serviceFeePercent: 0
      }
    });
  }

  // Create menu items for exact item tests
  let itemOsh = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id, nameUz: 'To\'y Oshi' } });
  if (!itemOsh) {
    let cat = await prisma.category.findFirst({ where: { restaurantId: restaurant.id } });
    if (!cat) {
      cat = await prisma.category.create({
        data: { restaurantId: restaurant.id, nameUz: 'Asosiy Taomlar' }
      });
    }
    itemOsh = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: cat.id,
        nameUz: 'To\'y Oshi',
        price: 50000
      }
    });
  }

  let itemShashlik = await prisma.menuItem.findFirst({ where: { restaurantId: restaurant.id, nameUz: 'Qo\'y Go\'shti Shashlik' } });
  if (!itemShashlik) {
    let cat = await prisma.category.findFirst({ where: { restaurantId: restaurant.id } });
    itemShashlik = await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        categoryId: cat.id,
        nameUz: 'Qo\'y Go\'shti Shashlik',
        price: 50000
      }
    });
  }

  let table = await prisma.table.findFirst({ where: { restaurantId: restaurant.id, tableNumber: 99 } });
  if (!table) {
    table = await prisma.table.create({
      data: { restaurantId: restaurant.id, tableNumber: 99, capacity: 4, status: 'FREE' }
    });
  }

  // Create active visit
  let visit = await prisma.visit.create({
    data: {
      restaurantId: restaurant.id,
      tableId: table.id,
      status: 'ACTIVE'
    }
  });

  const clientToken = jwt.sign(
    { visitId: visit.id, restaurantId: restaurant.id, tableId: table.id },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  const adminToken = jwt.sign(
    { id: 'test-admin-cashier', restaurantId: restaurant.id, role: 'cashier', username: 'testcashier' },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: IDEMPOTENCY WITH DEEP NORMALIZED CONTENT CHECK
  // ----------------------------------------------------
  console.log('\n--- 1. IDEMPOTENCY CONTENT & CONFLICT TESTS ---');
  const key1 = 'test_key_' + Date.now();

  // Step 1a: Create first order
  const order1Payload = {
    tableNumber: 99,
    items: [{ id: itemOsh.id, name: 'To\'y Oshi', price: 50000, quantity: 1 }],
    subtotal: 50000,
    serviceFee: 0,
    totalPrice: 50000,
    note: 'Piyozsiz',
    idempotencyKey: key1
  };
  const res1a = await sendRequest(`/api/r/${restaurant.slug}/order`, 'POST', order1Payload, clientToken);
  assert(res1a.status === 200 && res1a.data.success, '1a. Order 1 created successfully with Key1');

  // Step 1b: Replay with identical content and key1 -> should return 200 and exact same order ID
  const res1b = await sendRequest(`/api/r/${restaurant.slug}/order`, 'POST', order1Payload, clientToken);
  assert(
    res1b.status === 200 &&
    res1b.data.order &&
    res1b.data.order.id === res1a.data.order.id &&
    res1b.data.message.includes("Takroriy so'rov"),
    '1b. Replay identical content with same key returns original order'
  );

  // Step 1c: Send same key1, same subtotal (50,000), same items count (1), but DIFFERENT item (Shashlik)!
  const conflictPayload = {
    tableNumber: 99,
    items: [{ id: itemShashlik.id, name: 'Qo\'y Go\'shti Shashlik', price: 50000, quantity: 1 }],
    subtotal: 50000, // exact same subtotal!
    serviceFee: 0,
    totalPrice: 50000,
    note: 'Piyozsiz',
    idempotencyKey: key1 // exact same key!
  };
  const res1c = await sendRequest(`/api/r/${restaurant.slug}/order`, 'POST', conflictPayload, clientToken);
  assert(
    res1c.status === 409 &&
    res1c.data.success === false &&
    res1c.data.message.includes('Konflikt'),
    '1c. Same key + same subtotal + DIFFERENT dish returns 409 Conflict'
  );

  // Step 1d: Parallel Race Idempotency Test: 2 concurrent requests with same key
  const parallelKey = 'parallel_key_' + Date.now();
  const parPayloadA = {
    tableNumber: 99,
    items: [{ id: itemOsh.id, name: 'To\'y Oshi', price: 50000, quantity: 1 }],
    subtotal: 50000,
    serviceFee: 0,
    totalPrice: 50000,
    note: 'Parallel A',
    idempotencyKey: parallelKey
  };
  const parPayloadB = {
    tableNumber: 99,
    items: [{ id: itemShashlik.id, name: 'Qo\'y Go\'shti Shashlik', price: 50000, quantity: 1 }],
    subtotal: 50000,
    serviceFee: 0,
    totalPrice: 50000,
    note: 'Parallel B',
    idempotencyKey: parallelKey
  };

  const [parResA, parResB] = await Promise.all([
    sendRequest(`/api/r/${restaurant.slug}/order`, 'POST', parPayloadA, clientToken),
    sendRequest(`/api/r/${restaurant.slug}/order`, 'POST', parPayloadB, clientToken)
  ]);

  const hasOne200 = (parResA.status === 200 && parResB.status === 409) || (parResA.status === 409 && parResB.status === 200);
  assert(hasOne200, '1d. Parallel conflicting orders with same key: exactly 1 succeeds, 1 returns 409 Conflict');

  // Verify DB only has 1 order for parallelKey
  const dbOrders = await prisma.order.count({ where: { idempotencyKey: parallelKey } });
  assert(dbOrders === 1, '1e. Database holds exactly 1 order for parallelKey');


  // ----------------------------------------------------
  // TEST 2: TWO CASHIERS PAYING CONCURRENTLY WITH DIFFERENT KEYS
  // ----------------------------------------------------
  console.log('\n--- 2. CONCURRENT CASHIER PAYMENTS (DIFFERENT KEYS) ---');
  // Create clean visit for payment test with 100,000 balance
  const payVisit = await prisma.visit.create({
    data: {
      restaurantId: restaurant.id,
      tableId: table.id,
      status: 'ACTIVE'
    }
  });

  await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      visitId: payVisit.id,
      orderNumber: 201,
      status: 'NEW',
      type: 'ORDER',
      subtotal: 100000,
      totalAmount: 100000
    }
  });

  const payKeyCashier1 = 'pay_cashier1_' + Date.now();
  const payKeyCashier2 = 'pay_cashier2_' + Date.now();

  // Send two payments of 100,000 simultaneously for a 100,000 balance using adminToken
  const [payRes1, payRes2] = await Promise.all([
    sendRequest(`/api/admin/visits/${payVisit.id}/pay`, 'POST', {
      paymentMethod: 'CASH',
      discountPercent: 0,
      receivedAmount: 100000,
      idempotencyKey: payKeyCashier1
    }, adminToken),
    sendRequest(`/api/admin/visits/${payVisit.id}/pay`, 'POST', {
      paymentMethod: 'CASH',
      discountPercent: 0,
      receivedAmount: 100000,
      idempotencyKey: payKeyCashier2
    }, adminToken)
  ]);

  const onePaid = (payRes1.status === 200 && payRes2.status === 409) || (payRes1.status === 409 && payRes2.status === 200);
  assert(onePaid, '2a. Parallel payments of full balance: one succeeds (200), one rejects with 409 Conflict');

  const conflictRes = payRes1.status === 409 ? payRes1 : payRes2;
  assert(conflictRes.data && conflictRes.data.remaining === 0, '2b. Rejected cashier receives updated remaining = 0 so\'m');

  // Verify total payments in DB
  const paymentsInDb = await prisma.payment.findMany({
    where: { bill: { visitId: payVisit.id } }
  });
  const totalPaidSum = paymentsInDb.reduce((sum, p) => sum + Number(p.amount), 0);
  assert(paymentsInDb.length === 1 && totalPaidSum === 100000, '2c. Database contains exactly 1 payment totaling 100,000 so\'m (no double payment!)');


  // ----------------------------------------------------
  // TEST 3: ATOMIC OPEN WAITER CALL (CONCURRENT RACE)
  // ----------------------------------------------------
  console.log('\n--- 3. ATOMIC OPEN WAITER CALL TESTS ---');
  const callVisit = await prisma.visit.create({
    data: {
      restaurantId: restaurant.id,
      tableId: table.id,
      status: 'ACTIVE'
    }
  });
  const callToken = jwt.sign(
    { visitId: callVisit.id, restaurantId: restaurant.id, tableId: table.id },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  // Send 2 concurrent callWaiter requests at the exact same moment
  const [callRes1, callRes2] = await Promise.all([
    sendRequest(`/api/r/${restaurant.slug}/call-waiter`, 'POST', { tableNumber: 99, callType: 'waiter' }, callToken),
    sendRequest(`/api/r/${restaurant.slug}/call-waiter`, 'POST', { tableNumber: 99, callType: 'waiter' }, callToken)
  ]);

  assert(callRes1.status === 200 && callRes2.status === 200, '3a. Both concurrent call requests respond with 200');

  // Verify exactly 1 active call exists in DB
  const activeCallsInDb = await prisma.order.findMany({
    where: {
      visitId: callVisit.id,
      type: 'CALL_WAITER',
      status: 'NEW'
    }
  });
  assert(activeCallsInDb.length === 1, '3b. Exactly 1 active CALL_WAITER order exists in DB despite concurrent requests');

  // Verify BILL_REQUEST does not block CALL_WAITER
  const billCallRes = await sendRequest(`/api/r/${restaurant.slug}/call-waiter`, 'POST', { tableNumber: 99, callType: 'bill' }, callToken);
  assert(billCallRes.status === 200, '3c. BILL_REQUEST can be placed alongside CALL_WAITER without interference');


  // ----------------------------------------------------
  // TEST 4: VISIT CLOSING FLOW & EXTRA ORDERS ON PREPAID VISIT
  // ----------------------------------------------------
  console.log('\n--- 4. VISIT CLOSING & PREPAID EXTRA ORDERS FLOW ---');
  const prepaidVisit = await prisma.visit.create({
    data: {
      restaurantId: restaurant.id,
      tableId: table.id,
      status: 'ACTIVE'
    }
  });
  const prepaidToken = jwt.sign(
    { visitId: prepaidVisit.id, restaurantId: restaurant.id, tableId: table.id },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  // Initial order: 100,000 so'm
  await sendRequest(`/api/r/${restaurant.slug}/order`, 'POST', {
    tableNumber: 99,
    items: [{ id: itemOsh.id, name: 'To\'y Oshi', price: 100000, quantity: 1 }],
    subtotal: 100000,
    serviceFee: 0,
    totalPrice: 100000
  }, prepaidToken);

  // Pre-pay full 100,000 using adminToken
  const payPreRes = await sendRequest(`/api/admin/visits/${prepaidVisit.id}/pay`, 'POST', {
    paymentMethod: 'CASH',
    receivedAmount: 100000
  }, adminToken);
  assert(payPreRes.status === 200 && payPreRes.data.isFullyPaid, '4a. Initial 100,000 order prepaid');

  // Check visit is STILL ACTIVE (customer is still at table!)
  const checkActiveVisit = await prisma.visit.findUnique({ where: { id: prepaidVisit.id } });
  assert(checkActiveVisit.status === 'ACTIVE', '4b. Prepaid visit remains ACTIVE while customer is dining');

  // Customer adds extra order: 30,000 so'm
  await sendRequest(`/api/r/${restaurant.slug}/order`, 'POST', {
    tableNumber: 99,
    items: [{ id: itemOsh.id, name: 'To\'y Oshi', price: 30000, quantity: 1 }],
    subtotal: 30000,
    serviceFee: 0,
    totalPrice: 30000
  }, prepaidToken);

  // Check active visits API with adminToken
  const activeVisitsRes = await sendRequest(`/api/admin/visits/${restaurant.id}/active`, 'GET', null, adminToken);
  const vData = activeVisitsRes.data && activeVisitsRes.data.visits && activeVisitsRes.data.visits.find(v => v.id === prepaidVisit.id);
  assert(
    vData &&
    vData.totalPrice === 130000 &&
    vData.paidAmount === 100000 &&
    vData.remaining === 30000 &&
    vData.isPaid === false,
    '4c. Extra order updates debt: Gross=130k, Paid=100k, Remaining=30k, isPaid=false'
  );

  // Attempt to close visit while 30k unpaid -> MUST FAIL (400)
  const prematureCloseRes = await sendRequest(`/api/admin/visits/${prepaidVisit.id}/close`, 'POST', null, adminToken);
  assert(
    prematureCloseRes.status === 400 &&
    prematureCloseRes.data.message.includes('to\'lanmagan qoldiq mavjud'),
    '4d. Closing visit with unpaid remaining debt rejected with 400'
  );

  // Pay remaining 30k (giving 50,000 cash -> 20,000 change)
  const payRemainingRes = await sendRequest(`/api/admin/visits/${prepaidVisit.id}/pay`, 'POST', {
    paymentMethod: 'CASH',
    receivedAmount: 50000 // Gave 50k for 30k debt
  }, adminToken);
  assert(
    payRemainingRes.status === 200 &&
    payRemainingRes.data.paidAmount === 30000 &&
    payRemainingRes.data.changeAmount === 20000,
    '4e. Cashier pays 30k debt with 50k cash: actualPayment=30k, changeAmount=20k'
  );

  // Now staff explicitly closes visit
  const closeRes = await sendRequest(`/api/admin/visits/${prepaidVisit.id}/close`, 'POST', null, adminToken);
  assert(closeRes.status === 200 && closeRes.data.success, '4f. Staff explicitly closes fully paid visit');

  const closedVisitInDb = await prisma.visit.findUnique({ where: { id: prepaidVisit.id } });
  const tableInDb = await prisma.table.findUnique({ where: { id: table.id } });
  assert(closedVisitInDb.status === 'CLOSED' && tableInDb.status === 'DIRTY', '4g. Visit is CLOSED and Table status is DIRTY');


  // ----------------------------------------------------
  // TEST 5: JWT EXPIRED / CLOSED VISIT REJECTION
  // ----------------------------------------------------
  console.log('\n--- 5. JWT VALIDATION AGAINST CLOSED VISITS ---');
  // Attempt to place order with prepaidToken (its visit is now CLOSED!)
  const orderOnClosedRes = await sendRequest(`/api/r/${restaurant.slug}/order`, 'POST', {
    tableNumber: 99,
    items: [{ id: itemOsh.id, name: 'To\'y Oshi', price: 50000, quantity: 1 }],
    subtotal: 50000,
    serviceFee: 0,
    totalPrice: 50000
  }, prepaidToken);

  assert(
    orderOnClosedRes.status === 403 &&
    orderOnClosedRes.data.message.includes('yopilgan'),
    '5a. Request with signed JWT for a CLOSED visit immediately rejected with 403'
  );

  // Attempt with invalid token
  const fakeTokenRes = await sendRequest(`/api/r/${restaurant.slug}/order`, 'POST', {
    tableNumber: 99,
    items: [{ id: itemOsh.id, name: 'To\'y Oshi', price: 50000, quantity: 1 }],
    subtotal: 50000,
    serviceFee: 0,
    totalPrice: 50000
  }, 'invalid.token.here');

  assert(fakeTokenRes.status === 403, '5b. Request with forged/tampered JWT rejected with 403');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(async (err) => {
  console.error('Test execution crashed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
