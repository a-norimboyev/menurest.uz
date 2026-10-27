import assert from 'node:assert';
import cp from 'node:child_process';
import fs from 'node:fs';
import {
  uzsToTiyin,
  tiyinToUzs,
  calculatePercentTiyin,
  computeBillSummary,
  formatMoneyUzs,
  deriveOrderStatus,
  OrderItemStatus,
  OrderStatus,
  VisitStatus,
  ShiftStatus,
  Role,
  StationType,
  TableStatus,
} from '@menurest/shared';
import { checkDatabaseConnection, prisma } from './db.js';
import app, { server } from './index.js';
import { recordOutboxEvent, outboxService } from './modules/realtime/outbox.service.js';
import { realtimeService } from './modules/realtime/realtime.service.js';
import { getTashkentDayBounds } from './modules/reports/reports.service.js';
import { runStage14QATests } from './qa-stage14.js';

async function runTests() {
  console.log('--- 1. PUL VA MOLIYA HISOBLARI TESTI ---');
  const tiyin = uzsToTiyin(45000);
  assert.strictEqual(tiyin, 4500000n, 'uzsToTiyin(45000) 4500000n bo\'lishi kerak');
  assert.strictEqual(tiyinToUzs(tiyin), 45000, 'tiyinToUzs(4500000n) 45000 bo\'lishi kerak');
  assert.strictEqual(formatMoneyUzs(tiyin), '45 000 UZS', 'formatMoneyUzs noto\'g\'ri formatladi');

  const subtotal = 10000000n;
  const service = calculatePercentTiyin(subtotal, 1000);
  assert.strictEqual(service, 1000000n, '10% xizmat haqi 1 000 000 tiyin bo\'lishi kerak');

  const summary = computeBillSummary(10000000n, 1000, 500, 0n);
  assert.strictEqual(summary.subtotalTiyin, 10000000n);
  assert.strictEqual(summary.serviceChargeTiyin, 1000000n);
  assert.strictEqual(summary.discountTiyin, 500000n);
  assert.strictEqual(summary.totalTiyin, 10500000n);
  assert.strictEqual(summary.balanceTiyin, 10500000n);
  console.log('✓ Pul hisob-kitoblari muvaffaqiyatli o\'tdi (PASSED)');

  console.log('\n--- 2. BUYURTMA VA TAOM HOLATLARI DERIVATION TESTI ---');
  const s1 = deriveOrderStatus([
    { status: OrderItemStatus.PREPARING },
    { status: OrderItemStatus.READY },
  ]);
  assert.strictEqual(s1, OrderStatus.PARTIALLY_READY);

  const s2 = deriveOrderStatus([
    { status: OrderItemStatus.SERVED },
    { status: OrderItemStatus.PREPARING },
  ]);
  assert.strictEqual(s2, OrderStatus.PARTIALLY_SERVED);

  const s3 = deriveOrderStatus([
    { status: OrderItemStatus.CANCELLED },
    { status: OrderItemStatus.READY },
  ]);
  assert.strictEqual(s3, OrderStatus.READY);

  const s4 = deriveOrderStatus([
    { status: OrderItemStatus.SERVED },
    { status: OrderItemStatus.SERVED },
  ]);
  assert.strictEqual(s4, OrderStatus.SERVED);

  const s5 = deriveOrderStatus([
    { status: OrderItemStatus.CANCELLED },
    { status: OrderItemStatus.CANCELLED },
  ]);
  assert.strictEqual(s5, OrderStatus.CANCELLED);
  console.log('✓ Buyurtma holatlari algoritmi muvaffaqiyatli o\'tdi (PASSED)');

  console.log('\n--- 3. BAZA BILAN ALOQA (DB READINESS) TESTI ---');
  const dbConnected = await checkDatabaseConnection();
  assert.strictEqual(dbConnected, true);
  console.log('✓ PostgreSQL bazasi bilan aloqa muvaffaqiyatli tekshirildi (PASSED)');

  console.log('\n--- 4. POSTGRESQL PARTIAL UNIQUE INDEX INVARIANTLARI TESTI ---');
  const restRayhon = await prisma.restaurant.findFirst({ where: { slug: 'rayhon-chilonzor' } });
  const restGijduvon = await prisma.restaurant.findFirst({ where: { slug: 'gijduvon-shashlik' } });
  const table = await prisma.table.findFirst({ where: { restaurantId: restRayhon!.id, number: 1 } });
  const cashierUser = await prisma.user.findFirst({ where: { phone: '+998904444444' } });
  const managerUser = await prisma.user.findFirst({ where: { phone: '+998903333333' } });
  const waiterUser = await prisma.user.findFirst({ where: { phone: '+998905555555' } });
  assert.ok(restRayhon && restGijduvon && table && cashierUser && managerUser && waiterUser);

  await prisma.restaurant.update({
    where: { id: restRayhon.id },
    data: {
      serviceChargeBps: 1000,
      name: 'Rayhon Milliy Taomlar',
      subscriptionPlan: 'BUSINESS',
      allowedRoles: ['BOSS', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER', 'GUEST'],
    },
  });
  await prisma.refund.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.payment.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.cashMovement.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.visit.deleteMany({ where: { tableId: table.id } });
  await prisma.shift.deleteMany({ where: { restaurantId: restRayhon.id, userId: cashierUser.id } });

  await prisma.visit.create({
    data: {
      restaurantId: restRayhon.id,
      tableId: table.id,
      pinCode: '1234',
      status: VisitStatus.ACTIVE,
    },
  });

  let duplicateVisitRejected = false;
  try {
    await prisma.visit.create({
      data: {
        restaurantId: restRayhon.id,
        tableId: table.id,
        pinCode: '5678',
        status: VisitStatus.ACTIVE,
      },
    });
  } catch {
    duplicateVisitRejected = true;
    console.log('✓ Kutilganidek: PostgreSQL 2-faol tashrifni rad etdi (idx_unique_active_visit_per_table)');
  }
  assert.strictEqual(duplicateVisitRejected, true);

  await prisma.shift.create({
    data: {
      restaurantId: restRayhon.id,
      userId: cashierUser.id,
      status: ShiftStatus.OPEN,
    },
  });

  let duplicateShiftRejected = false;
  try {
    await prisma.shift.create({
      data: {
        restaurantId: restRayhon.id,
        userId: cashierUser.id,
        status: ShiftStatus.OPEN,
      },
    });
  } catch {
    duplicateShiftRejected = true;
    console.log('✓ Kutilganidek: PostgreSQL 2-ochiq smenani rad etdi (idx_unique_active_shift_per_user)');
  }
  assert.strictEqual(duplicateShiftRejected, true);

  await prisma.visit.deleteMany({ where: { tableId: table.id } });
  await prisma.shift.deleteMany({ where: { restaurantId: restRayhon.id, userId: cashierUser.id } });

  console.log('\n--- 5. BOSQICH 3: LOGIN, ROLLAR VA RBAC HUQUQLARI TESTI ---');
  // Helper API so'rov yuborish
  const baseUrl = `http://localhost:${process.env.PORT || 4000}`;

  async function apiPost(path: string, body: any, token?: string, csrfToken?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { status: res.status, json, headers: res.headers };
  }

  async function apiGet(path: string, token?: string, extraHeaders?: Record<string, string>) {
    const headers: Record<string, string> = { ...(extraHeaders || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const json = await res.json();
    return { status: res.status, json };
  }

  async function apiPatch(path: string, body: any, token?: string, csrfToken?: string, extraHeaders?: Record<string, string>) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(extraHeaders || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { status: res.status, json, headers: res.headers };
  }

  async function apiDelete(path: string, token?: string, csrfToken?: string) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'DELETE',
      headers,
    });
    const json = await res.json();
    return { status: res.status, json };
  }

  async function apiPut(path: string, body: any, token?: string, csrfToken?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { status: res.status, json, headers: res.headers };
  }

  async function apiGetText(path: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const text = await res.text();
    return { status: res.status, text, headers: res.headers };
  }

  // 5.1 Manager Login
  const managerLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998903333333',
    password: 'Demo12345!',
  });
  assert.strictEqual(managerLogin.status, 200, 'Manager logini 200 bo\'lishi kerak');
  assert.ok(managerLogin.json.data.token, 'Token qaytarilishi kerak');
  const managerToken = managerLogin.json.data.token;
  assert.ok(managerLogin.json.data.permissions.includes('reports.view'));
  assert.ok(managerLogin.json.data.permissions.includes('staff.manage'));
  console.log('✓ Manager logini muvaffaqiyatli va ruxsatlar tasdiqlandi');

  // Manager hisobotni ko'ra oladi
  const managerReport = await apiGet(`/api/v1/restaurants/${restRayhon.id}/reports/summary`, managerToken);
  assert.strictEqual(managerReport.status, 200, 'Manager hisobotni ko\'ra olishi kerak');
  console.log('✓ Manager o\'z restorani hisobotini muvaffaqiyatli oldi (200 OK)');

  // 5.2 Waiter Login
  const waiterLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998905555555',
    password: 'Demo12345!',
  });
  assert.strictEqual(waiterLogin.status, 200);
  const waiterToken = waiterLogin.json.data.token;
  assert.ok(waiterLogin.json.data.permissions.includes('items.serve'));
  assert.strictEqual(waiterLogin.json.data.permissions.includes('reports.view'), false);
  assert.strictEqual(waiterLogin.json.data.permissions.includes('menu.manage'), false);
  console.log('✓ Waiter logini muvaffaqiyatli va cheklangan ruxsatlar tasdiqlandi');

  // Waiter hisobotga kirishga uringanda -> 403 FORBIDDEN
  const waiterReport = await apiGet(`/api/v1/restaurants/${restRayhon.id}/reports/summary`, waiterToken);
  assert.strictEqual(waiterReport.status, 403, 'Waiter reports.view yo\'qligi sababli 403 olishi shart');
  console.log('✓ Kutilganidek: Waiterga hisobot ko\'rish taqiqlandi (403 FORBIDDEN)');

  // Waiter taom qo'shishga uringanda -> 403 FORBIDDEN
  const waiterMenuCreate = await apiPost(`/api/v1/restaurants/${restRayhon.id}/menu/items`, {}, waiterToken);
  assert.strictEqual(waiterMenuCreate.status, 403, 'Waiter menu.manage yo\'qligi sababli 403 olishi shart');
  console.log('✓ Kutilganidek: Waiterga menyu o\'zgartirish taqiqlandi (403 FORBIDDEN)');

  // 5.3 Cashier Login
  const cashierLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998904444444',
    password: 'Demo12345!',
  });
  assert.strictEqual(cashierLogin.status, 200);
  const cashierToken = cashierLogin.json.data.token;
  assert.ok(cashierLogin.json.data.permissions.includes('payments.record'));
  assert.strictEqual(cashierLogin.json.data.permissions.includes('menu.manage'), false);

  // Cashier to'lov qabul qila oladi
  const cashierPay = await apiPost(`/api/v1/restaurants/${restRayhon.id}/payments`, {}, cashierToken);
  assert.strictEqual(cashierPay.status, 200, 'Cashier to\'lov qabul qila olishi kerak');
  console.log('✓ Cashier to\'lovni qayd eta oldi (200 OK)');

  // Cashier menyu qo'sha olmaydi
  const cashierMenu = await apiPost(`/api/v1/restaurants/${restRayhon.id}/menu/items`, {}, cashierToken);
  assert.strictEqual(cashierMenu.status, 403, 'Cashier menu.manage bo\'lmagani uchun 403 olishi shart');
  console.log('✓ Kutilganidek: Cashierga menyu o\'zgartirish taqiqlandi (403 FORBIDDEN)');

  console.log('\n--- 6. BOSQICH 3: ESKALATSIYADAN HIMOYALANISH (PRIVILEGE ESCALATION) TESTI ---');
  // Manager Waiterga BOSS rolini berishga urinsa -> 403 PRIVILEGE_ESCALATION_FORBIDDEN
  const escalateRole = await apiPost(
    `/api/v1/staff/${waiterUser.id}/assign-role`,
    { role: Role.BOSS },
    managerToken
  );
  assert.strictEqual(escalateRole.status, 403, 'Manager Boss rolini bera olmasligi shart');
  assert.strictEqual(escalateRole.json.error.code, 'PRIVILEGE_ESCALATION_FORBIDDEN');
  console.log('✓ Kutilganidek: Managerni Boss rolini berishga urinishi rad etildi (403 PRIVILEGE_ESCALATION_FORBIDDEN)');

  // Manager o'z-o'ziga rol oshirishga urinsa -> 403 SELF_ESCALATION_FORBIDDEN
  const selfEscalate = await apiPost(
    `/api/v1/staff/${managerUser.id}/assign-role`,
    { role: Role.BOSS },
    managerToken
  );
  assert.strictEqual(selfEscalate.status, 403, 'O\'ziga o\'zi rol oshirish taqiqlanishi shart');
  assert.strictEqual(selfEscalate.json.error.code, 'SELF_ESCALATION_FORBIDDEN');
  console.log('✓ Kutilganidek: O\'z-o\'ziga vakolat oshirish rad etildi (403 SELF_ESCALATION_FORBIDDEN)');

  console.log('\n--- 7. BOSQICH 3: CROSS-TENANT IZOLYATSIYA HUJUMI TESTI ---');
  // Rayhon menejeri G'ijduvon hisobotini so'rasa -> 404 NOT_FOUND
  const crossTenantReport = await apiGet(
    `/api/v1/restaurants/${restGijduvon.id}/reports/summary`,
    managerToken
  );
  assert.strictEqual(crossTenantReport.status, 404, 'Boshqa tenant so\'rovida 404 qaytishi shart');
  console.log('✓ Kutilganidek: Boshqa restoranning hisobotiga kirish rad etildi (404 NOT_FOUND)');

  // Rayhon menejeri G'ijduvonga taom qo'shishga urinsa -> 404 NOT_FOUND
  const crossTenantMenu = await apiPost(
    `/api/v1/restaurants/${restGijduvon.id}/menu/items`,
    {},
    managerToken
  );
  assert.strictEqual(crossTenantMenu.status, 404, 'Boshqa tenantga ma\'lumot yozish rad etilishi shart');
  console.log('✓ Kutilganidek: Boshqa restoranga ma\'lumot yozish rad etildi (404 NOT_FOUND)');

  console.log('\n--- 8. BOSQICH 3: SESSIYANI DARHOL BEKOR QILISH (SESSION REVOCATION) TESTI ---');
  // Waiter hozir amaldagi tokenga ega
  const preCheck = await apiGet('/api/v1/auth/me', waiterToken);
  assert.strictEqual(preCheck.status, 200, 'Faolsizlantirishdan oldin 200 bo\'lishi kerak');

  // Manager Waiterni faolsizlantiradi (deactivate)
  const deactivate = await apiPost(
    `/api/v1/staff/${waiterUser.id}/deactivate`,
    {},
    managerToken
  );
  assert.strictEqual(deactivate.status, 200, 'Xodim faolsizlantirildi');

  // Waiter eski tokenni qayta ishlatishga urinsa -> 401 UNAUTHORIZED (tokenVersion / isActive mos kelmaydi!)
  const postCheck = await apiGet('/api/v1/auth/me', waiterToken);
  assert.strictEqual(postCheck.status, 401, 'Faolsizlantirilgan xodimning sessiyasi darhol bekor bo\'lishi shart');
  console.log('✓ Kutilganidek: Faolsizlantirilgan xodimning mavjud faol sessiyasi darhol bekor qilindi (401 UNAUTHORIZED)');

  // Qayta tiklash
  await prisma.restaurantMembership.updateMany({
    where: { userId: waiterUser.id, restaurantId: restRayhon.id },
    data: { isActive: true },
  });

  console.log('\n--- 9. BOSQICH 3: AUDIT LOG VA MAXFIYLIK TESTI ---');
  const recentAudit = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  assert.ok(recentAudit.length > 0, 'Audit loglar yozilgan bo\'lishi kerak');
  for (const log of recentAudit) {
    const logStr = JSON.stringify(log);
    assert.strictEqual(logStr.includes('Demo12345!'), false, 'Parol audit logga tushmasligi shart!');
    assert.strictEqual(logStr.includes('Bearer'), false, 'Token audit logga tushmasligi shart!');
  }
  console.log('✓ Audit loglar yozildi va ularga hech qanday parol/token tushmagani tekshirildi (PASSED)');

  console.log('\n--- 10. BOSQICH 5: PUBLIC MENU READ API TESTI ---');
  // Hech qanday login yoki auth tokensiz public menyu olish
  const publicMenuRes = await apiGet(`/api/v1/public/restaurants/${restRayhon.slug}/menu`);
  assert.strictEqual(publicMenuRes.status, 200, 'Public menyu 200 OK qaytarishi kerak');
  assert.strictEqual(publicMenuRes.json.data.restaurant.slug, restRayhon.slug);
  assert.ok(publicMenuRes.json.data.categories.length > 0, 'Kategoriyalar mavjud bo\'lishi kerak');
  assert.ok(publicMenuRes.json.data.items.length > 0, 'Taomlar ro\'yxati bo\'sh bo\'lmasligi kerak');

  // Xodim sirlari yoki moliyaviy credentials chiqmasligini tekshirish
  const publicMenuStr = JSON.stringify(publicMenuRes.json);
  assert.strictEqual(publicMenuStr.includes('passwordHash'), false, 'Parol hash public menyuga chiqmasligi shart');
  assert.strictEqual(publicMenuStr.includes('token_version'), false, 'Token version public menyuga chiqmasligi shart');

  // Til tarjimasini tekshirish (lang=ru)
  const publicRuRes = await apiGet(`/api/v1/public/restaurants/${restRayhon.slug}/menu?lang=ru`);
  assert.strictEqual(publicRuRes.status, 200);
  const weddingPlovRu = publicRuRes.json.data.items.find((i: any) => i.name.includes('(RU)'));
  assert.ok(weddingPlovRu, 'Ruscha tarjima qaytarilishi kerak');

  // Qidiruv filterini tekshirish
  const searchRes = await apiGet(`/api/v1/public/restaurants/${restRayhon.slug}/menu?search=Osh`);
  assert.strictEqual(searchRes.status, 200);
  assert.ok(searchRes.json.data.items.length > 0);
  console.log('✓ Public menyu login talab qilmasdan, to\'g\'ri tarjima va xavfsiz holda qaytdi (PASSED)');

  console.log('\n--- 11. BOSQICH 5: KATEGORIYA VA CROSS-TENANT MENU ISOLATION TESTI ---');
  // Manager yangi kategoriya yaratadi
  const catCreateRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/menu/categories`,
    { name: 'Shirinliklar Test', sortOrder: 99, isVisible: true },
    managerToken
  );
  assert.strictEqual(catCreateRes.status, 201, 'Kategoriya yaratilishi 201 bo\'lishi kerak');
  const createdCatId = catCreateRes.json.data.id;

  // Waiter login (revocation testidan keyin yangi token olish)
  const waiterRelogin = await apiPost('/api/v1/auth/login', {
    phone: '+998905555555',
    password: 'Demo12345!',
  });
  const activeWaiterToken = waiterRelogin.json.data.token;

  // Waiter kategoriya yaratishga uringanda -> 403 FORBIDDEN
  const waiterCatRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/menu/categories`,
    { name: 'Noqonuniy Kategoriya', sortOrder: 1 },
    activeWaiterToken
  );
  assert.strictEqual(waiterCatRes.status, 403, 'Waiterda menu.manage yo\'qligi sababli 403 olishi shart');
  console.log('✓ Kutilganidek: Waiterga kategoriya yaratish taqiqlandi (403 FORBIDDEN)');

  // Cross-tenant tekshiruvi: 1-restoranda 2-restoranning kategoriyasi yoki stansiyasi bilan taom yaratishga urinish
  const gijduvonCat = await prisma.category.upsert({
    where: { id: 'cat-gijduvon-shashlik' },
    update: {},
    create: {
      id: 'cat-gijduvon-shashlik',
      restaurantId: restGijduvon.id,
      name: 'Gijduvon Shashliklari',
      sortOrder: 1,
    },
  });
  const rayhonStation = await prisma.preparationStation.findFirst({ where: { restaurantId: restRayhon.id } });
  assert.ok(gijduvonCat && rayhonStation);

  const crossTenantItemRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/menu/items`,
    {
      categoryId: gijduvonCat.id, // Boshqa restoranning kategoriyasi!
      stationId: rayhonStation.id,
      name: 'Cross-Tenant Taom',
      basePriceTiyin: '2500000',
    },
    managerToken
  );
  assert.strictEqual(crossTenantItemRes.status, 400, 'Begona kategoriya bilan taom yaratish rad etilishi shart');
  assert.strictEqual(crossTenantItemRes.json.error.code, 'INVALID_CATEGORY_TENANT');
  console.log('✓ Kutilganidek: Boshqa tenant kategoriyasi bilan taom yaratish rad etildi (400 INVALID_CATEGORY_TENANT)');

  console.log('\n--- 12. BOSQICH 5: TAOM, VARIANTLAR VA QO\'SHIMCHALAR YARATISH TESTI ---');
  // Rayhon uchun yangi taom yaratish
  const createDishRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/menu/items`,
    {
      categoryId: createdCatId,
      stationId: rayhonStation.id,
      name: "Lag'mon Maxsus",
      description: "Qo'lda cho'zilgan xamir va yangi sabzavotlar",
      basePriceTiyin: '3800000', // 38,000 UZS
      sortOrder: 1,
      allergens: ['gluten', 'tuxum'],
      translations: [
        { language: 'uz', name: "Lag'mon Maxsus", description: "Qo'lda cho'zilgan xamir" },
        { language: 'ru', name: 'Лагман Особый', description: 'Тянутая лапша ручной работы' },
      ],
      variants: [
        { name: 'Yarim porsiya', priceDifferenceTiyin: '-1000000', isDefault: false },
        { name: 'To\'liq porsiya', priceDifferenceTiyin: '0', isDefault: true },
      ],
      addonGroups: [
        {
          name: "Qo'shimchalar",
          minSelect: 0,
          maxSelect: 2,
          options: [
            { name: 'Qazi (2 bo\'lak)', priceTiyin: '800000' },
            { name: 'Bedana tuxum', priceTiyin: '300000' },
          ],
        },
      ],
    },
    managerToken
  );
  assert.strictEqual(createDishRes.status, 201, 'Taom yaratilishi 201 bo\'lishi kerak');
  const createdDishId = createDishRes.json.data.id;
  assert.strictEqual(createDishRes.json.data.version, 1, 'Boshlang\'ich versiya 1 bo\'lishi kerak');
  assert.strictEqual(createDishRes.json.data.variants.length, 2);
  assert.strictEqual(createDishRes.json.data.addonGroups.length, 1);
  console.log('✓ Taom, variantlar, qo\'shimchalar va allergenlar muvaffaqiyatli yaratildi (PASSED)');

  console.log('\n--- 13. BOSQICH 5: AVAILABILITY PERMISSION VA NARX O\'ZGARTIRISHNI TO\'SISH TESTI ---');
  // Waiter taomni "Tugagan" qiladi
  const waiterAvailRes = await apiPatch(
    `/api/v1/restaurants/${restRayhon.id}/menu/items/${createdDishId}/availability`,
    { isAvailable: false },
    activeWaiterToken
  );
  assert.strictEqual(waiterAvailRes.status, 200, 'Waiter availabilityni o\'zgartira olishi kerak');
  assert.strictEqual(waiterAvailRes.json.data.isAvailable, false);
  console.log('✓ Waiter taomni vaqtincha "Tugagan" qilib belgiladi (200 OK)');

  // Waiter narxni o'zgartirishga uringanda -> 403 PRICE_TAMPERING_FORBIDDEN
  const waiterPriceTamper = await apiPatch(
    `/api/v1/restaurants/${restRayhon.id}/menu/items/${createdDishId}/availability`,
    { isAvailable: true, basePriceTiyin: '5000000' },
    activeWaiterToken
  );
  assert.strictEqual(waiterPriceTamper.status, 403, 'Waiter narxni o\'zgartira olmasligi shart');
  assert.strictEqual(waiterPriceTamper.json.error.code, 'PRICE_TAMPERING_FORBIDDEN');
  console.log('✓ Kutilganidek: Waiterning narxni o\'zgartirish urinishi to\'xtatildi (403 PRICE_TAMPERING_FORBIDDEN)');

  console.log('\n--- 14. BOSQICH 5: NARX O\'ZGARISHI VA VERSIONING TESTI ---');
  // Manager narxni yangilaydi (38,000 dan 42,000 ga)
  const managerUpdatePrice = await apiPatch(
    `/api/v1/restaurants/${restRayhon.id}/menu/items/${createdDishId}`,
    { basePriceTiyin: '4200000', isAvailable: true },
    managerToken
  );
  assert.strictEqual(managerUpdatePrice.status, 200);
  assert.strictEqual(managerUpdatePrice.json.data.version, 2, 'Narx o\'zgarganda versiya 2 ga oshishi kerak');
  assert.strictEqual(managerUpdatePrice.json.data.basePriceTiyin, '4200000');
  console.log('✓ Manager narxni yangiladi va menu versiyasi 2 ga oshdi (PASSED)');

  console.log('\n--- 15. BOSQICH 5: SOFT-DELETE / ARCHIVE SAFEGUARD TESTI ---');
  // Tarixda buyurtma mavjud bo'lgan taomni o'chirishga urinish
  // Simulyatsiya: Ushbu taomga OrderItem bog'laymiz
  const testVisit = await prisma.visit.create({
    data: {
      restaurantId: restRayhon.id,
      tableId: table.id,
      pinCode: '9999',
      status: VisitStatus.ACTIVE,
    },
  });
  const testOrder = await prisma.order.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: testVisit.id,
      orderNumber: 999,
      status: OrderStatus.CONFIRMED,
      createdByRole: 'WAITER',
    },
  });
  const testOrderItem = await prisma.orderItem.create({
    data: {
      restaurantId: restRayhon.id,
      orderId: testOrder.id,
      menuItemId: createdDishId,
      stationId: rayhonStation.id,
      quantity: 1,
      snapshotName: "Lag'mon Maxsus",
      snapshotPriceTiyin: 4200000n,
    },
  });

  // Manager taomni o'chiradi
  const deleteRes = await apiDelete(
    `/api/v1/restaurants/${restRayhon.id}/menu/items/${createdDishId}`,
    managerToken
  );
  assert.strictEqual(deleteRes.status, 200);
  assert.strictEqual(deleteRes.json.data.action, 'archived', 'Buyurtma mavjud bo\'lgani uchun taom arxivlanishi kerak');

  // Bazada orderItem saqlanib qolganini tekshirish
  const orderItemAfter = await prisma.orderItem.findUnique({ where: { id: testOrderItem.id } });
  assert.ok(orderItemAfter, 'Buyurtma tarixi va snapshot saqlanib qolishi shart');

  // Public menyuda endi bu taom chiqmasligi kerak
  const publicAfterArchive = await apiGet(`/api/v1/public/restaurants/${restRayhon.slug}/menu`);
  const foundInPublic = publicAfterArchive.json.data.items.find((i: any) => i.id === createdDishId);
  assert.strictEqual(foundInPublic, undefined, 'Arxivlangan taom public menyuda chiqmasligi shart');
  console.log('✓ Buyurtma tarixi bo\'lgan taom hard delete qilinmasdan arxivlandi va tarix saqlandi (PASSED)');

  // Tozalash
  await prisma.orderItem.deleteMany({ where: { orderId: testOrder.id } });
  await prisma.order.deleteMany({ where: { id: testOrder.id } });
  await prisma.visit.deleteMany({ where: { id: testVisit.id } });

  console.log('\n--- 16. BOSQICH 5: RASM YUKLASH VA MAGIC BYTES XAVFSIZLIK TESTI ---');
  // 16.1 To'g'ri JPEG fayl (Magic bytes: FF D8 FF E0)
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  ]);
  const validForm = new FormData();
  validForm.append('image', new Blob([validJpegBuffer], { type: 'image/jpeg' }), 'dish.jpg');

  const validUploadRes = await fetch(`${baseUrl}/api/v1/restaurants/${restRayhon.id}/menu/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${managerToken}` },
    body: validForm,
  });
  const validUploadJson = await validUploadRes.json();
  assert.strictEqual(validUploadRes.status, 201, 'Haqiqiy JPEG muvaffaqiyatli yuklanishi kerak');
  assert.ok(validUploadJson.data.url.startsWith('/uploads/'));
  assert.ok(validUploadJson.data.key.endsWith('.jpg'));
  console.log('✓ Haqiqiy JPEG rasm tasdiqlandi va xavfsiz tasodifiy UUID key bilan saqlandi (PASSED)');

  // 16.2 Soxta fayl (xavfli script)
  const fakeForm = new FormData();
  fakeForm.append('image', new Blob([Buffer.from('<?php echo "bad file"; ?>')], { type: 'image/jpeg' }), 'fake.jpg');
  const fakeUploadRes = await fetch(`${baseUrl}/api/v1/restaurants/${restRayhon.id}/menu/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${managerToken}` },
    body: fakeForm,
  });
  assert.strictEqual(fakeUploadRes.status, 400, 'Soxta fayl magic bytes tekshiruvidan o\'tmasligi shart');
  console.log('✓ Kutilganidek: Magic bytes tekshiruvi orqali soxta fayl rad etildi (400 IMAGE_UPLOAD_FAILED)');

  console.log('\n--- 17. BOSQICH 6: ZAL VA STOL YARATISH, OFITSIANT BIRIKTIRISH VA QR GENERATSIYASI ---');
  // Oldingi sinovlardan qolgan Sharq Zali va uning stollarini tozalash
  const oldHalls = await prisma.hall.findMany({
    where: { restaurantId: restRayhon.id, name: 'Sharq Zali' },
    include: { tables: true },
  });
  for (const h of oldHalls) {
    for (const tbl of h.tables) {
      await prisma.orderItemAddonSnapshot.deleteMany({ where: { orderItem: { restaurantId: restRayhon.id } } });
      await prisma.orderItem.deleteMany({ where: { restaurantId: restRayhon.id } });
      await prisma.order.deleteMany({ where: { restaurantId: restRayhon.id } });
      await prisma.serviceCall.deleteMany({ where: { tableId: tbl.id } });
      await prisma.guestSession.deleteMany({ where: { tableId: tbl.id } });
      await prisma.visit.deleteMany({ where: { tableId: tbl.id } });
      await prisma.table.delete({ where: { id: tbl.id } });
    }
    await prisma.hall.delete({ where: { id: h.id } });
  }

  // 17.1 Zal yaratish
  const createHallRes = await apiPost(`/api/v1/restaurants/${restRayhon.id}/halls`, { name: 'Sharq Zali' }, managerToken);
  assert.strictEqual(createHallRes.status, 201, 'Zal muvaffaqiyatli yaratilishi kerak');
  const hallId = createHallRes.json.data.id;
  console.log('✓ Zal muvaffaqiyatli yaratildi (201 CREATED)');

  // 17.2 Begona zal bilan stol yaratishni rad etish
  const invalidHallRes = await apiPost(`/api/v1/restaurants/${restRayhon.id}/tables`, {
    hallId: '00000000-0000-0000-0000-000000000000',
    number: 99,
  }, managerToken);
  assert.strictEqual(invalidHallRes.status, 400, 'Begona zal rad etilishi kerak');
  console.log('✓ Kutilganidek: Begona zal ID bilan stol yaratish rad etildi (400 INVALID_HALL_TENANT)');

  // 17.3 To'g'ri stol yaratish (Ofitsiant biriktirilgan)
  const createTableRes = await apiPost(`/api/v1/restaurants/${restRayhon.id}/tables`, {
    hallId,
    number: 99,
    capacity: 6,
    assignedWaiterId: waiterUser.id,
  }, managerToken);
  assert.strictEqual(createTableRes.status, 201, 'Stol muvaffaqiyatli yaratilishi kerak');
  const createdTable = createTableRes.json.data;
  const oldQrToken = createdTable.qrToken;
  assert.ok(oldQrToken, 'Stolda QR token bo\'lishi shart');
  assert.strictEqual(createdTable.status, 'FREE');
  console.log('✓ Stol yaratildi (#99, sig\'im: 6, FREE holatda) (PASSED)');

  // 17.4 QR kod PNG va SVG formatda olish
  const qrPngRes = await fetch(`${baseUrl}/api/v1/restaurants/${restRayhon.id}/tables/${createdTable.id}/qr?format=png`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  assert.strictEqual(qrPngRes.status, 200);
  assert.strictEqual(qrPngRes.headers.get('content-type'), 'image/png');

  const qrSvgRes = await fetch(`${baseUrl}/api/v1/restaurants/${restRayhon.id}/tables/${createdTable.id}/qr?format=svg`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  assert.strictEqual(qrSvgRes.status, 200);
  assert.strictEqual(qrSvgRes.headers.get('content-type'), 'image/svg+xml');
  console.log('✓ QR kod tasvirlari PNG va SVG formatda muvaffaqiyatli olindi (PASSED)');

  // 17.5 QR tokenni yangilash (Eski QRni bekor qilish)
  const regenQrRes = await apiPost(`/api/v1/restaurants/${restRayhon.id}/tables/${createdTable.id}/regenerate-qr`, {}, managerToken);
  assert.strictEqual(regenQrRes.status, 200);
  const newQrToken = regenQrRes.json.data.qrToken;
  assert.notStrictEqual(newQrToken, oldQrToken, 'Yangi QR token eskisi bilan bir xil bo\'lmasligi kerak');
  console.log('✓ QR kod yangilandi va eski token bekor qilindi (PASSED)');

  console.log('\n--- 18. BOSQICH 6: STATIK QR ORQALI OMMAVIY STOL VA XAVFSIZLIK TESTI ---');
  // 18.1 Eski QR bilan kirish 404 bo'lishi kerak
  const oldQrPublicRes = await apiGet(`/api/v1/public/tables/${oldQrToken}`);
  assert.strictEqual(oldQrPublicRes.status, 404, 'Eski QR rad etilishi kerak');
  console.log('✓ Kutilganidek: Bekor qilingan eski QR 404 qaytardi (TABLE_NOT_FOUND)');

  // 18.2 Yangi QR bilan ommaviy stol ma'lumotlarini o'qish (maxfiy kod va visit sir saqlanadi)
  const newQrPublicRes = await apiGet(`/api/v1/public/tables/${newQrToken}`);
  assert.strictEqual(newQrPublicRes.status, 200);
  assert.strictEqual(newQrPublicRes.json.data.table.number, 99);
  assert.strictEqual(newQrPublicRes.json.data.table.status, 'FREE');
  assert.strictEqual(newQrPublicRes.json.data.pinCode, undefined, 'Public API maxfiy pinCode ni chiqarmasligi shart');
  assert.strictEqual(newQrPublicRes.json.data.pinCodeHash, undefined, 'Public API pinCodeHash ni chiqarmasligi shart');
  assert.strictEqual(newQrPublicRes.json.data.visitId, undefined, 'Public API visitId ni chiqarmasligi shart');
  console.log('✓ Ommaviy stol APIsi ma\'lumotlarni maxfiy sirlarsiz xavfsiz qaytardi (PASSED)');

  // 18.3 Sessiyasiz mehmon amallari rad etilishi shart
  const noSessionRes = await apiPost('/api/v1/guest/service-call', { type: 'WAITER' });
  assert.strictEqual(noSessionRes.status, 401, 'Sessiyasiz mehmon so\'rovi 401 bo\'lishi kerak');
  console.log('✓ Kutilganidek: Mehmon sessiyasisiz xizmat so\'rovi rad etildi (401 GUEST_SESSION_REQUIRED)');

  console.log('\n--- 19. BOSQICH 6: FREE STOLGA TASHRIF OCHISH VA PARALLEL POYGA TESTI ---');
  // 19.1 Waiter tashrif ochadi
  const openVisitRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/tables/${createdTable.id}/open-visit`,
    {},
    activeWaiterToken
  );
  assert.strictEqual(openVisitRes.status, 201, 'Tashrif muvaffaqiyatli ochilishi kerak');
  const visitData = openVisitRes.json.data;
  const visitId = visitData.id;
  const initialPinCode = visitData.pinCode;
  assert.ok(initialPinCode && initialPinCode.length === 4, '4-xonali kirish kodi xodimga berilishi shart');
  console.log(`✓ FREE stolga tashrif ochildi (Visit ID: ${visitId}, Xodimga berilgan pinCode: ${initialPinCode}) (PASSED)`);

  // Stol holati OCCUPIED bo'lganini tekshirish
  const tableOccupiedCheck = await apiGet(`/api/v1/public/tables/${newQrToken}`);
  assert.strictEqual(tableOccupiedCheck.json.data.table.status, 'OCCUPIED');

  // 19.2 Band stolga ikkinchi tashrif ochishga urinish rad etilishi shart (Atomic DB kafolati)
  const duplicateVisitRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/tables/${createdTable.id}/open-visit`,
    {},
    activeWaiterToken
  );
  assert.strictEqual(duplicateVisitRes.status, 400, 'Band stolga qayta tashrif ochish rad etilishi kerak');
  console.log('✓ Kutilganidek: Band stolga parallel/qayta tashrif ochish rad etildi (400 TABLE_NOT_FREE)');

  console.log('\n--- 20. BOSQICH 6: KIRISH KODI RATE LIMITING, LOCKOUT VA YANGILASH ---');
  // 20.1 Noto'g'ri kod bilan 4 marta urinish
  for (let i = 1; i <= 4; i++) {
    const wrongRes = await apiPost(`/api/v1/public/tables/${newQrToken}/join`, { code: '0000' });
    assert.strictEqual(wrongRes.status, 400);
    assert.strictEqual(wrongRes.json.error.code, 'INVALID_TABLE_CODE');
  }
  console.log('✓ 4 marta noto\'g\'ri kod kiritilganda to\'g\'ri xatolik va qolgan urinishlar ko\'rsatildi');

  // 20.2 5-marta xato: 2 daqiqaga bloklanadi
  const fifthWrongRes = await apiPost(`/api/v1/public/tables/${newQrToken}/join`, { code: '0000' });
  assert.strictEqual(fifthWrongRes.status, 400);
  assert.ok(fifthWrongRes.json.error.message.includes('bloklandi'));

  // 20.3 6-marta urinish: darhol 429 TOO_MANY_ATTEMPTS
  const sixthWrongRes = await apiPost(`/api/v1/public/tables/${newQrToken}/join`, { code: '0000' });
  assert.strictEqual(sixthWrongRes.status, 429, 'Bloklangan vaqtda 429 bo\'lishi kerak');
  console.log('✓ 5 marta xato urinishdan so\'ng 429 TOO_MANY_ATTEMPTS xavfsizlik cheklovi ishladi (PASSED)');

  // 20.4 Xodim kodni yangilaydi (Rotate code) va lockout tozalanadi
  const rotateRes = await apiPost(`/api/v1/restaurants/${restRayhon.id}/visits/${visitId}/rotate-code`, {}, activeWaiterToken);
  assert.strictEqual(rotateRes.status, 200);
  const rotatedPinCode = rotateRes.json.data.pinCode;
  assert.ok(rotatedPinCode);
  assert.notStrictEqual(rotatedPinCode, initialPinCode, 'Yangi kod eskisi bilan bir xil bo\'lmasligi kerak');
  console.log(`✓ Xodim kirish kodini muvaffaqiyatli yangiladi (Yangi kod: ${rotatedPinCode}) (PASSED)`);

  console.log('\n--- 21. BOSQICH 6: IKKI TELEFONNING BITTA TASHRIFGA QO\'SHILISHI VA GUEST SESSION ---');
  // 21.1 Birinchi telefon qo'shiladi
  const phone1Join = await apiPost(`/api/v1/public/tables/${newQrToken}/join`, {
    code: rotatedPinCode,
    deviceInfo: 'iPhone 15 Pro - Phone 1',
  });
  assert.strictEqual(phone1Join.status, 200);
  const sessionToken1 = phone1Join.json.data.sessionToken;
  assert.ok(sessionToken1);

  // 21.2 Ikkinchi telefon xuddi shu stol kodini kiritib qo'shiladi
  const phone2Join = await apiPost(`/api/v1/public/tables/${newQrToken}/join`, {
    code: rotatedPinCode,
    deviceInfo: 'Samsung S24 - Phone 2',
  });
  assert.strictEqual(phone2Join.status, 200);
  const sessionToken2 = phone2Join.json.data.sessionToken;
  assert.ok(sessionToken2);
  assert.notStrictEqual(sessionToken1, sessionToken2, 'Har bir qurilma o\'zining unikal sessiya tokeniga ega bo\'lishi kerak');

  // 21.3 Birinchi telefon ofitsiantni chaqiradi
  const callWaiterRes = await fetch(`${baseUrl}/api/v1/guest/service-call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken1}`,
    },
    body: JSON.stringify({ type: 'WAITER' }),
  });
  const callWaiterJson = await callWaiterRes.json();
  assert.strictEqual(callWaiterRes.status, 201);
  assert.strictEqual(callWaiterJson.data.type, 'WAITER');
  console.log('✓ 1-telefon ofitsiant chaqirdi (ServiceCall yaratildi) (PASSED)');

  // 21.4 Ikkinchi telefon joriy tashrif sessiyasini tekshiradi va bitta tashrifga ulanganini ko'radi
  const phone2SessionRes = await fetch(`${baseUrl}/api/v1/guest/session`, {
    headers: { Authorization: `Bearer ${sessionToken2}` },
  });
  const phone2SessionJson = await phone2SessionRes.json();
  assert.strictEqual(phone2SessionRes.status, 200);
  assert.strictEqual(phone2SessionJson.data.visit.id, visitId, 'Ikkala telefon bitta visitId ga bog\'langan bo\'lishi shart');
  assert.strictEqual(phone2SessionJson.data.table.number, 99);
  console.log('✓ 2-telefon ham xuddi shu tashrif va stolga muvaffaqiyatli ulandi (PASSED)');

  // 21.5 DB da tokenlar faqat SHA-256 hash ko'rinishida saqlanganini tekshirish
  const dbSessions = await prisma.guestSession.findMany({ where: { visitId } });
  assert.strictEqual(dbSessions.length, 2, 'DB da 2 ta sessiya yozuvi bo\'lishi kerak');
  for (const s of dbSessions) {
    assert.strictEqual(s.tokenHash.length, 64, 'Token sha256 hash (64 belgi) bo\'lishi shart');
    assert.notStrictEqual(s.tokenHash, sessionToken1);
    assert.notStrictEqual(s.tokenHash, sessionToken2);
  }
  console.log('✓ Xavfsizlik tekshirildi: DB da faqat SHA-256 hashlar saqlanadi, plain token yo\'q (PASSED)');

  // 22.1 Waiter visits.close ruxsatisiz tashrifni yopa olmasligini tekshirish (403 FORBIDDEN)
  const waiterCloseRes = await apiPost(`/api/v1/restaurants/${restRayhon.id}/visits/${visitId}/close`, {}, activeWaiterToken);
  assert.strictEqual(waiterCloseRes.status, 403, 'Waiter visits.close ruxsatisiz yopa olmasligi kerak');
  console.log('✓ Kutilganidek: Oddiy ofitsiant visits.close ruxsatisiz tashrifni yopa olmadi (403 FORBIDDEN)');

  // 22.2 Vakolatli Manager tashrifni yopadi
  const closeVisitRes = await apiPost(`/api/v1/restaurants/${restRayhon.id}/visits/${visitId}/close`, {}, managerToken);
  assert.strictEqual(closeVisitRes.status, 200);
  assert.strictEqual(closeVisitRes.json.data.tableStatus, 'DIRTY');
  console.log('✓ Vakolatli Manager tashrifni yopdi va stol OCCUPIED -> DIRTY holatiga o\'tdi (PASSED)');

  // 22.2 Eskirgan 1-telefon va 2-telefon sessiyalari darhol bekor bo'lishi (401 VISIT_CLOSED)
  const phone1AfterClose = await fetch(`${baseUrl}/api/v1/guest/session`, {
    headers: { Authorization: `Bearer ${sessionToken1}` },
  });
  assert.strictEqual(phone1AfterClose.status, 401, 'Eski tashrif sessiyasi 401 bo\'lishi shart');

  const phone2AfterClose = await fetch(`${baseUrl}/api/v1/guest/session`, {
    headers: { Authorization: `Bearer ${sessionToken2}` },
  });
  assert.strictEqual(phone2AfterClose.status, 401, 'Eski tashrif sessiyasi 401 bo\'lishi shart');
  console.log('✓ Kutilganidek: Tashrif yopilgach barcha mehmon telefonlari bekor qilindi (401 VISIT_CLOSED)');

  // 22.3 Ommaviy QR endi stol DIRTY ekanini ko'rsatadi
  const publicDirtyCheck = await apiGet(`/api/v1/public/tables/${newQrToken}`);
  assert.strictEqual(publicDirtyCheck.json.data.table.status, 'DIRTY');
  assert.ok(publicDirtyCheck.json.data.statusMessage.includes('tozalanmoqda'));
  console.log('✓ Ommaviy ekranda "Stol tozalanmoqda. Iltimos, xodimga murojaat qiling" xabari chiqdi (PASSED)');

  console.log('\n--- 23. BOSQICH 6: TOZALASH (DIRTY -> FREE) VA YANGI TASHRIF ISOLATION ---');
  // 23.1 DIRTY stolda yangi tashrif ochish rad etilishi kerak
  const openOnDirtyRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/tables/${createdTable.id}/open-visit`,
    {},
    activeWaiterToken
  );
  assert.strictEqual(openOnDirtyRes.status, 400);
  console.log('✓ Kutilganidek: Tozalanmagan (DIRTY) stolda tashrif ochish rad etildi (400 TABLE_NOT_FREE)');

  // 23.2 Ofitsiant stolni tozalangan deb belgilaydi (markClean: DIRTY -> FREE)
  const cleanRes = await apiPost(`/api/v1/restaurants/${restRayhon.id}/tables/${createdTable.id}/mark-clean`, {}, activeWaiterToken);
  assert.strictEqual(cleanRes.status, 200);
  assert.strictEqual(cleanRes.json.data.status, 'FREE');
  console.log('✓ Stol tozalangan deb belgilandi va FREE holatiga o\'tdi (DIRTY -> FREE) (PASSED)');

  // 23.3 Yangi tashrif ochiladi (Yangi kod va yangi visitId)
  const secondVisitRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/tables/${createdTable.id}/open-visit`,
    {},
    activeWaiterToken
  );
  assert.strictEqual(secondVisitRes.status, 201);
  const secondVisitId = secondVisitRes.json.data.id;
  assert.notStrictEqual(secondVisitId, visitId, 'Yangi tashrif yangi ID ga ega bo\'lishi shart');

  // 23.4 Eski telefonning sessiyasi yangi tashrifga o'tmasligini tekshirish
  const oldPhoneOnNewVisit = await fetch(`${baseUrl}/api/v1/guest/session`, {
    headers: { Authorization: `Bearer ${sessionToken1}` },
  });
  assert.strictEqual(oldPhoneOnNewVisit.status, 401, 'Eski telefon yangi tashrifni avtomatik ko\'ra olmasligi shart');
  console.log('✓ Qat\'iy tekshirildi: Eski telefon yangi tashrif ma\'lumotlariga kira olmadi (401) (PASSED)');

  console.log('\n--- 24. BOSQICH 7: MEHMON BUYURTMASI, SERVER NARX SNAPSHOTLARI VA STATUS NEW/PENDING ---');
  // 24.1 2-tashrifga mehmon qo'shiladi
  const guestJoinSecond = await apiPost(`/api/v1/public/tables/${newQrToken}/join`, {
    code: secondVisitRes.json.data.pinCode,
  });
  assert.strictEqual(guestJoinSecond.status, 200);
  const guestOrderToken = guestJoinSecond.json.data.sessionToken;

  // Taomni bazadan olish (variant va addonlari bilan)
  const orderDish = await prisma.menuItem.findFirst({
    where: { restaurantId: restRayhon.id, isArchived: false, isAvailable: true },
    include: { variants: true, addonGroups: { include: { options: true } } },
  });
  assert.ok(orderDish, 'Sinov uchun taom mavjud bo\'lishi shart');

  const selectedVariant = orderDish.variants[0];
  const selectedAddon = orderDish.addonGroups[0]?.options[0];
  const selectedAddonIds = selectedAddon ? [selectedAddon.id] : [];

  // 24.2 Yangi buyurtma yuborish
  const orderPayload1 = {
    items: [
      {
        menuItemId: orderDish.id,
        variantId: selectedVariant?.id,
        addonOptionIds: selectedAddonIds,
        quantity: 2,
        notes: 'Piyozi ko\'proq bo\'lsin',
        expectedVersion: orderDish.version,
      },
    ],
    notes: 'Iltimos, tezroq keltiring',
  };

  const createOrderRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestOrderToken}`,
      'Idempotency-Key': 'idemp-step7-order-1',
    },
    body: JSON.stringify(orderPayload1),
  });
  const createOrderJson = await createOrderRes.json();
  assert.strictEqual(createOrderRes.status, 201, 'Buyurtma 201 CREATED bo\'lishi shart');
  assert.strictEqual(createOrderJson.data.status, 'NEW', 'Boshlang\'ich buyurtma statusi NEW bo\'lishi shart');
  const createdOrderId = createOrderJson.data.orderId;
  assert.ok(createdOrderId);

  // DB da tekshirish: OrderItem status PENDING, server snapshot to'g'ri yozilgan
  const dbOrder = await prisma.order.findUnique({
    where: { id: createdOrderId },
    include: {
      items: {
        include: { addonSnapshots: true },
      },
    },
  });
  assert.ok(dbOrder);
  assert.strictEqual(dbOrder.status, 'NEW');
  assert.strictEqual(dbOrder.createdByRole, 'GUEST');
  assert.strictEqual(dbOrder.items.length, 1);
  const dbItem = dbOrder.items[0];
  assert.strictEqual(dbItem.status, 'PENDING', 'Tasdiqlanmagan taom PENDING bo\'lishi shart');
  assert.strictEqual(dbItem.quantity, 2);
  assert.strictEqual(dbItem.snapshotName, orderDish.name);
  if (selectedVariant) {
    assert.strictEqual(dbItem.snapshotVariantName, selectedVariant.name);
  }
  if (selectedAddon) {
    assert.strictEqual(dbItem.addonSnapshots.length, 1);
    assert.strictEqual(dbItem.addonSnapshots[0].name, selectedAddon.name);
  }
  console.log('✓ Mehmon buyurtmasi DBga yozildi (Order: NEW, OrderItem: PENDING, Snapshot saqlandi) (PASSED)');

  console.log('\n--- 25. BOSQICH 7: SERVER-AUTHORITATIVE NARX VA PRICE TAMPERING HIMOYASI ---');
  // Client soxta arzon narx (100 tiyin) yuborishga urinadi
  const fakePriceRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestOrderToken}`,
      'Idempotency-Key': 'idemp-tamper-test',
    },
    body: JSON.stringify({
      items: [
        {
          menuItemId: orderDish.id,
          quantity: 1,
          priceTiyin: '100', // SOXTA NARX
          price: 1,
        },
      ],
    }),
  });
  const fakePriceJson = await fakePriceRes.json();
  assert.strictEqual(fakePriceRes.status, 201);
  const tamperedOrderInDb = await prisma.order.findUnique({
    where: { id: fakePriceJson.data.orderId },
    include: { items: true },
  });
  assert.ok(tamperedOrderInDb);
  assert.strictEqual(
    tamperedOrderInDb.items[0].snapshotPriceTiyin,
    orderDish.basePriceTiyin,
    'Client narxi rad etilib, faqat DBdagi haqiqiy bazaviy narx snapshotga yozilishi shart'
  );
  console.log('✓ Xavfsizlik isbotlandi: Clientdan yuborilgan soxta narx inobatga olinmadi, server snapshot narxi yozildi (PASSED)');

  console.log('\n--- 26. BOSQICH 7: TUGAGAN TAOM VA NOTO\'G\'RI TANLOVLAR RAD ETILISHI ---');
  // 26.1 Vaqtincha tugagan taomni buyurtma qilishni rad etish
  const unavailableDish = await prisma.menuItem.create({
    data: {
      restaurantId: restRayhon.id,
      categoryId: orderDish.categoryId,
      stationId: orderDish.stationId,
      name: 'Tugagan Taom Test',
      basePriceTiyin: 3000000n,
      isAvailable: false, // TUGAGAN
    },
  });

  const orderUnavailableRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestOrderToken}`,
      'Idempotency-Key': 'idemp-unavail-test',
    },
    body: JSON.stringify({
      items: [{ menuItemId: unavailableDish.id, quantity: 1 }],
    }),
  });
  assert.strictEqual(orderUnavailableRes.status, 400);
  const orderUnavailableJson = await orderUnavailableRes.json();
  assert.strictEqual(orderUnavailableJson.error.code, 'ITEM_UNAVAILABLE');
  console.log('✓ Kutilganidek: Tugagan taomga buyurtma berish rad etildi (400 ITEM_UNAVAILABLE)');

  // 26.2 Noto'g'ri miqdor (0 yoki 51)
  const invalidQtyRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestOrderToken}`,
      'Idempotency-Key': 'idemp-qty-test',
    },
    body: JSON.stringify({
      items: [{ menuItemId: orderDish.id, quantity: 0 }],
    }),
  });
  assert.strictEqual(invalidQtyRes.status, 400);
  console.log('✓ Kutilganidek: 0 miqdorli buyurtma rad etildi (400 INVALID_QUANTITY)');

  console.log('\n--- 27. BOSQICH 7: NARX VA MENYU VERSIYASI O\'ZGARISHI ZIDDIYATI (409) ---');
  // Taomning versiyasini 1 ga oshiramiz (masalan boshqaruvchi tahrir qildi)
  await prisma.menuItem.update({
    where: { id: orderDish.id },
    data: { version: { increment: 1 } },
  });

  // Client eski versiya bilan buyurtma yuboradi
  const versionConflictRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestOrderToken}`,
      'Idempotency-Key': 'idemp-ver-conflict',
    },
    body: JSON.stringify({
      items: [
        {
          menuItemId: orderDish.id,
          quantity: 1,
          expectedVersion: orderDish.version, // Eskirgan versiya
        },
      ],
    }),
  });
  assert.strictEqual(versionConflictRes.status, 409);
  const versionConflictJson = await versionConflictRes.json();
  assert.strictEqual(versionConflictJson.error.code, 'PRICE_VERSION_CONFLICT');
  console.log('✓ Kutilganidek: Menyu versiyasi o\'zgarganda 409 PRICE_VERSION_CONFLICT qaytarildi (PASSED)');

  console.log('\n--- 28. BOSQICH 7: IDEMPOTENCY RETRY VA CONFLICT TESTLARI ---');
  // 28.1 Bir xil kalit va bir xil payload (Double-click yoki Timeout retry)
  const retryKey = 'idemp-retry-consistent-key';
  const retryPayload = {
    items: [
      {
        menuItemId: orderDish.id,
        quantity: 1,
      },
    ],
    notes: 'Qayta urinish testi',
  };

  // 1-yuborish
  const firstReq = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestOrderToken}`,
      'Idempotency-Key': retryKey,
    },
    body: JSON.stringify(retryPayload),
  });
  const firstJson = await firstReq.json();
  assert.strictEqual(firstReq.status, 201);
  const committedOrderId = firstJson.data.orderId;
  assert.ok(committedOrderId);

  // 2-yuborish: Aynan bir xil kalit va aynan bir xil payload
  const secondReq = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestOrderToken}`,
      'Idempotency-Key': retryKey,
    },
    body: JSON.stringify(retryPayload),
  });
  const secondJson = await secondReq.json();
  assert.strictEqual(secondReq.status, 201);
  assert.strictEqual(secondJson.data.orderId, committedOrderId, 'Idempotent replay bir xil orderId qaytarishi shart');
  assert.strictEqual(secondJson.meta.isIdempotentReplay, true);
  console.log('✓ Idempotency replay muvaffaqiyatli: Ikkinchi so\'rovda yangi order yaratilmasdan avvalgi natija qaytarildi (PASSED)');

  // 28.2 Bir kalit + boshqa mazmun -> 409 IDEMPOTENCY_CONFLICT
  const conflictingReq = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestOrderToken}`,
      'Idempotency-Key': retryKey,
    },
    body: JSON.stringify({
      items: [{ menuItemId: orderDish.id, quantity: 5 }], // Boshqa miqdor!
      notes: 'Umuman boshqa mazmun',
    }),
  });
  assert.strictEqual(conflictingReq.status, 409);
  const conflictingJson = await conflictingReq.json();
  assert.strictEqual(conflictingJson.error.code, 'IDEMPOTENCY_CONFLICT');
  console.log('✓ Kutilganidek: Bir xil kalit bilan boshqa mazmun yuborilganda 409 IDEMPOTENCY_CONFLICT qaytdi (PASSED)');

  console.log('\n--- 29. BOSQICH 7: BUYURTMALARIM RO\'YXATI VA PENDING TAOMLAR HISOBLANISHI ---');
  const getOrdersRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    headers: { Authorization: `Bearer ${guestOrderToken}` },
  });
  const getOrdersJson = await getOrdersRes.json();
  assert.strictEqual(getOrdersRes.status, 200);
  assert.ok(Array.isArray(getOrdersJson.data));
  assert.ok(getOrdersJson.data.length >= 2);
  const firstFoundOrder = getOrdersJson.data.find((o: any) => o.id === createdOrderId);
  assert.ok(firstFoundOrder);
  assert.strictEqual(firstFoundOrder.items[0].status, 'PENDING');
  console.log('✓ Mehmon o\'z tashrifining barcha buyurtmalari va PENDING taomlarini to\'liq ko\'rdi (PASSED)');

  console.log('\n--- 30. BOSQICH 7: YOPILGAN TASHRIFGA BUYURTMA BERISHNING TO\'SILISHI ---');
  // 30.1 PENDING taomlar borligida tashrifni yopish rad etilishi kerak (Item checks kafolati)
  const rejectCloseWithPending = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/visits/${secondVisitId}/close`,
    { forceSettlement: true },
    managerToken
  );
  assert.strictEqual(rejectCloseWithPending.status, 400);
  assert.strictEqual(rejectCloseWithPending.json.error.code, 'ACTIVE_ITEMS_EXIST');
  console.log('✓ Kutilganidek: Tayyorlanayotgan/kutilayotgan taomlar borligida tashrif yopilmadi (400 ACTIVE_ITEMS_EXIST)');

  // 30.2 Taomlar yetkazildi (SERVED) deb belgilanadi va tashrif yopiladi
  await prisma.orderItem.updateMany({
    where: { order: { visitId: secondVisitId } },
    data: { status: OrderItemStatus.SERVED },
  });

  const closeSecondRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/visits/${secondVisitId}/close`,
    { forceSettlement: true },
    managerToken
  );
  assert.strictEqual(closeSecondRes.status, 200);

  // Yopilgan tashrifga buyurtma yuborish rad etilishi kerak
  const orderOnClosedRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestOrderToken}`,
      'Idempotency-Key': 'idemp-closed-visit',
    },
    body: JSON.stringify(retryPayload),
  });
  assert.strictEqual(orderOnClosedRes.status, 401, 'Yopilgan tashrifga buyurtma 401 bo\'lishi shart');
  console.log('✓ Kutilganidek: Tashrif yopilgach mehmon sessiyasi buyurtma bera olmadi (401 VISIT_CLOSED)');

  console.log('\n--- 31. BOSQICH 8: MEHMON XIZMAT CHAQIRUVI VA ANTI-SPAM (COOLDOWN) TESTI ---');
  // Faol waiter token olish (chunki 8-bosqichda waiter deactivatsiya bo'lib tokenVersion oshgan)
  const waiterLoginRes = await apiPost('/api/v1/auth/login', {
    phone: '+998905555555',
    password: 'Demo12345!',
  });
  assert.strictEqual(waiterLoginRes.status, 200, 'Waiter qayta login qilishi shart');
  const currentWaiterToken = waiterLoginRes.json.data.token;

  // Yangi stol va tashrif ochish
  const leftoverTable88 = await prisma.table.findFirst({ where: { restaurantId: restRayhon.id, number: 88 } });
  if (leftoverTable88) {
    await prisma.serviceCall.deleteMany({ where: { tableId: leftoverTable88.id } });
    await prisma.guestSession.deleteMany({ where: { tableId: leftoverTable88.id } });
    await prisma.visit.deleteMany({ where: { tableId: leftoverTable88.id } });
    await prisma.table.delete({ where: { id: leftoverTable88.id } });
  }

  const waiterTestTable = await prisma.table.create({
    data: {
      restaurantId: restRayhon.id,
      hallId: hallId,
      number: 88,
      capacity: 4,
      status: 'FREE',
      qrToken: 'qr_waiter_test_88',
    },
  });

  const openWaiterVisit = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/tables/${waiterTestTable.id}/open-visit`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(openWaiterVisit.status, 201);
  const waiterVisitId = openWaiterVisit.json.data.id;

  // Mehmon qo'shiladi
  const waiterGuestJoin = await apiPost(`/api/v1/public/tables/qr_waiter_test_88/join`, {
    code: openWaiterVisit.json.data.pinCode,
  });
  assert.strictEqual(waiterGuestJoin.status, 200);
  const waiterGuestToken = waiterGuestJoin.json.data.sessionToken;

  // 31.1 Mehmon ofitsiant chaqiradi (POST /api/v1/guest/service-calls)
  const firstCallRes = await fetch(`${baseUrl}/api/v1/guest/service-calls`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${waiterGuestToken}`,
    },
    body: JSON.stringify({ type: 'WAITER' }),
  });
  const firstCallJson = await firstCallRes.json();
  assert.strictEqual(firstCallRes.status, 201);
  assert.strictEqual(firstCallJson.data.type, 'WAITER');
  assert.strictEqual(firstCallJson.data.status, 'PENDING');
  const createdCallId = firstCallJson.data.id;
  console.log(`✓ Mehmon ofitsiant chaqiruvi yaratdi (Call ID: ${createdCallId})`);

  // 31.2 Anti-spam tekshiruvi: Aynan shu turdagi ochiq chaqiruv qayta bosilsa dublikat yaratilmaydi
  const duplicateCallRes = await fetch(`${baseUrl}/api/v1/guest/service-calls`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${waiterGuestToken}`,
    },
    body: JSON.stringify({ type: 'WAITER' }),
  });
  const duplicateCallJson = await duplicateCallRes.json();
  assert.strictEqual(duplicateCallRes.status, 200);
  assert.strictEqual(duplicateCallJson.meta.isDuplicate, true, 'Dublikat chaqiruv aniqlanishi shart');
  assert.strictEqual(duplicateCallJson.data.id, createdCallId, 'Avvalgi chaqiruv qaytarilishi shart');

  const totalCallsInDb = await prisma.serviceCall.count({
    where: { visitId: waiterVisitId, type: 'WAITER' },
  });
  assert.strictEqual(totalCallsInDb, 1, 'DBda dublikat spam chaqiruv bo\'lmasligi kerak');
  console.log('✓ Anti-spam ishlaydi: Ochiq chaqiruv qayta bosilganda dublikat yozilmadi (PASSED)');

  console.log('\n--- 32. BOSQICH 8: OFITSIANT DASHBOARDI VA METRIKALAR TESTI ---');
  const dashboardRes = await apiGet(`/api/v1/restaurants/${restRayhon.id}/waiter/dashboard`, currentWaiterToken);
  assert.strictEqual(dashboardRes.status, 200);
  const dashboardData = dashboardRes.json.data;
  assert.ok(dashboardData.metrics.openCallsCount >= 1, 'Kamida 1 ta ochiq chaqiruv bo\'lishi kerak');
  assert.ok(dashboardData.serviceCalls.some((c: any) => c.id === createdCallId));
  assert.ok(dashboardData.myTables.some((t: any) => t.id === waiterTestTable.id));
  console.log(`✓ Ofitsiant dashboardi tekshirildi (Ochiq chaqiruvlar: ${dashboardData.metrics.openCallsCount}) (PASSED)`);

  console.log('\n--- 33. BOSQICH 8: CONCURRENCY: PARALLEL CLAIM RACE CONDITION TESTI ---');
  // 2-ofitsiantni yaratish va login qilish
  const waiterUser2 = await prisma.user.upsert({
    where: { phone: '+998905555556' },
    update: {
      isActive: true,
      passwordHash: waiterUser.passwordHash,
    },
    create: {
      phone: '+998905555556',
      passwordHash: waiterUser.passwordHash,
      fullName: 'Sardor (Waiter 2)',
      isActive: true,
    },
  });
  const membership2 = await prisma.restaurantMembership.upsert({
    where: { restaurantId_userId: { restaurantId: restRayhon.id, userId: waiterUser2.id } },
    update: {
      isActive: true,
    },
    create: { restaurantId: restRayhon.id, userId: waiterUser2.id, isActive: true },
  });
  await prisma.membershipRole.upsert({
    where: { membershipId_role: { membershipId: membership2.id, role: Role.WAITER } },
    update: {},
    create: { membershipId: membership2.id, role: Role.WAITER },
  });

  const waiter2Login = await apiPost('/api/v1/auth/login', {
    phone: '+998905555556',
    password: 'Demo12345!',
  });
  assert.strictEqual(waiter2Login.status, 200, `Waiter 2 logini muvaffaqiyatli bo'lishi kerak: ${JSON.stringify(waiter2Login.json)}`);
  const waiter2Token = waiter2Login.json.data.token;

  // Tashrif va stol waiterId sini null qilish (ikkala ofitsiant ham umumiy havzadagi chaqiruvga da'vogarlik qila olishi uchun)
  await prisma.visit.update({
    where: { id: waiterVisitId },
    data: { waiterId: null },
  });
  await prisma.table.update({
    where: { id: waiterTestTable.id },
    data: { assignedWaiterId: null },
  });

  // Ikkala ofitsiant bir vaqtda parallel claim yuboradi
  const [claimResult1, claimResult2] = await Promise.all([
    apiPost(`/api/v1/restaurants/${restRayhon.id}/waiter/service-calls/${createdCallId}/claim`, {}, currentWaiterToken),
    apiPost(`/api/v1/restaurants/${restRayhon.id}/waiter/service-calls/${createdCallId}/claim`, {}, waiter2Token),
  ]);

  const statuses = [claimResult1.status, claimResult2.status].sort();
  assert.deepStrictEqual(statuses, [200, 409], 'Parallel claimdan faqat bittasi 200, ikkinchisi 409 olishi shart');

  const winner = claimResult1.status === 200 ? 'Waiter 1' : 'Waiter 2';
  const loserJson = claimResult1.status === 409 ? claimResult1.json : claimResult2.json;
  assert.strictEqual(loserJson.error.code, 'CALL_ALREADY_CLAIMED');
  console.log(`✓ Parallel claim poygasi tekshirildi: ${winner} qabul qildi, ikkinchisiga 409 CALL_ALREADY_CLAIMED chiqdi (PASSED)`);

  console.log('\n--- 34. BOSQICH 8: BIRIKTIRILMAGAN OFITSIANT CLAIM SIYOSATI (POLICY GUARD) ---');
  // Yangi chaqiruv: Stol faqat Waiter 1 ga biriktirilgan
  await prisma.table.update({
    where: { id: waiterTestTable.id },
    data: { assignedWaiterId: waiterUser.id },
  });

  const billCallRes = await fetch(`${baseUrl}/api/v1/guest/service-calls`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${waiterGuestToken}`,
    },
    body: JSON.stringify({ type: 'BILL' }),
  });
  const billCallId = (await billCallRes.json()).data.id;

  // Waiter 2 (biriktirilmagan) ushbu chaqiruvni claim qilishga uringanda -> 403 NOT_ASSIGNED_WAITER
  const unassignedClaimRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/service-calls/${billCallId}/claim`,
    {},
    waiter2Token
  );
  assert.strictEqual(unassignedClaimRes.status, 403, 'Biriktirilmagan ofitsiant claimi 403 bo\'lishi shart');
  assert.strictEqual(unassignedClaimRes.json.error.code, 'NOT_ASSIGNED_WAITER');
  console.log('✓ Kutilganidek: Biriktirilmagan ofitsiantning claimi rad etildi (403 NOT_ASSIGNED_WAITER)');

  // Waiter 1 esa muvaffaqiyatli claim qiladi
  const assignedClaimRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/service-calls/${billCallId}/claim`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(assignedClaimRes.status, 200);
  console.log('✓ Biriktirilgan ofitsiant chaqiruvni muvaffaqiyatli qabul qildi (200 OK)');

  console.log('\n--- 35. BOSQICH 8: MENEJER REASSIGNMENT VA RESOLVE TESTI ---');
  // Menejer chaqiruvni Waiter 1 dan Waiter 2 ga reassign qiladi
  const reassignRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/service-calls/${billCallId}/reassign`,
    { targetWaiterId: waiterUser2.id, reason: 'Menejer qayta biriktirdi' },
    managerToken
  );
  assert.strictEqual(reassignRes.status, 200);
  assert.strictEqual(reassignRes.json.data.acknowledgedByUserId, waiterUser2.id);

  // Audit log tekshiruvi
  const reassignAudit = await prisma.auditLog.findFirst({
    where: { entityId: billCallId, action: 'SERVICE_CALL_REASSIGNED' },
  });
  assert.ok(reassignAudit, 'Reassign uchun audit log yozilishi shart');
  console.log('✓ Menejer audit bilan chaqiruvni boshqa ofitsiantga o\'tkazdi');

  // Eski ofitsiant (Waiter 1) resolve qilishga urinsa rad etiladi
  const oldWaiterResolve = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/service-calls/${billCallId}/resolve`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(oldWaiterResolve.status, 403, 'Eski ofitsiant yozish huquqidan mahrum bo\'lishi shart');
  console.log('✓ Kutilganidek: Qayta biriktirilgach eski ofitsiantning resolve huquqi bloklandi (403 FORBIDDEN)');

  // Yangi ofitsiant (Waiter 2) esa resolve qiladi
  const newWaiterResolve = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/service-calls/${billCallId}/resolve`,
    {},
    waiter2Token
  );
  assert.strictEqual(newWaiterResolve.status, 200);
  assert.strictEqual(newWaiterResolve.json.data.status, 'RESOLVED');
  console.log('✓ Yangi ofitsiant chaqiruvni muvaffaqiyatli yakunladi (RESOLVED) (PASSED)');

  console.log('\n--- 36. BOSQICH 8: GUEST BUYURTMASINI TASDIQLASH (CONFIRM ORDER) ---');
  const currentOrderDish = await prisma.menuItem.findUniqueOrThrow({ where: { id: orderDish.id } });

  // Mehmon buyurtma beradi
  const guestOrderRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${waiterGuestToken}`,
      'Idempotency-Key': 'idemp-waiter-test-order-1',
    },
    body: JSON.stringify({
      orderNotes: 'Tezroq keltiring',
      items: [{ menuItemId: currentOrderDish.id, quantity: 1, expectedVersion: currentOrderDish.version }],
    }),
  });
  const guestOrderData = (await guestOrderRes.json()).data;
  const waiterTestOrderId = guestOrderData.orderId || guestOrderData.id;
  assert.strictEqual(guestOrderData.status, 'NEW');

  // Ofitsiant buyurtmani tasdiqlaydi
  const confirmOrderRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/orders/${waiterTestOrderId}/confirm`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(confirmOrderRes.status, 200);
  assert.strictEqual(confirmOrderRes.json.data.status, 'CONFIRMED');

  // Taom statusi PENDING dan ACCEPTED ga o'tganini tekshirish
  const orderItemsInDb = await prisma.orderItem.findMany({ where: { orderId: waiterTestOrderId } });
  assert.ok(orderItemsInDb.every((i) => i.status === 'ACCEPTED'), 'Tasdiqlangach taomlar ACCEPTED bo\'lishi shart');
  console.log('✓ Ofitsiant mehmon buyurtmasini tasdiqladi (NEW -> CONFIRMED, PENDING -> ACCEPTED) (PASSED)');

  // Idempotent qayta tasdiqlash
  const reConfirmRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/orders/${waiterTestOrderId}/confirm`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(reConfirmRes.status, 200);
  assert.strictEqual(reConfirmRes.json.meta.isIdempotentReplay, true);
  console.log('✓ Buyurtmani qayta tasdiqlash idempotent ishlaydi (meta.isIdempotentReplay = true)');

  console.log('\n--- 37. BOSQICH 8: BUYURTMANI SABAB BILAN RAD ETISH (REJECT ORDER) ---');
  // 2-buyurtma
  const guestOrder2Res = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${waiterGuestToken}`,
      'Idempotency-Key': 'idemp-waiter-test-order-2',
    },
    body: JSON.stringify({
      items: [{ menuItemId: currentOrderDish.id, quantity: 1, expectedVersion: currentOrderDish.version }],
    }),
  });
  const order2Json = await guestOrder2Res.json();
  const orderIdToReject = order2Json.data.orderId || order2Json.data.id;

  // Sababsiz rad etish rad etiladi
  const rejectWithoutReason = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/orders/${orderIdToReject}/reject`,
    { reason: '' },
    currentWaiterToken
  );
  assert.strictEqual(rejectWithoutReason.status, 400);

  // Sabab bilan rad etish
  const rejectWithReason = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/orders/${orderIdToReject}/reject`,
    { reason: 'Osh qozonda qolmagan, yangisi 30 daqiqada' },
    currentWaiterToken
  );
  assert.strictEqual(rejectWithReason.status, 200);
  assert.strictEqual(rejectWithReason.json.data.status, 'CANCELLED');

  const rejectedItem = await prisma.orderItem.findFirst({ where: { orderId: orderIdToReject } });
  assert.strictEqual(rejectedItem?.status, 'CANCELLED');
  assert.strictEqual(rejectedItem?.cancellationReason, 'Osh qozonda qolmagan, yangisi 30 daqiqada');
  console.log('✓ Buyurtma sabab bilan rad etildi (CANCELLED va cancellationReason saqlandi) (PASSED)');

  console.log('\n--- 38. BOSQICH 8: TAYYOR TAOMNI YETKAZISH (SERVE ITEM) VA INVARIANT HIMOYA ---');
  const testOrderItemId = orderItemsInDb[0].id;

  // 38.1 ACCEPTED holatidagi taomni SERVED qilishga urinish -> 400 CANNOT_SERVE_UNREADY_ITEM
  const prematureServe = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/items/${testOrderItemId}/serve`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(prematureServe.status, 400, 'Tayyor bo\'lmagan taomni serve qilish rad etilishi shart');
  assert.strictEqual(prematureServe.json.error.code, 'CANNOT_SERVE_UNREADY_ITEM');
  console.log('✓ Kutilganidek: Tayyor bo\'lmagan taomni yetkazilgan deb belgilash rad etildi (400 CANNOT_SERVE_UNREADY_ITEM)');

  // 38.2 Taom oshxonada tayyor (READY) bo'ladi
  await prisma.orderItem.update({
    where: { id: testOrderItemId },
    data: { status: OrderItemStatus.READY },
  });

  // 38.3 Endi ofitsiant taomni mehmonga yetkazadi (SERVED)
  const validServe = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/items/${testOrderItemId}/serve`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(validServe.status, 200);
  assert.strictEqual(validServe.json.data.item.status, 'SERVED');
  assert.strictEqual(validServe.json.data.orderStatus, 'SERVED');
  console.log('✓ READY holatidagi taom muvaffaqiyatli yetkazildi (SERVED) (PASSED)');

  console.log('\n--- 39. BOSQICH 8: OFITSIANTGA TO\'LOV TASDIQLASH HUQUQI BERILMASLIGI (RBAC GUARD) ---');
  const waiterPayAttempt = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/payments`,
    { visitId: waiterVisitId, amountTiyin: '5000000' },
    currentWaiterToken
  );
  assert.strictEqual(waiterPayAttempt.status, 403, 'Waiter payments.record huquqiga ega bo\'lmasligi shart');
  console.log('✓ Kutilganidek: Ofitsiantning to\'lov tasdiqlashga urinishi taqiqlandi (403 FORBIDDEN)');

  // Tozalash
  await prisma.serviceCall.deleteMany({ where: { visitId: waiterVisitId } });
  await prisma.orderItemAddonSnapshot.deleteMany({ where: { orderItem: { restaurantId: restRayhon.id } } });
  await prisma.orderItem.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.order.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.idempotencyRecord.deleteMany();
  await prisma.guestSession.deleteMany({ where: { tableId: waiterTestTable.id } });
  await prisma.visit.deleteMany({ where: { tableId: waiterTestTable.id } });
  await prisma.table.deleteMany({ where: { id: waiterTestTable.id } });
  await prisma.membershipRole.deleteMany({ where: { membershipId: membership2.id } });
  await prisma.restaurantMembership.deleteMany({ where: { id: membership2.id } });
  await prisma.user.deleteMany({ where: { id: waiterUser2.id } });

  console.log('\n--- 40. BOSQICH 9: KDS XODIMLARINI STANSIYALARGA BIRIKTIRISH (STAFF STATION ASSIGNMENTS) ---');
  // 1. Oshpaz va Barman foydalanuvchilarini aniqlash / tayyorlash
  const cookUser = await prisma.user.findUniqueOrThrow({
    where: { phone: '+998906666666' },
  });

  const barmanUser = await prisma.user.upsert({
    where: { phone: '+998906666667' },
    update: {},
    create: {
      phone: '+998906666667',
      passwordHash: cookUser.passwordHash,
      fullName: 'Aziz (Barman)',
    },
  });
  const barmanMembership = await prisma.restaurantMembership.upsert({
    where: { restaurantId_userId: { restaurantId: restRayhon.id, userId: barmanUser.id } },
    update: {},
    create: { restaurantId: restRayhon.id, userId: barmanUser.id },
  });
  await prisma.membershipRole.upsert({
    where: { membershipId_role: { membershipId: barmanMembership.id, role: Role.KITCHEN } },
    update: {},
    create: { membershipId: barmanMembership.id, role: Role.KITCHEN },
  });

  // Stansiyalarni aniqlash
  const kitchenStation = await prisma.preparationStation.findFirstOrThrow({
    where: { restaurantId: restRayhon.id, type: StationType.KITCHEN },
  });
  const barStation = await prisma.preparationStation.findFirstOrThrow({
    where: { restaurantId: restRayhon.id, type: StationType.BAR },
  });

  // Cook login
  const cookLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998906666666',
    password: 'Demo12345!',
  });
  const cookToken = cookLogin.json.data.token;

  // Barman login
  const barmanLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998906666667',
    password: 'Demo12345!',
  });
  const barmanToken = barmanLogin.json.data.token;

  // 40.1 Menejer Oshpazni 'Issiq Oshxona' stansiyasiga biriktiradi
  const assignCookRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/staff/${cookUser.id}/stations`,
    { stationIds: [kitchenStation.id] },
    managerToken
  );
  assert.strictEqual(assignCookRes.status, 200);
  assert.deepStrictEqual(assignCookRes.json.data.assignedStationIds, [kitchenStation.id]);

  // 40.2 Menejer Barmanni 'Ichimliklar Bari' stansiyasiga biriktiradi
  const assignBarmanRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/staff/${barmanUser.id}/stations`,
    { stationIds: [barStation.id] },
    managerToken
  );
  assert.strictEqual(assignBarmanRes.status, 200);
  assert.deepStrictEqual(assignBarmanRes.json.data.assignedStationIds, [barStation.id]);

  // 40.3 Biriktirilgan stansiyalar ro'yxatini tekshirish
  const getCookStations = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/kds/staff/${cookUser.id}/stations`,
    managerToken
  );
  assert.strictEqual(getCookStations.status, 200);
  assert.strictEqual(getCookStations.json.data.length, 1);
  assert.strictEqual(getCookStations.json.data[0].id, kitchenStation.id);

  // 40.4 RBAC Guard: Oddiy oshpaz boshqa xodimni stansiyaga biriktira olmasligi kerak (403)
  const cookAssignAttempt = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/staff/${barmanUser.id}/stations`,
    { stationIds: [barStation.id] },
    cookToken
  );
  assert.strictEqual(cookAssignAttempt.status, 403, 'Cook staff.manage huquqiga ega emas');

  // 40.5 Tenant Guard: Begona stansiya ID sini biriktirish rad etiladi (400)
  const invalidStationAssign = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/staff/${cookUser.id}/stations`,
    { stationIds: ['00000000-0000-0000-0000-000000000000'] },
    managerToken
  );
  assert.strictEqual(invalidStationAssign.status, 400);
  assert.strictEqual(invalidStationAssign.json.error.code, 'INVALID_STATION_TENANT');
  console.log('✓ Xodimlar stansiyalarga xavfsiz biriktirildi va RBAC/Tenant tekshiruvlari o\'tdi (PASSED)');

  console.log('\n--- 41. BOSQICH 9: KDS CHIPTALARI VA STANSIYA ISOLATION TESTI (KITCHEN VS BAR) ---');
  // KDS sinovi uchun alohida stol va tashrif yaratish
  const kdsTable = await prisma.table.create({
    data: {
      restaurantId: restRayhon.id,
      hallId,
      number: 77,
      capacity: 4,
      status: TableStatus.FREE,
      assignedWaiterId: waiterUser.id,
      qrToken: 'qr_rayhon_kds_77',
    },
  });

  const kdsVisitRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/tables/${kdsTable.id}/open-visit`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(kdsVisitRes.status, 201);
  const kdsVisitPin = kdsVisitRes.json.data.pinCode;
  const kdsVisitId = kdsVisitRes.json.data.id;

  // Mehmon sessiyasi
  const kdsGuestJoin = await apiPost(`/api/v1/public/tables/${kdsTable.qrToken}/join`, {
    code: kdsVisitPin,
  });
  assert.strictEqual(kdsGuestJoin.status, 200);
  const kdsGuestToken = kdsGuestJoin.json.data.sessionToken;

  // Taomlarni topish: Osh (Kitchen) va Choy (Bar)
  const oshDish = await prisma.menuItem.findFirstOrThrow({
    where: { restaurantId: restRayhon.id, stationId: kitchenStation.id, isAvailable: true },
  });
  const choyDish = await prisma.menuItem.findFirstOrThrow({
    where: { restaurantId: restRayhon.id, stationId: barStation.id, isAvailable: true },
  });

  // Mehmon buyurtma beradi: 1x Osh (izohli) va 1x Choy (izohli)
  const kdsOrderRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${kdsGuestToken}`,
      'Idempotency-Key': 'idemp-kds-test-order-1',
    },
    body: JSON.stringify({
      orderNotes: 'KDS sinov buyurtmasi',
      items: [
        {
          menuItemId: oshDish.id,
          quantity: 1,
          expectedVersion: oshDish.version,
          notes: "Yog'i kamroq, noxati ko'p bo'lsin",
        },
        {
          menuItemId: choyDish.id,
          quantity: 1,
          expectedVersion: choyDish.version,
          notes: 'Muzdek emas, qaynoq damlansin',
        },
      ],
    }),
  });
  const kdsOrderData = (await kdsOrderRes.json()).data;
  const kdsOrderId = kdsOrderData.orderId || kdsOrderData.id;
  assert.strictEqual(kdsOrderData.status, 'NEW');

  // Ofitsiant buyurtmani tasdiqlaydi (NEW -> CONFIRMED, items: ACCEPTED)
  const confirmKdsOrder = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/orders/${kdsOrderId}/confirm`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(confirmKdsOrder.status, 200);

  // Osh va Choy item ID larini bazadan olish
  const createdItems = await prisma.orderItem.findMany({
    where: { orderId: kdsOrderId },
  });
  const oshItem = createdItems.find((i) => i.menuItemId === oshDish.id)!;
  const choyItem = createdItems.find((i) => i.menuItemId === choyDish.id)!;
  assert.ok(oshItem && choyItem, 'Ikkala taom ham bazada mavjud bo\'lishi kerak');

  // 41.1 Oshpaz KDS chiptalarini so'raydi: Faqat Osh ko'rinishi shart! Choy ko'rinmasligi shart!
  const cookTicketsRes = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/kds/tickets`,
    cookToken
  );
  assert.strictEqual(cookTicketsRes.status, 200);
  const cookTickets = cookTicketsRes.json.data.tickets;
  const cookOrderTicket = cookTickets.find((t: any) => t.orderId === kdsOrderId);
  assert.ok(cookOrderTicket, 'Oshpaz chiptasida buyurtma bo\'lishi kerak');
  assert.strictEqual(cookOrderTicket.items.length, 1, 'Oshpaz faqat oshxona taomini ko\'rishi kerak');
  assert.strictEqual(cookOrderTicket.items[0].id, oshItem.id);
  assert.strictEqual(cookOrderTicket.items[0].notes, "Yog'i kamroq, noxati ko'p bo'lsin", 'Izoh alohida saqlangan bo\'lishi shart');
  assert.strictEqual(cookOrderTicket.items[0].stationId, kitchenStation.id);

  // 41.2 Barman KDS chiptalarini so'raydi: Faqat Choy ko'rinishi shart! Osh ko'rinmasligi shart!
  const barmanTicketsRes = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/kds/tickets`,
    barmanToken
  );
  assert.strictEqual(barmanTicketsRes.status, 200);
  const barmanTickets = barmanTicketsRes.json.data.tickets;
  const barmanOrderTicket = barmanTickets.find((t: any) => t.orderId === kdsOrderId);
  assert.ok(barmanOrderTicket, 'Barman chiptasida buyurtma bo\'lishi kerak');
  assert.strictEqual(barmanOrderTicket.items.length, 1, 'Barman faqat bar taomini ko\'rishi kerak');
  assert.strictEqual(barmanOrderTicket.items[0].id, choyItem.id);
  assert.strictEqual(barmanOrderTicket.items[0].notes, 'Muzdek emas, qaynoq damlansin');
  assert.strictEqual(barmanOrderTicket.items[0].stationId, barStation.id);

  // 41.3 Menejer barcha stansiyalarni ko'ra oladi (Scope cheklovi yo'q)
  const managerTicketsRes = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/kds/tickets`,
    managerToken
  );
  assert.strictEqual(managerTicketsRes.status, 200);
  const managerOrderTicket = managerTicketsRes.json.data.tickets.find((t: any) => t.orderId === kdsOrderId);
  assert.ok(managerOrderTicket);
  assert.strictEqual(managerOrderTicket.items.length, 2, 'Menejer ikkala taomni ham ko\'rishi kerak');
  console.log('✓ Stansiyalar bo\'yicha chiptalar izolyatsiyasi va izohlar saqlanishi to\'liq tasdiqlandi (PASSED)');

  console.log('\n--- 42. BOSQICH 9: STANSIYA XAVFSIZLIK TO\'SIG\'I (STATION ACCESS DENIED GUARD) ---');
  // 42.1 Oshpaz Bar stansiyasidagi Choyni pishirishga urinishi -> 403 STATION_ACCESS_DENIED
  const cookChoyPrepare = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${choyItem.id}/prepare`,
    {},
    cookToken
  );
  assert.strictEqual(cookChoyPrepare.status, 403, 'Oshpaz bar taomini pishirolmasligi shart');
  assert.strictEqual(cookChoyPrepare.json.error.code, 'STATION_ACCESS_DENIED');
  console.log('✓ Kutilganidek: Oshpazning Bar stansiyasiga ruxsatsiz urinishi rad etildi (403 STATION_ACCESS_DENIED)');

  // 42.2 Barman Issiq Oshxona stansiyasidagi Oshni tayyor deb belgilashga urinishi -> 403 STATION_ACCESS_DENIED
  const barmanOshReady = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${oshItem.id}/ready`,
    {},
    barmanToken
  );
  assert.strictEqual(barmanOshReady.status, 403, 'Barman oshxona taomini ready qilolmasligi shart');
  assert.strictEqual(barmanOshReady.json.error.code, 'STATION_ACCESS_DENIED');
  console.log('✓ Kutilganidek: Barmanning Oshxona stansiyasiga ruxsatsiz urinishi rad etildi (403 STATION_ACCESS_DENIED)');

  console.log('\n--- 43. BOSQICH 9: MUSTAQIL SIKL, SIBLING INDEPENDENCE VA DERIVE ORDER STATUS ---');
  // 43.1 Oshpaz Oshni tayyorlashni boshlaydi (ACCEPTED -> PREPARING)
  const oshPrepareRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${oshItem.id}/prepare`,
    { expectedVersion: oshItem.version },
    cookToken
  );
  assert.strictEqual(oshPrepareRes.status, 200);
  assert.strictEqual(oshPrepareRes.json.data.item.status, 'PREPARING');

  // Sibling holatini tekshirish: Choy hali ham ACCEPTED holatida turishi shart!
  const choyCheck1 = await prisma.orderItem.findUniqueOrThrow({ where: { id: choyItem.id } });
  assert.strictEqual(choyCheck1.status, 'ACCEPTED', 'Osh PREPARING bo\'lganda Choy ACCEPTED qolishi shart');

  // Buyurtma holati: PREPARING bo'lishi kerak
  const orderCheck1 = await prisma.order.findUniqueOrThrow({ where: { id: kdsOrderId } });
  assert.strictEqual(orderCheck1.status, 'PREPARING');
  console.log('✓ Osh tayyorlash boshlandi (PREPARING), Choy esa mustaqil ACCEPTED qoldi');

  // 43.2 Oshpaz Oshni tayyor (READY) qiladi
  const oshReadyRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${oshItem.id}/ready`,
    {},
    cookToken
  );
  assert.strictEqual(oshReadyRes.status, 200);
  assert.strictEqual(oshReadyRes.json.data.item.status, 'READY');

  // Sibling holatini tekshirish: Choy hali ham ACCEPTED holatida turishi shart! (Avtomatik ready bo'lmaydi)
  const choyCheck2 = await prisma.orderItem.findUniqueOrThrow({ where: { id: choyItem.id } });
  assert.strictEqual(choyCheck2.status, 'ACCEPTED', 'Bir taom READY bo\'lsa ikkinchisi avtomatik READY bo\'lmasligi shart');

  // Buyurtma holati: PARTIALLY_READY bo'lishi kerak
  const orderCheck2 = await prisma.order.findUniqueOrThrow({ where: { id: kdsOrderId } });
  assert.strictEqual(orderCheck2.status, 'PARTIALLY_READY');
  console.log('✓ Osh READY bo\'ldi, Choy ACCEPTED qoldi, umumiy buyurtma holati PARTIALLY_READY ga o\'tdi (PASSED)');

  console.log('\n--- 44. BOSQICH 9: DERIVE ORDER STATUS QAT\'IYLIGI (SERVED + PREPARING -> PARTIALLY_SERVED) ---');
  // 44.1 Ofitsiant tayyor Oshni mehmonga yetkazadi (READY -> SERVED)
  const serveOshRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/items/${oshItem.id}/serve`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(serveOshRes.status, 200);
  assert.strictEqual(serveOshRes.json.data.item.status, 'SERVED');

  // 44.2 Barman endi Choyni tayyorlashni boshlaydi (ACCEPTED -> PREPARING)
  const choyPrepareRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${choyItem.id}/prepare`,
    {},
    barmanToken
  );
  assert.strictEqual(choyPrepareRes.status, 200);
  assert.strictEqual(choyPrepareRes.json.data.item.status, 'PREPARING');

  // 44.3 Invariant: Osh SERVED, Choy PREPARING -> Buyurtma SERVED emas, balki PARTIALLY_SERVED bo'lishi shart!
  const orderCheck3 = await prisma.order.findUniqueOrThrow({ where: { id: kdsOrderId } });
  assert.strictEqual(orderCheck3.status, 'PARTIALLY_SERVED', 'Bir taom SERVED, boshqasi PREPARING bo\'lsa order SERVED bo\'la olmaydi');
  console.log('✓ Qat\'iy xulosa: Osh SERVED, Choy PREPARING bo\'lganda buyurtma PARTIALLY_SERVED bo\'ldi (SERVED emas) (PASSED)');

  console.log('\n--- 45. BOSQICH 9: "TAYYORLAB BO\'LMAYDI" VA SPISANIE/MENEJER QOIDASI ---');
  // 45.1 ACCEPTED holatidagi yangi taomni bekor qilish (Oshpaz to'g'ridan-to'g'ri sabab bilan bekor qiladi va bildirishnoma yaratiladi)
  const secondOrderRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${kdsGuestToken}`,
      'Idempotency-Key': 'idemp-kds-test-order-2',
    },
    body: JSON.stringify({
      items: [{ menuItemId: oshDish.id, quantity: 1, expectedVersion: oshDish.version }],
    }),
  });
  const secondOrderData = (await secondOrderRes.json()).data;
  const secondOrderId = secondOrderData.orderId || secondOrderData.id;
  await apiPost(`/api/v1/restaurants/${restRayhon.id}/waiter/orders/${secondOrderId}/confirm`, {}, currentWaiterToken);

  const secondOrderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: secondOrderId } });
  assert.strictEqual(secondOrderItem.status, 'ACCEPTED');

  // Sababsiz rad etish -> 400 REASON_REQUIRED
  const emptyReasonRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${secondOrderItem.id}/cannot-prepare`,
    { reason: '   ' },
    cookToken
  );
  assert.strictEqual(emptyReasonRes.status, 400);
  assert.strictEqual(emptyReasonRes.json.error.code, 'REASON_REQUIRED');

  // Sabab bilan rad etish -> 200, CANCELLED va ServiceCall yaratiladi
  const cancelAcceptedRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${secondOrderItem.id}/cannot-prepare`,
    { reason: 'Devzira guruch tugab qoldi' },
    cookToken
  );
  assert.strictEqual(cancelAcceptedRes.status, 200);
  assert.strictEqual(cancelAcceptedRes.json.data.item.status, 'CANCELLED');
  assert.strictEqual(cancelAcceptedRes.json.data.alertCreated, true);

  const secondAlertCall = await prisma.serviceCall.findFirst({
    where: { id: cancelAcceptedRes.json.data.callId },
  });
  assert.ok(secondAlertCall, 'Oshpaz tayyorlab bo\'lmaydi deganda Waiter/Manager uchun alert chaqiruv yaratilishi shart');
  console.log('✓ ACCEPTED taom sabab bilan bekor qilindi va ofitsiantga xabarnoma tushdi (PASSED)');

  // 45.2 PREPARING holatidagi taomni oddiy oshxona xodimi yakka tartibda bekor qila olmasligi (Spisanie/isrof qoidasi)
  // 1-buyurtmadagi Choy hozir PREPARING holatida
  const cookPreparingCancel = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${choyItem.id}/cannot-prepare`,
    { reason: 'Choynak sinib ketdi' },
    barmanToken
  );
  assert.strictEqual(cookPreparingCancel.status, 200);
  assert.strictEqual(cookPreparingCancel.json.data.isCancellationPending, true);
  // Bazada taom statusi hali ham PREPARING bo'lib turishi shart
  const choyAfterCookCancel = await prisma.orderItem.findUniqueOrThrow({ where: { id: choyItem.id } });
  assert.strictEqual(choyAfterCookCancel.status, 'PREPARING', 'PREPARING taomni oddiy oshxona xodimi o\'zboshimchalik bilan bekor qilolmaydi');
  console.log('✓ Kutilganidek: PREPARING holatidagi taom oshpaz tomonidan to\'g\'ridan-to\'g\'ri bekor qilinmadi, menejerga so\'rov yuborildi');

  // 45.3 Menejer kelib PREPARING taomni bekor qilishni tasdiqlaydi
  const managerCancelPreparing = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${choyItem.id}/cannot-prepare`,
    { reason: 'Menejer tasdiqladi: yangi choynak olindi, eski choy bekor qilindi' },
    managerToken
  );
  assert.strictEqual(managerCancelPreparing.status, 200);
  assert.strictEqual(managerCancelPreparing.json.data.item.status, 'CANCELLED');

  // Endi 1-buyurtmada: Osh SERVED bo'lgan, Choy esa CANCELLED bo'ldi.
  // Shuning uchun umumiy buyurtma holati SERVED ga o'tishi kerak!
  const finalOrder1 = await prisma.order.findUniqueOrThrow({ where: { id: kdsOrderId } });
  assert.strictEqual(finalOrder1.status, 'SERVED', 'Bekor qilingan taom chiqarilgach, barcha qolgan taomlar SERVED bo\'lsa order SERVED bo\'lishi shart');
  console.log('✓ Menejer PREPARING taomni bekor qildi va buyurtma to\'liq SERVED holatiga o\'tdi (PASSED)');

  console.log('\n--- 46. BOSQICH 9: CONCURRENCY, VERSION CONFLICT VA IDEMPOTENT REPLAY ---');
  // 3-buyurtma: Versiya ziddiyati va idempotentlikni tekshirish uchun
  const thirdOrderRes = await fetch(`${baseUrl}/api/v1/guest/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${kdsGuestToken}`,
      'Idempotency-Key': 'idemp-kds-test-order-3',
    },
    body: JSON.stringify({
      items: [{ menuItemId: oshDish.id, quantity: 1, expectedVersion: oshDish.version }],
    }),
  });
  const thirdOrderId = (await thirdOrderRes.json()).data.orderId;
  await apiPost(`/api/v1/restaurants/${restRayhon.id}/waiter/orders/${thirdOrderId}/confirm`, {}, currentWaiterToken);
  const thirdOrderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: thirdOrderId } });

  // 46.1 Eskirgan/noto'g'ri versiya bilan prepare yuborish -> 409 ITEM_VERSION_CONFLICT
  const kdsVersionConflictRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${thirdOrderItem.id}/prepare`,
    { expectedVersion: 999 },
    cookToken
  );
  assert.strictEqual(kdsVersionConflictRes.status, 409);
  assert.strictEqual(kdsVersionConflictRes.json.error.code, 'ITEM_VERSION_CONFLICT');
  console.log('✓ Optimistic concurrency ziddiyati aniqlandi (409 ITEM_VERSION_CONFLICT)');

  // 46.2 To'g'ri versiya bilan prepare qilish
  const validPrepare3 = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${thirdOrderItem.id}/prepare`,
    { expectedVersion: thirdOrderItem.version },
    cookToken
  );
  assert.strictEqual(validPrepare3.status, 200);

  // 46.3 Ready qilish
  const ready3Res1 = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${thirdOrderItem.id}/ready`,
    {},
    cookToken
  );
  assert.strictEqual(ready3Res1.status, 200);
  assert.strictEqual(ready3Res1.json.meta.isIdempotentReplay, false);

  // 46.4 Qayta Ready bosilganda Idempotent Replay (200 OK va isIdempotentReplay: true)
  const ready3Res2 = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/kds/items/${thirdOrderItem.id}/ready`,
    {},
    cookToken
  );
  assert.strictEqual(ready3Res2.status, 200);
  assert.strictEqual(ready3Res2.json.meta.isIdempotentReplay, true);
  console.log('✓ Idempotent qayta tayyorlash (ready replay) to\'g\'ri qaytdi (meta.isIdempotentReplay = true) (PASSED)');

  console.log('\n--- 47. BOSQICH 9: OFITSIANT DASHBOARDI VA READY TAOMLAR INTEGRATSIYASI ---');
  // Ofitsiant dashboardini tekshirish: thirdOrderItem READY bo'lgani sababli readyItems da chiqishi shart!
  const waiterDashRes = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/waiter/dashboard`,
    currentWaiterToken
  );
  assert.strictEqual(waiterDashRes.status, 200);
  const readyInWaiter = waiterDashRes.json.data.readyItems.find((i: any) => i.id === thirdOrderItem.id);
  assert.ok(readyInWaiter, 'KDS da READY qilingan taom Ofitsiant dashboardida chiqishi shart');
  assert.strictEqual(readyInWaiter.status, 'READY');

  // Ofitsiant ushbu taomni yetkazadi (SERVED)
  const serveThirdRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/waiter/items/${thirdOrderItem.id}/serve`,
    {},
    currentWaiterToken
  );
  assert.strictEqual(serveThirdRes.status, 200);
  assert.strictEqual(serveThirdRes.json.data.item.status, 'SERVED');
  console.log('✓ KDS da READY bo\'lgan taom ofitsiant panelida ko\'rindi va muvaffaqiyatli yetkazildi (SERVED) (PASSED)');

  console.log('\n--- 48. BOSQICH 10: TRANSACTIONAL OUTBOX PATTERN VA ROLLBACK KAFOLATI ---');
  // 48.1 Tranzaksiya rollback bo'lganda OutboxEvent saqlanmasligi shart (Rollback kafolati)
  const marker = 'rollback-test-' + Date.now();
  let rollbackCaught = false;
  try {
    await prisma.$transaction(async (tx) => {
      await recordOutboxEvent(tx, {
        restaurantId: restRayhon.id,
        eventType: 'order.created',
        data: { testMarker: marker },
      });
      throw new Error('INTENTIONAL_ROLLBACK');
    });
  } catch (err: any) {
    if (err.message === 'INTENTIONAL_ROLLBACK') rollbackCaught = true;
  }
  assert.strictEqual(rollbackCaught, true);

  const ghostEvent = await prisma.outboxEvent.findFirst({
    where: {
      restaurantId: restRayhon.id,
      eventType: 'order.created',
      payloadJson: {
        path: ['data', 'testMarker'],
        equals: marker,
      },
    },
  });
  assert.strictEqual(ghostEvent, null, 'Rollback bo\'lgan tranzaksiyadan outbox event bazaga saqlanmasligi shart');
  console.log('✓ Transactional Outbox kafolati: Rollback qilingan tranzaksiya outbox eventi yaratmadi (PASSED)');

  // 48.2 Commit qilinganda PENDING holatda yaratilishi va worker orqali PROCESSED bo'lishi
  const committedOutbox = await prisma.$transaction(async (tx) => {
    return recordOutboxEvent(tx, {
      restaurantId: restRayhon.id,
      eventType: 'table.state_changed',
      data: { tableNumber: 77, status: 'FREE' },
      scope: { tableId: kdsTable.id },
    });
  });
  assert.strictEqual(committedOutbox.status, 'PENDING');

  const processedCount = await outboxService.processPending();
  assert.ok(processedCount >= 1, 'Kamida bitta pending event qayta ishlanishi shart');

  const updatedOutbox = await prisma.outboxEvent.findUniqueOrThrow({
    where: { id: committedOutbox.id },
  });
  assert.strictEqual(updatedOutbox.status, 'PROCESSED');
  assert.ok(updatedOutbox.processedAt !== null);
  console.log('✓ OutboxService worker PENDING eventni PROCESSED holatiga o\'tkazdi (PASSED)');

  console.log('\n--- 49. BOSQICH 10: SSE ENDPOINTLAR XAVFSIZLIGI VA PROTOKOL STANDARTI ---');
  // 49.1 Autentifikatsiyasiz staff SSE -> 401
  const unauthStaffSse = await fetch(`${baseUrl}/api/v1/restaurants/${restRayhon.id}/events`);
  assert.strictEqual(unauthStaffSse.status, 401);

  // 49.2 Sessiyasiz guest SSE -> 401
  const unauthGuestSse = await fetch(`${baseUrl}/api/v1/guest/events`);
  assert.strictEqual(unauthGuestSse.status, 401);

  // 49.3 Begona restoran xodimi (Cross-tenant) -> 404 (requireTenant tenant izolyatsiyasi)
  const crossTenantSse = await fetch(`${baseUrl}/api/v1/restaurants/${restGijduvon.id}/events`, {
    headers: { Authorization: `Bearer ${currentWaiterToken}` },
  });
  assert.strictEqual(crossTenantSse.status, 404);
  console.log('✓ SSE xavfsizligi: Autentifikatsiyasiz va begona restoranga ulanishlar to\'g\'ri rad etildi (401/404) (PASSED)');

  // 49.4 Authenticated Staff SSE ulanishi (200 OK + text/event-stream)
  const staffAbort = new AbortController();
  const staffSseRes = await fetch(`${baseUrl}/api/v1/restaurants/${restRayhon.id}/events`, {
    headers: { Authorization: `Bearer ${currentWaiterToken}` },
    signal: staffAbort.signal,
  });
  assert.strictEqual(staffSseRes.status, 200);
  assert.ok(staffSseRes.headers.get('content-type')?.includes('text/event-stream'));
  staffAbort.abort();

  // 49.5 Authenticated Guest SSE ulanishi (200 OK + text/event-stream)
  const guestAbort = new AbortController();
  const guestSseRes = await fetch(`${baseUrl}/api/v1/guest/events?token=${kdsGuestToken}`, {
    signal: guestAbort.signal,
  });
  assert.strictEqual(guestSseRes.status, 200);
  assert.ok(guestSseRes.headers.get('content-type')?.includes('text/event-stream'));
  guestAbort.abort();
  console.log('✓ Staff va Guest SSE ulanishlari to\'g\'ri protokollar (200, text/event-stream) bilan muvaffaqiyatli o\'rnatildi (PASSED)');

  console.log('\n--- 50. BOSQICH 10: AUDIENCE VA SCOPE IZOLYATSIYASI (KITCHEN MOLIYADAN TO\'SILGAN, STANSIYA VA MEHMON IZOLYATSIYASI) ---');
  function createMockSseResponse() {
    const writtenChunks: string[] = [];
    let isClosed = false;
    const res: any = {
      write: (chunk: string) => {
        writtenChunks.push(chunk);
        return true;
      },
      end: () => {
        isClosed = true;
      },
      on: () => {},
    };
    return { res, writtenChunks, getClosed: () => isClosed };
  }

  const mockCook = createMockSseResponse();
  const mockBarman = createMockSseResponse();
  const mockWaiter = createMockSseResponse();
  const mockGuest = createMockSseResponse();
  const mockForeignGuest = createMockSseResponse();

  // Klientlarni ro'yxatdan o'tkazish
  realtimeService.registerStaffClient({
    id: 'test-cook-client',
    res: mockCook.res,
    userId: cookUser.id,
    restaurantId: restRayhon.id,
    roles: [Role.KITCHEN],
    permissions: ['items.prepare'],
    stationIds: [kitchenStation.id],
    isManager: false,
    connectedAt: new Date(),
  });

  realtimeService.registerStaffClient({
    id: 'test-barman-client',
    res: mockBarman.res,
    userId: barmanUser.id,
    restaurantId: restRayhon.id,
    roles: [Role.KITCHEN],
    permissions: ['items.prepare'],
    stationIds: [barStation.id],
    isManager: false,
    connectedAt: new Date(),
  });

  realtimeService.registerStaffClient({
    id: 'test-waiter-client',
    res: mockWaiter.res,
    userId: waiterUser.id,
    restaurantId: restRayhon.id,
    roles: [Role.WAITER],
    permissions: ['orders.confirm', 'items.serve', 'calls.claim'],
    isManager: false,
    connectedAt: new Date(),
  });

  realtimeService.registerGuestClient({
    id: 'test-kds-guest',
    res: mockGuest.res,
    restaurantId: restRayhon.id,
    tableId: kdsTable.id,
    visitId: kdsVisitId,
    connectedAt: new Date(),
  });

  realtimeService.registerGuestClient({
    id: 'test-foreign-guest',
    res: mockForeignGuest.res,
    restaurantId: restRayhon.id,
    tableId: 'foreign-table-id',
    visitId: 'foreign-visit-id',
    connectedAt: new Date(),
  });

  // 50.1 Moliyaviy event: Oshxona xodimlari (Cook/Barman) ASLO olmasligi shart
  const financialEvent: any = {
    id: 'evt-finance-test-1',
    type: 'payment.recorded',
    restaurantId: restRayhon.id,
    createdAt: new Date().toISOString(),
    data: { amountTiyin: '5000000', visitId: kdsVisitId },
    scope: { visitId: kdsVisitId, isFinancial: true },
  };
  realtimeService.broadcastEvent(financialEvent);

  const cookReceivedFinance = mockCook.writtenChunks.some((c) => c.includes('evt-finance-test-1'));
  const barmanReceivedFinance = mockBarman.writtenChunks.some((c) => c.includes('evt-finance-test-1'));
  const waiterReceivedFinance = mockWaiter.writtenChunks.some((c) => c.includes('evt-finance-test-1'));
  assert.strictEqual(cookReceivedFinance, false, 'Oshxona (Cook) moliyaviy eventni olmasligi shart');
  assert.strictEqual(barmanReceivedFinance, false, 'Barman moliyaviy eventni olmasligi shart');
  assert.strictEqual(waiterReceivedFinance, true, 'Ofitsiant/Menejer moliyaviy yangilanishni qabul qilishi kerak');
  console.log('✓ Xavfsizlik isboti: Oshxona xodimlariga (Cook/Barman) moliyaviy eventlar uzatilmadi (PASSED)');

  // 50.2 Stansiya izolyatsiyasi: Faqat biriktirilgan stansiyaga yuboriladi
  const kitchenFoodEvent: any = {
    id: 'evt-station-food-1',
    type: 'item.state_changed',
    restaurantId: restRayhon.id,
    createdAt: new Date().toISOString(),
    data: { itemId: 'item-food', status: 'READY' },
    scope: { stationId: kitchenStation.id, visitId: kdsVisitId },
  };
  realtimeService.broadcastEvent(kitchenFoodEvent);

  const cookReceivedFood = mockCook.writtenChunks.some((c) => c.includes('evt-station-food-1'));
  const barmanReceivedFood = mockBarman.writtenChunks.some((c) => c.includes('evt-station-food-1'));
  assert.strictEqual(cookReceivedFood, true, 'Oshpaz o\'z stansiyasi taomini olishi shart');
  assert.strictEqual(barmanReceivedFood, false, 'Barman oshxona taomi eventini olmasligi shart (Stansiya izolyatsiyasi)');
  console.log('✓ Stansiya izolyatsiyasi isboti: Barman o\'ziga biriktirilmagan stansiya eventlarini olmadi (PASSED)');

  // 50.3 Mehmon izolyatsiyasi: Faqat o'z tashrifi eventlarini oladi
  const guestSpecificEvent: any = {
    id: 'evt-guest-call-1',
    type: 'call.created',
    restaurantId: restRayhon.id,
    createdAt: new Date().toISOString(),
    data: { type: 'WAITER', visitId: kdsVisitId },
    scope: { visitId: kdsVisitId },
  };
  realtimeService.broadcastEvent(guestSpecificEvent);

  const kdsGuestReceived = mockGuest.writtenChunks.some((c) => c.includes('evt-guest-call-1'));
  const foreignGuestReceived = mockForeignGuest.writtenChunks.some((c) => c.includes('evt-guest-call-1'));
  assert.strictEqual(kdsGuestReceived, true, 'Stoldagi mehmon o\'z tashrifi eventini olishi shart');
  assert.strictEqual(foreignGuestReceived, false, 'Begona mehmon boshqa stol/tashrif eventini olmasligi shart (Tashrif izolyatsiyasi)');
  console.log('✓ Mehmon izolyatsiyasi isboti: Boshqa tashrifdagi mehmon begonaning eventlarini olmadi (PASSED)');

  console.log('\n--- 51. BOSQICH 10: XODIM HUQUQI BEKOR BO\'LGANDA SSE ULANISHINI DARHOL UZISH (ACCESS.REVOKED) ---');
  assert.strictEqual(mockCook.getClosed(), false);
  realtimeService.closeUserConnections(cookUser.id);
  assert.strictEqual(mockCook.getClosed(), true, 'closeUserConnections chaqirilganda SSE ulanishi darhol yopilishi (res.end) shart');
  const revocationMessageSent = mockCook.writtenChunks.some((c) => c.includes('access.revoked'));
  assert.strictEqual(revocationMessageSent, true, 'SSE klientiga uzilishdan avval access.revoked hodisasi yuborilishi shart');
  console.log('✓ Xodim huquqlari bekor qilinganda SSE ulanishi darhol uzildi va access.revoked yuborildi (PASSED)');

  console.log('\n--- 52. BOSQICH 10: CURSOR REPLAY VA QAYTA ULANISH (LAST-EVENT-ID / GETMISSEDEVENTS) ---');
  const evt1 = await prisma.outboxEvent.create({
    data: {
      restaurantId: restRayhon.id,
      eventType: 'menu.updated',
      payloadJson: { data: { version: 101 }, scope: {} },
      status: 'PROCESSED',
    },
  });
  const evt2 = await prisma.outboxEvent.create({
    data: {
      restaurantId: restRayhon.id,
      eventType: 'menu.updated',
      payloadJson: { data: { version: 102 }, scope: {} },
      status: 'PROCESSED',
    },
  });

  const replayResult = await outboxService.getMissedEvents(restRayhon.id, evt1.id);
  assert.strictEqual(replayResult.syncRequired, false);
  const foundMissed = replayResult.events.find((e) => e.id === evt2.id);
  assert.ok(foundMissed, 'Cursor replay orqali o\'tkazib yuborilgan evt2 muvaffaqiyatli qaytarilishi shart');

  const invalidReplay = await outboxService.getMissedEvents(restRayhon.id, 'non-existent-event-id');
  assert.strictEqual(invalidReplay.syncRequired, true, 'Topilmagan lastEventId to\'liq REST sync talab qilishi shart');
  console.log('✓ Last-Event-ID cursor replay va to\'liq REST sync bayrog\'i muvaffaqiyatli tekshirildi (PASSED)');

  console.log('\n--- 53. BOSQICH 10: MOLIYA REST ENDPOINTLARI VA TRANSAKSION OUTBOX INTEGRATSIYASI ---');
  // 53.1 Waiter to'lov yoza olmasligi kerak (403 FORBIDDEN)
  const waiterPaymentAttempt = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/payments`,
    {
      visitId: kdsVisitId,
      amountTiyin: '4500000',
      method: 'CASH',
    },
    currentWaiterToken
  );
  assert.strictEqual(waiterPaymentAttempt.status, 403, 'Ofitsiant to\'lov yoza olmasligi kerak (403)');

  // 53.2 Kassir to'lovni yozadi (200 OK + payment.recorded va bill.updated OutboxEvent yaratilishi)
  const cashierPaymentRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/payments`,
    {
      visitId: kdsVisitId,
      amountTiyin: '4500000',
      method: 'CASH',
    },
    cashierToken
  );
  assert.strictEqual(cashierPaymentRes.status, 200);
  const paymentRecord = cashierPaymentRes.json.data;
  assert.ok(paymentRecord.id);
  assert.strictEqual(paymentRecord.amountTiyin, '4500000');

  const paymentOutbox = await prisma.outboxEvent.findFirst({
    where: {
      restaurantId: restRayhon.id,
      eventType: 'payment.recorded',
      payloadJson: {
        path: ['data', 'paymentId'],
        equals: paymentRecord.id,
      },
    },
  });
  assert.ok(paymentOutbox, 'To\'lov yozilganda tranzaksiya ichida payment.recorded OutboxEvent yaratilishi shart');

  // 53.3 Kassir refund tasdiqlay olmasligi kerak (403 FORBIDDEN)
  const cashierRefundAttempt = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/refunds`,
    {
      paymentId: paymentRecord.id,
      amountTiyin: '4500000',
      reason: 'Kassir ruxsatsiz qaytarish urinishi',
    },
    cashierToken
  );
  assert.strictEqual(cashierRefundAttempt.status, 403, 'Kassir refund tasdiqlay olmasligi kerak (403)');

  // 53.4 Menejer refundni tasdiqlaydi (200 OK + refund.recorded va bill.updated OutboxEvent yaratilishi)
  const managerRefundRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/refunds`,
    {
      paymentId: paymentRecord.id,
      amountTiyin: '4500000',
      reason: 'Mehmon buyurtmasi bekor qilindi, pul qaytarildi',
    },
    managerToken
  );
  assert.strictEqual(managerRefundRes.status, 200);
  const refundRecord = managerRefundRes.json.data;
  assert.ok(refundRecord.id);

  const refundOutbox = await prisma.outboxEvent.findFirst({
    where: {
      restaurantId: restRayhon.id,
      eventType: 'refund.recorded',
      payloadJson: {
        path: ['data', 'refundId'],
        equals: refundRecord.id,
      },
    },
  });
  assert.ok(refundOutbox, 'Qaytarish tasdiqlanganda refund.recorded OutboxEvent yaratilishi shart');
  console.log('✓ To\'lov va qaytarish (refund) endpointlari RBAC va tranzaksion outbox bilan to\'liq tekshirildi (PASSED)');

  // Tozalash amallari
  await prisma.refund.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.payment.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.outboxEvent.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.staffStationAssignment.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.serviceCall.deleteMany({ where: { tableId: kdsTable.id } });
  await prisma.guestSession.deleteMany({ where: { tableId: kdsTable.id } });
  await prisma.orderItemAddonSnapshot.deleteMany({ where: { orderItem: { restaurantId: restRayhon.id } } });
  await prisma.orderItem.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.order.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.visit.deleteMany({ where: { tableId: kdsTable.id } });
  await prisma.table.deleteMany({ where: { id: kdsTable.id } });
  await prisma.membershipRole.deleteMany({ where: { membershipId: barmanMembership.id } });
  await prisma.restaurantMembership.deleteMany({ where: { id: barmanMembership.id } });
  await prisma.user.deleteMany({ where: { id: barmanUser.id } });

  console.log('\n--- 54-62. BOSQICH 11: KASSA VA MOLIYAVIY DOMEN (BILLING, CONCURRENCY, SHIFTS, INVARIANTS) ---');

  // 54.0 Section 11 uchun toza yangi tokenlar va sozlamalarni tiklash
  await prisma.restaurant.update({
    where: { id: restRayhon.id },
    data: {
      serviceChargeBps: 1000,
      name: 'Rayhon Milliy Taomlar',
      subscriptionPlan: 'BUSINESS',
      allowedRoles: ['BOSS', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER', 'GUEST'],
    },
  });

  const freshWaiterLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998905555555',
    password: 'Demo12345!',
  });
  assert.strictEqual(freshWaiterLogin.status, 200);
  const sec11WaiterToken = freshWaiterLogin.json.data.token;

  const freshCashierLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998904444444',
    password: 'Demo12345!',
  });
  assert.strictEqual(freshCashierLogin.status, 200);
  const sec11CashierToken = freshCashierLogin.json.data.token;

  const freshManagerLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998903333333',
    password: 'Demo12345!',
  });
  assert.strictEqual(freshManagerLogin.status, 200);
  const sec11ManagerToken = freshManagerLogin.json.data.token;

  // 54.1 Test Table, Kategoriya va Taomlar tayyorlash
  const testCat = await prisma.category.findFirst({ where: { restaurantId: restRayhon.id } });
  assert.ok(testCat, 'Restoran kategoriyasi mavjud bo\'lishi kerak');
  const testHall = await prisma.hall.findFirst({ where: { restaurantId: restRayhon.id } });
  assert.ok(testHall, 'Restoran zali mavjud bo\'lishi kerak');
  const testStation = await prisma.preparationStation.findFirst({ where: { restaurantId: restRayhon.id } });
  assert.ok(testStation, 'Tayyorlash stansiyasi mavjud bo\'lishi kerak');

  const billingTable = await prisma.table.create({
    data: {
      restaurantId: restRayhon.id,
      hallId: testHall.id,
      number: 88,
      capacity: 6,
      status: TableStatus.FREE,
      qrToken: 'test-billing-table-88',
    },
  });

  const dish1 = await prisma.menuItem.create({
    data: {
      restaurantId: restRayhon.id,
      name: 'Devzira Osh (Step 11 Test)',
      basePriceTiyin: 5000000n, // 50 000 UZS
      isAvailable: true,
      categoryId: testCat.id,
      stationId: testStation.id,
    },
  });

  const dish2 = await prisma.menuItem.create({
    data: {
      restaurantId: restRayhon.id,
      name: 'Qozon Kabob (Step 11 Test)',
      basePriceTiyin: 3000000n, // 30 000 UZS
      isAvailable: true,
      categoryId: testCat.id,
      stationId: testStation.id,
    },
  });

  const dish3 = await prisma.menuItem.create({
    data: {
      restaurantId: restRayhon.id,
      name: 'Achichuk Salati (Step 11 Test)',
      basePriceTiyin: 2000000n, // 20 000 UZS
      isAvailable: true,
      categoryId: testCat.id,
      stationId: testStation.id,
    },
  });

  const dish4 = await prisma.menuItem.create({
    data: {
      restaurantId: restRayhon.id,
      name: 'Bekor Qilinadigan Taom (Step 11 Test)',
      basePriceTiyin: 4000000n, // 40 000 UZS
      isAvailable: true,
      categoryId: testCat.id,
      stationId: testStation.id,
    },
  });

  // 54.2 Tashrif ochish (service charge snapshot: 1000 bps)
  const openBillingVisitRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/tables/${billingTable.id}/open-visit`,
    {},
    sec11WaiterToken
  );
  assert.strictEqual(openBillingVisitRes.status, 201);
  const billingVisitId = openBillingVisitRes.json.data.id;

  // 54.3 Buyurtma yaratish: 4 xil taom
  // Item 1: 50 000 x 2 = 100 000 UZS (10 000 000 tiyin)
  // Item 2: 30 000 x 1 + 5 000 addon = 35 000 UZS (3 500 000 tiyin)
  // Item 3: 20 000 x 1 = 20 000 UZS (2 000 000 tiyin)
  // Item 4: 40 000 x 1 (CANCELLED bo'ladi)
  const order1 = await prisma.order.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: billingVisitId,
      orderNumber: 101,
      status: OrderStatus.CONFIRMED,
      createdByRole: 'WAITER',
      items: {
        create: [
          {
            menuItemId: dish1.id,
            stationId: testStation.id,
            snapshotName: dish1.name,
            snapshotPriceTiyin: 5000000n,
            quantity: 2,
            status: OrderItemStatus.SERVED,
          },
          {
            menuItemId: dish2.id,
            stationId: testStation.id,
            snapshotName: dish2.name,
            snapshotPriceTiyin: 3000000n,
            quantity: 1,
            status: OrderItemStatus.SERVED,
            addonSnapshots: {
              create: [
                {
                  name: 'Qo\'shimcha Qazi',
                  priceTiyin: 500000n,
                },
              ],
            },
          },
          {
            menuItemId: dish3.id,
            stationId: testStation.id,
            snapshotName: dish3.name,
            snapshotPriceTiyin: 2000000n,
            quantity: 1,
            status: OrderItemStatus.SERVED,
          },
          {
            menuItemId: dish4.id,
            stationId: testStation.id,
            snapshotName: dish4.name,
            snapshotPriceTiyin: 4000000n,
            quantity: 1,
            status: OrderItemStatus.CANCELLED,
          },
        ],
      },
    },
  });
  assert.ok(order1.id);

  // 54.4 Chegirma qo'shish (10% percent discount)
  // Subtotal = 10 000 000 + 3 500 000 + 2 000 000 = 15 500 000 tiyin (CANCELLED taom hisobga kirmaydi)
  // 10% discount: 1 550 000 tiyin
  const addDiscountRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/adjustments`,
    {
      visitId: billingVisitId,
      type: 'DISCOUNT',
      percentageBps: 1000,
      amountTiyin: '1550000',
      reason: '10% doimiy mijoz chegirmasi',
    },
    sec11ManagerToken
  );
  assert.strictEqual(addDiscountRes.status, 200);

  // 54.5 Tashrif jonli hisob varaqasini olish va formulani tiyingacha tekshirish
  const billCheckRes = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}`,
    sec11CashierToken
  );
  assert.strictEqual(billCheckRes.status, 200);
  const billData = billCheckRes.json.data.bill;

  // Formula Invariantlari tekshiruvi:
  // 1. subtotal: 15 500 000 tiyin
  assert.strictEqual(billData.subtotalTiyin, '15500000', 'Subtotal faqat non-cancelled itemlar bo\'lishi shart');
  // 2. discount: 1 550 000 tiyin (capped at subtotal)
  assert.strictEqual(billData.discountTiyin, '1550000', 'Chegirma food subtotalning 10% bo\'lishi shart');
  // 3. discountedSubtotal: 13 950 000 tiyin
  assert.strictEqual(billData.discountedSubtotalTiyin, '13950000');
  // 4. serviceFee: chegirmadan KEYINGI food subtotalning 10% i: (13 950 000 * 1000 + 5000) / 10000 = 1 395 000 tiyin!
  assert.strictEqual(billData.serviceChargeTiyin, '1395000', 'Xizmat haqi chegirmadan keyingi subtotaldan hisoblanishi shart');
  // 5. totalDue: 13 950 000 + 1 395 000 = 15 345 000 tiyin
  assert.strictEqual(billData.totalDueTiyin, '15345000', 'Jami to\'lov summasi to\'g\'ri hisoblanishi shart');
  assert.strictEqual(billData.netPaidTiyin, '0');
  assert.strictEqual(billData.balanceTiyin, '15345000');
  assert.strictEqual(billData.isFullyPaid, false);
  assert.strictEqual(billData.isRefundDue, false);
  console.log('✓ Section 54: Bill calculation formulasi tiyingacha to\'liq tekshirildi (PASSED)');

  // 55. Shift Lifecycle & Cash Reconciliation
  // Avvalgi ochiq smenalarni tozalab olamiz
  await prisma.shift.deleteMany({ where: { restaurantId: restRayhon.id } });

  // 55.1 Faol smenasiz to'lov qilishga urinish -> 400 CASHIER_SHIFT_REQUIRED
  const payNoShift = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/payments`,
    {
      visitId: billingVisitId,
      amountTiyin: '5000000',
      method: 'CASH',
    },
    sec11CashierToken
  );
  assert.strictEqual(payNoShift.status, 400);
  assert.strictEqual(payNoShift.json.error.code, 'CASHIER_SHIFT_REQUIRED');

  // 55.2 Kassir smena ochadi: 500 000 UZS (50 000 000 tiyin)
  const openShiftRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/shifts/open`,
    {
      startingCashTiyin: '50000000',
      notes: 'Test smena 1',
    },
    sec11CashierToken
  );
  assert.strictEqual(openShiftRes.status, 201);
  const testShift1 = openShiftRes.json.data;
  assert.strictEqual(testShift1.startingCashTiyin, '50000000');

  // 55.3 Kassa harakatlari (CASH_IN va CASH_OUT)
  const cashInRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/shifts/cash-movement`,
    {
      shiftId: testShift1.id,
      type: 'CASH_IN',
      amountTiyin: '5000000', // 50 000 UZS
      reason: 'Mayda pul fondi',
    },
    sec11CashierToken
  );
  assert.strictEqual(cashInRes.status, 201);

  const cashOutRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/shifts/cash-movement`,
    {
      shiftId: testShift1.id,
      type: 'CASH_OUT',
      amountTiyin: '2000000', // 20 000 UZS
      reason: 'Xo\'jalik xarajati',
    },
    sec11CashierToken
  );
  assert.strictEqual(cashOutRes.status, 201);

  // Smena hisobotini tekshirish: 50 000 000 + 5 000 000 - 2 000 000 = 53 000 000 tiyin
  const shiftSumRes1 = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/shifts/current`,
    sec11CashierToken
  );
  assert.strictEqual(shiftSumRes1.status, 200);
  assert.strictEqual(shiftSumRes1.json.data.metrics.expectedCashTiyin, '53000000');

  // 55.4 Smenani sanalgan pul bilan yopish va difference = 0 ni tekshirish
  const closeShiftRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/shifts/${testShift1.id}/close`,
    {
      countedCashTiyin: '53000000',
      notes: 'Smena muvaffaqiyatli topshirildi',
    },
    sec11CashierToken
  );
  assert.strictEqual(closeShiftRes.status, 200);
  assert.strictEqual(closeShiftRes.json.data.status, 'CLOSED');
  assert.strictEqual(closeShiftRes.json.data.differenceTiyin, '0');

  // Asosiy to'lov testlari uchun yangi faol smena ochamiz
  const activeShiftRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/shifts/open`,
    {
      startingCashTiyin: '100000000', // 1 000 000 UZS
      notes: 'Asosiy kassa smenasi',
    },
    sec11CashierToken
  );
  assert.strictEqual(activeShiftRes.status, 201);
  console.log('✓ Section 55: Kassa smenasi ochish, kassa harakati va reconcile to\'liq tekshirildi (PASSED)');

  // 56. Concurrency / Row-level Lock (SELECT FOR UPDATE) & Overpayment Rejection
  // Balance: 15 345 000 tiyin.
  // Bir vaqtning o'zida ikkita parallel 10 000 000 tiyin to'lov yuboriladi:
  // Jami: 20 000 000 > 15 345 000 bo'lgani uchun, faqat bittasi yutadi, ikkinchisi 400 OVERPAYMENT_REJECTED oladi!
  const [concP1, concP2] = await Promise.all([
    apiPost(
      `/api/v1/restaurants/${restRayhon.id}/billing/payments`,
      {
        visitId: billingVisitId,
        amountTiyin: '10000000',
        method: 'CASH',
        idempotencyKey: 'conc-test-key-p1',
      },
      sec11CashierToken
    ),
    apiPost(
      `/api/v1/restaurants/${restRayhon.id}/billing/payments`,
      {
        visitId: billingVisitId,
        amountTiyin: '10000000',
        method: 'CASH',
        idempotencyKey: 'conc-test-key-p2',
      },
      sec11CashierToken
    ),
  ]);

  const successP = concP1.status === 200 ? concP1 : concP2;
  const rejectedP = concP1.status === 200 ? concP2 : concP1;

  assert.strictEqual(successP.status, 200, 'Bitta to\'lov muvaffaqiyatli qabul qilinishi kerak');
  assert.strictEqual(rejectedP.status, 400, 'Ikkinchi parallel to\'lov rad etilishi kerak');
  assert.ok(
    rejectedP.json.error.code === 'OVERPAYMENT_REJECTED' ||
    rejectedP.json.error.message.includes('OVERPAYMENT_REJECTED')
  );

  // Bazadagi balansni tekshirish: 15 345 000 - 10 000 000 = 5 345 000 tiyin qoldi
  const billAfterConc = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}`,
    sec11CashierToken
  );
  assert.strictEqual(billAfterConc.json.data.bill.balanceTiyin, '5345000');
  console.log('✓ Section 56: Concurrency row-level lock va overpayment rejection tekshirildi (PASSED)');

  // 57. Cash Tendered vs Posted Revenue & Change Calculation
  // 50 000 UZS (5 000 000 tiyin) to'lov uchun mijoz 100 000 UZS (10 000 000 tiyin) berdi, qaytim 50 000 UZS (5 000 000 tiyin)
  const tenderPayRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/payments`,
    {
      visitId: billingVisitId,
      amountTiyin: '5000000',
      method: 'CASH',
      tenderedCashTiyin: '10000000',
      changeTiyin: '5000000',
      idempotencyKey: 'tender-test-key-1',
    },
    sec11CashierToken
  );
  assert.strictEqual(tenderPayRes.status, 200);
  const tenderPayment = tenderPayRes.json.data;
  assert.strictEqual(tenderPayment.amountTiyin, '5000000');
  assert.strictEqual(tenderPayment.tenderedCashTiyin, '10000000');
  assert.strictEqual(tenderPayment.changeTiyin, '5000000');

  // Smena hisobotida qaytim daromadga kirmaganini va tushum faqat 5 000 000 ekanini tekshiramiz
  const shiftSumRes2 = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/shifts/current`,
    sec11CashierToken
  );
  // Birinchi 10 000 000 + ikkinchi 5 000 000 = 15 000 000 naqd tushum
  assert.strictEqual(shiftSumRes2.json.data.metrics.cashReceiptsTiyin, '15000000');
  console.log('✓ Section 57: Cash tendered va qaytim daromaddan ajratilishi to\'liq tasdiqlandi (PASSED)');

  // 58. Payment Reversal (Xato to'lovni bekor qilish)
  // Oxirgi 5 000 000 tiyinlik to'lovni reversal qilamiz
  const reverseRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/payments/${tenderPayment.id}/reverse`,
    { reason: 'Kassir tomonidan xato summa kiritilgan' },
    sec11CashierToken
  );
  assert.strictEqual(reverseRes.status, 200);
  assert.strictEqual(reverseRes.json.data.status, 'REVERSED');

  // Balans qayta tiklanganini tekshiramiz: 5 345 000 tiyinga qaytdi
  const billAfterReverse = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}`,
    sec11CashierToken
  );
  assert.strictEqual(billAfterReverse.json.data.bill.balanceTiyin, '5345000');

  // Takroriy reversal rad etilishi kerak
  const dupReverse = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/payments/${tenderPayment.id}/reverse`,
    { reason: 'Takroriy bekor qilish' },
    sec11CashierToken
  );
  assert.strictEqual(dupReverse.status, 400);
  assert.strictEqual(dupReverse.json.error.code, 'PAYMENT_ALREADY_REVERSED');

  // Smena naqd puli kamayganini tekshiramiz
  const shiftSumRes3 = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/shifts/current`,
    sec11CashierToken
  );
  assert.strictEqual(shiftSumRes3.json.data.metrics.cashReversalsTiyin, '5000000');
  console.log('✓ Section 58: To\'lovni bekor qilish (reversal) va balans tiklanishi tekshirildi (PASSED)');

  // 59. Split Payments (Qoldiq 5 345 000 tiyin: 2 000 000 naqd + 3 345 000 terminal)
  const splitP1 = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/payments`,
    {
      visitId: billingVisitId,
      amountTiyin: '2000000',
      method: 'CASH',
      idempotencyKey: 'split-p1-key',
    },
    sec11CashierToken
  );
  assert.strictEqual(splitP1.status, 200);

  const splitP2 = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/payments`,
    {
      visitId: billingVisitId,
      amountTiyin: '3345000',
      method: 'TERMINAL',
      idempotencyKey: 'split-p2-key',
    },
    sec11CashierToken
  );
  assert.strictEqual(splitP2.status, 200);

  // Endi qoldiq 0 bo'lishi va isFullyPaid = true bo'lishi shart
  const billAfterSplit = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}`,
    sec11CashierToken
  );
  assert.strictEqual(billAfterSplit.json.data.bill.balanceTiyin, '0');
  assert.strictEqual(billAfterSplit.json.data.bill.isFullyPaid, true);
  assert.strictEqual(billAfterSplit.json.data.bill.isRefundDue, false);
  console.log('✓ Section 59: Split payments (naqd + terminal) va to\'liq yopilish tekshirildi (PASSED)');

  // 60. Negative Balance & Refund Due State (Ortiqcha to'lov holati)
  // Tashrif to'liq to'langandan so'ng qo'shimcha 1 000 000 tiyinlik flat discount qo'shiladi.
  // Invariant: Taom summasi 1 000 000 ga, xizmat haqi esa uning 10% i (100 000) ga kamayadi.
  // Jami kamayish = 1 100 000 tiyin. Qoldiq = -1 100 000 tiyin bo'ladi!
  const postDiscountRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/adjustments`,
    {
      visitId: billingVisitId,
      type: 'DISCOUNT',
      amountTiyin: '1000000',
      reason: 'Kechiktirilgan bonus chegirma',
    },
    sec11ManagerToken
  );
  assert.strictEqual(postDiscountRes.status, 200);

  // Qoldiq endi aniq -1 100 000 tiyin bo'lishi kerak: balanceTiyin = '-1100000', isRefundDue = true
  const billRefundDue = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}`,
    sec11CashierToken
  );
  assert.strictEqual(billRefundDue.json.data.bill.balanceTiyin, '-1100000');
  assert.strictEqual(billRefundDue.json.data.bill.isRefundDue, true);

  // Refund Due holatida tashrifni yopish rad etilishi shart (400 REFUND_DUE)
  const closeRejectedRefund = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}/close`,
    {},
    sec11CashierToken
  );
  assert.strictEqual(closeRejectedRefund.status, 400);
  assert.strictEqual(closeRejectedRefund.json.error.code, 'REFUND_DUE');

  // Manager 1 100 000 tiyinlik to'lovdan refund rasmiylashtiradi
  const refundRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/refunds`,
    {
      paymentId: splitP1.json.data.id,
      amountTiyin: '1100000',
      reason: 'Chegirma sababli ortiqcha summa qaytarildi',
      idempotencyKey: 'refund-overpaid-key-1',
    },
    sec11ManagerToken
  );
  assert.strictEqual(refundRes.status, 200);

  // Balans qaytadan aniq 0 bo'ldi, isRefundDue = false
  const billAfterRefund = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}`,
    sec11CashierToken
  );
  assert.strictEqual(billAfterRefund.json.data.bill.balanceTiyin, '0');
  assert.strictEqual(billAfterRefund.json.data.bill.isRefundDue, false);
  console.log('✓ Section 60: Salbiy balans (isRefundDue) va qaytarish qoidalari to\'liq tekshirildi (PASSED)');

  // 61. Visit Close Invariants (SERVED taomlar, chaqiruvlar, DIRTY stol)
  // 61.1 Yetkazilmagan taom mavjud bo'lsa yopish taqiqlanadi
  const unservedItem = await prisma.orderItem.create({
    data: {
      restaurantId: restRayhon.id,
      orderId: order1.id,
      menuItemId: dish3.id,
      stationId: testStation.id,
      snapshotName: dish3.name,
      snapshotPriceTiyin: 0n,
      quantity: 1,
      status: OrderItemStatus.PREPARING,
    },
  });

  const closeUnservedRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}/close`,
    {},
    sec11CashierToken
  );
  assert.strictEqual(closeUnservedRes.status, 400);
  assert.strictEqual(closeUnservedRes.json.error.code, 'ACTIVE_ITEMS_EXIST');

  // Taomni SERVED qilamiz
  await prisma.orderItem.update({
    where: { id: unservedItem.id },
    data: { status: OrderItemStatus.SERVED },
  });

  // 61.2 Ochiq chaqiruv mavjud bo'lsa yopish taqiqlanadi
  const testCall = await prisma.serviceCall.create({
    data: {
      restaurantId: restRayhon.id,
      tableId: billingTable.id,
      visitId: billingVisitId,
      type: 'WAITER',
      status: 'PENDING',
    },
  });

  const closeOpenCallRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}/close`,
    {},
    sec11CashierToken
  );
  assert.strictEqual(closeOpenCallRes.status, 400);
  assert.strictEqual(closeOpenCallRes.json.error.code, 'OPEN_CALLS_EXIST');

  // Chaqiruvni RESOLVED qilamiz
  await prisma.serviceCall.update({
    where: { id: testCall.id },
    data: { status: 'RESOLVED' },
  });

  // 61.3 Barcha shartlar to'liq: Tashrif muvaffaqiyatli yopiladi
  const closeSuccessRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}/close`,
    {},
    sec11CashierToken
  );
  assert.strictEqual(closeSuccessRes.status, 200);
  assert.strictEqual(closeSuccessRes.json.data.status, 'CLOSED');

  // Stol holati DIRTY bo'lganini tekshiramiz
  const dirtyTable = await prisma.table.findUnique({ where: { id: billingTable.id } });
  assert.strictEqual(dirtyTable?.status, TableStatus.DIRTY, 'Yopilgan tashrif stoli DIRTY bo\'lishi shart');
  console.log('✓ Section 61: Tashrifni yopish invariantlari (balance=0, SERVED, DIRTY) tasdiqlandi (PASSED)');

  // 62. Closed Visit Refund Workflow
  // Mehmon ketgach (tashrif CLOSED), shikoyat bilan keldi. Manager yopiq tashrif to'lovidan 1 000 000 tiyin qaytaradi
  const closedRefundRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/refunds`,
    {
      paymentId: splitP2.json.data.id,
      amountTiyin: '1000000',
      reason: 'Yopiq tashrifdan mijoz shikoyati bo\'yicha qisman qaytarish',
      idempotencyKey: 'closed-refund-key-1',
    },
    sec11ManagerToken
  );
  assert.strictEqual(closedRefundRes.status, 200);

  // Yopiq tashrifning hisobini tekshiramiz:
  // Invariant: Tashrif statusi CLOSED qoladi, avtomatik CORRECTION negative adjustment hisobiga
  // totalDue 10 000 UZS ga kamaydi, netPaid 10 000 UZS ga kamaydi va balance 0 bo'lib qoldi!
  const billAfterClosedRefund = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${billingVisitId}`,
    sec11CashierToken
  );
  assert.strictEqual(billAfterClosedRefund.json.data.visit.status, 'CLOSED');
  assert.strictEqual(billAfterClosedRefund.json.data.bill.balanceTiyin, '0');
  assert.strictEqual(billAfterClosedRefund.json.data.bill.isRefundDue, false);

  // Smena hisobotida refund qayd etilganini tekshiramiz
  const shiftSumRes4 = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/shifts/current`,
    sec11CashierToken
  );
  assert.strictEqual(shiftSumRes4.json.data.metrics.terminalRefundsTiyin, '1000000');
  console.log('✓ Section 62: Yopiq tashrifga pul qaytarish (closed visit refund workflow) to\'liq tasdiqlandi (PASSED)');

  // Section 54-62 tozalash
  await prisma.refund.deleteMany({ where: { payment: { visitId: billingVisitId } } });
  await prisma.payment.deleteMany({ where: { visitId: billingVisitId } });
  await prisma.billAdjustment.deleteMany({ where: { visitId: billingVisitId } });
  await prisma.serviceCall.deleteMany({ where: { visitId: billingVisitId } });
  await prisma.orderItemAddonSnapshot.deleteMany({ where: { orderItem: { order: { visitId: billingVisitId } } } });
  await prisma.orderItem.deleteMany({ where: { order: { visitId: billingVisitId } } });
  await prisma.order.deleteMany({ where: { visitId: billingVisitId } });
  await prisma.visit.deleteMany({ where: { id: billingVisitId } });
  await prisma.table.deleteMany({ where: { id: billingTable.id } });
  await prisma.menuItem.deleteMany({ where: { id: { in: [dish1.id, dish2.id, dish3.id, dish4.id] } } });
  await prisma.cashMovement.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.shift.deleteMany({ where: { restaurantId: restRayhon.id } });

  // ============================================================================
  // BOSQICH 12: BOSS VA MANAGER PANELLARI INTEGRATION TESTLARI (63 - 69)
  // ============================================================================
  console.log('\n--- 63. BOSQICH 12: BOSS DASHBOARD REAL SERVER AGGREGATIONS VS MANUAL DATASET ---');
  // 1. Boss va G'ijduvon Boss login
  const sec12BossLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998902222222',
    password: 'Demo12345!',
  });
  assert.strictEqual(sec12BossLogin.status, 200, 'Boss tizimga kira olishi shart');
  const sec12BossToken = sec12BossLogin.json.data.token;
  const sec12BossUser = sec12BossLogin.json.data.user;

  const sec12GijduvonBossLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998907777777',
    password: 'Demo12345!',
  });
  assert.strictEqual(sec12GijduvonBossLogin.status, 200);
  const sec12GijduvonBossToken = sec12GijduvonBossLogin.json.data.token;

  // Oldingi test qoldiqlarini tozalash
  await prisma.refund.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.payment.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.billAdjustment.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.orderItemAddonSnapshot.deleteMany({ where: { orderItem: { restaurantId: restRayhon.id } } });
  await prisma.orderItem.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.order.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.visit.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.shift.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.cashMovement.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.table.updateMany({ where: { restaurantId: restRayhon.id }, data: { status: TableStatus.FREE } });

  await prisma.table.deleteMany({ where: { qrToken: { in: ['b-table-101', 'b-table-102', 'b-table-103'] } } });
  await prisma.table.deleteMany({ where: { restaurantId: restRayhon.id, number: { in: [101, 102, 103] } } });
  await prisma.menuItem.deleteMany({ where: { restaurantId: restRayhon.id, name: { in: ['Tandir Kabob (Boss Test)', 'Ko\'k Choy (Boss Test)'] } } });

  const sec12Cat = await prisma.category.findFirst({ where: { restaurantId: restRayhon.id } });
  const sec12Hall = await prisma.hall.findFirst({ where: { restaurantId: restRayhon.id } });
  const sec12Station = await prisma.preparationStation.findFirst({ where: { restaurantId: restRayhon.id } });
  assert.ok(sec12Cat && sec12Hall && sec12Station);

  // Stollar yaratish
  const sec12Table1 = await prisma.table.create({
    data: { restaurantId: restRayhon.id, hallId: sec12Hall.id, number: 101, capacity: 4, status: TableStatus.OCCUPIED, qrToken: `b-table-101-${Date.now()}` },
  });
  const sec12Table2 = await prisma.table.create({
    data: { restaurantId: restRayhon.id, hallId: sec12Hall.id, number: 102, capacity: 4, status: TableStatus.OCCUPIED, qrToken: `b-table-102-${Date.now()}` },
  });
  const sec12Table3 = await prisma.table.create({
    data: { restaurantId: restRayhon.id, hallId: sec12Hall.id, number: 103, capacity: 2, status: TableStatus.FREE, qrToken: `b-table-103-${Date.now()}` },
  });

  // Taomlar yaratish
  const sec12Dish1 = await prisma.menuItem.create({
    data: { restaurantId: restRayhon.id, categoryId: sec12Cat.id, stationId: sec12Station.id, name: 'Tandir Kabob (Boss Test)', basePriceTiyin: 5000000n, isAvailable: true },
  });
  const sec12Dish2 = await prisma.menuItem.create({
    data: { restaurantId: restRayhon.id, categoryId: sec12Cat.id, stationId: sec12Station.id, name: 'Ko\'k Choy (Boss Test)', basePriceTiyin: 1000000n, isAvailable: true },
  });

  // Tashrif 1 (ACTIVE - ochiq qarzdorlik bilan):
  // 2 ta Tandir (100k) + 1 ta Choy (10k) = 110k subtotal (11 000 000 tiyin)
  // Chegirma: 10k (1 000 000 tiyin). Ovqat = 100k (10 000 000 tiyin).
  // Xizmat haqi (10% snapshot): 10k (1 000 000 tiyin).
  // TotalDue = 110k (11 000 000 tiyin).
  // To'lov: 60k (6 000 000 tiyin) naqd.
  // NetPaid: 6 000 000 tiyin.
  // Balance: 50k (5 000 000 tiyin) -> QARZDORLIK!
  const sec12Visit1 = await prisma.visit.create({
    data: {
      restaurantId: restRayhon.id,
      tableId: sec12Table1.id,
      pinCode: '1001',
      status: VisitStatus.ACTIVE,
      serviceChargeBpsSnapshot: 1000,
      openedAt: new Date(),
    },
  });
  const sec12Order1 = await prisma.order.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec12Visit1.id,
      orderNumber: 201,
      status: OrderStatus.SERVED,
      createdByRole: 'WAITER',
      createdAt: new Date(),
    },
  });
  await prisma.orderItem.create({
    data: {
      restaurantId: restRayhon.id,
      orderId: sec12Order1.id,
      menuItemId: sec12Dish1.id,
      stationId: sec12Station.id,
      snapshotName: sec12Dish1.name,
      quantity: 2,
      snapshotPriceTiyin: 5000000n,
      status: OrderItemStatus.SERVED,
    },
  });
  await prisma.orderItem.create({
    data: {
      restaurantId: restRayhon.id,
      orderId: sec12Order1.id,
      menuItemId: sec12Dish2.id,
      stationId: sec12Station.id,
      snapshotName: sec12Dish2.name,
      quantity: 1,
      snapshotPriceTiyin: 1000000n,
      status: OrderItemStatus.SERVED,
    },
  });
  await prisma.billAdjustment.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec12Visit1.id,
      type: 'DISCOUNT',
      amountTiyin: 1000000n,
      reason: 'Doimiy mijoz',
      approvedByUserId: managerUser.id,
    },
  });
  await prisma.payment.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec12Visit1.id,
      method: 'CASH',
      amountTiyin: 6000000n,
      status: 'COMPLETED',
      cashierId: cashierUser.id,
    },
  });

  // Tashrif 2 (ACTIVE - ortiqcha to'langan, qaytarish kerak bo'lgan qoldiq):
  // 1 ta Choy (10k = 1 000 000 tiyin). Xizmat haqi 10% = 100 000 tiyin. TotalDue = 1 100 000 tiyin.
  // To'lov: 1 100 000 tiyin terminalda to'langan.
  // Keyin mijozga -500 000 tiyinlik CORRECTION adjustment yozildi.
  // Yangi TotalDue = 600 000 tiyin. NetPaid = 1 100 000 tiyin.
  // Balance = -500 000 tiyin -> REFUND DUE = 500 000 tiyin!
  const sec12Visit2 = await prisma.visit.create({
    data: {
      restaurantId: restRayhon.id,
      tableId: sec12Table2.id,
      pinCode: '1002',
      status: VisitStatus.ACTIVE,
      serviceChargeBpsSnapshot: 1000,
      openedAt: new Date(),
    },
  });
  const sec12Order2 = await prisma.order.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec12Visit2.id,
      orderNumber: 202,
      status: OrderStatus.SERVED,
      createdByRole: 'WAITER',
      createdAt: new Date(),
    },
  });
  await prisma.orderItem.create({
    data: {
      restaurantId: restRayhon.id,
      orderId: sec12Order2.id,
      menuItemId: sec12Dish2.id,
      stationId: sec12Station.id,
      snapshotName: sec12Dish2.name,
      quantity: 1,
      snapshotPriceTiyin: 1000000n,
      status: OrderItemStatus.SERVED,
    },
  });
  await prisma.payment.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec12Visit2.id,
      method: 'TERMINAL',
      amountTiyin: 1100000n,
      status: 'COMPLETED',
      cashierId: cashierUser.id,
    },
  });
  await prisma.billAdjustment.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec12Visit2.id,
      type: 'CORRECTION',
      amountTiyin: -500000n,
      reason: 'Qisman bekor qilish',
      approvedByUserId: managerUser.id,
    },
  });

  // Tashrif 3 (CLOSED - bugun to'langan va qisman refund qilingan):
  // 1 ta Tandir (50k = 5 000 000 tiyin). Xizmat haqi 10% = 500 000 tiyin. TotalDue = 5 500 000 tiyin.
  // To'lov: 5 500 000 tiyin TERMINAL.
  // Refund: 1 000 000 tiyin.
  const sec12Visit3 = await prisma.visit.create({
    data: {
      restaurantId: restRayhon.id,
      tableId: sec12Table3.id,
      pinCode: '1003',
      status: VisitStatus.CLOSED,
      closedAt: new Date(),
      serviceChargeBpsSnapshot: 1000,
      openedAt: new Date(),
    },
  });
  const sec12Order3 = await prisma.order.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec12Visit3.id,
      orderNumber: 203,
      status: OrderStatus.SERVED,
      createdByRole: 'WAITER',
      createdAt: new Date(),
    },
  });
  await prisma.orderItem.create({
    data: {
      restaurantId: restRayhon.id,
      orderId: sec12Order3.id,
      menuItemId: sec12Dish1.id,
      stationId: sec12Station.id,
      snapshotName: sec12Dish1.name,
      quantity: 1,
      snapshotPriceTiyin: 5000000n,
      status: OrderItemStatus.SERVED,
    },
  });
  const sec12Pay3 = await prisma.payment.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec12Visit3.id,
      method: 'TERMINAL',
      amountTiyin: 5500000n,
      status: 'COMPLETED',
      cashierId: cashierUser.id,
    },
  });
  await prisma.refund.create({
    data: {
      restaurantId: restRayhon.id,
      paymentId: sec12Pay3.id,
      amountTiyin: 1000000n,
      reason: 'Mijoz shikoyati bo\'yicha qisman qaytarish',
      authorizedByUserId: managerUser.id,
    },
  });

  // Boss Dashboard so'rovi
  const sec12DashRes = await apiGet(`/api/v1/restaurants/${restRayhon.id}/reports/dashboard`, sec12BossToken);
  assert.strictEqual(sec12DashRes.status, 200);
  const sec12Bd = sec12DashRes.json.data;

  // Matematik aniq kutilmalar tekshiruvi:
  // Jami buyurtmalar qiymati: 11 000 000 + 1 000 000 + 5 000 000 = 17 000 000 tiyin
  assert.strictEqual(sec12Bd.todayOrdersTotalTiyin, '17000000');
  // Chegirmalar: 1 000 000 tiyin
  assert.strictEqual(sec12Bd.todayDiscountsTiyin, '1000000');
  // Xizmat haqi: (17m - 1m) * 10% = 1 600 000 tiyin
  assert.strictEqual(sec12Bd.todayServiceChargeTiyin, '1600000');
  // Jami qabul qilingan to'lovlar: 6m + 1.1m + 5.5m = 12 600 000 tiyin
  assert.strictEqual(sec12Bd.todayGrossPaymentsTiyin, '12600000');
  // Jami qaytarishlar: 1 000 000 tiyin
  assert.strictEqual(sec12Bd.todayRefundsTiyin, '1000000');
  // Sof tushum: 12.6m - 1m = 11 600 000 tiyin
  assert.strictEqual(sec12Bd.todayNetRevenueTiyin, '11600000');
  // Ochiq qarzdorlik: Visit 1 balansi = 5 000 000 tiyin
  assert.strictEqual(sec12Bd.openDebtTiyin, '5000000');
  // Mehmonlarga qaytarish kerak bo'lgan qoldiq: Visit 2 balansi = 500 000 tiyin
  assert.strictEqual(sec12Bd.refundDueTiyin, '500000');
  // Faol tashriflar soni: 2 ta (Visit 1 va Visit 2)
  assert.strictEqual(sec12Bd.activeVisitsCount, 2);
  // Band stollar soni: 2 ta (sec12Table1 va sec12Table2)
  assert.strictEqual(sec12Bd.activeTablesCount, 2);

  // SOF FOYDA (NET PROFIT) RAQAMI ASLO BO'LMASLIGI SHART!
  assert.strictEqual((sec12Bd as any).netProfit, undefined, 'Xarajat moduli yo\'qligi sababli sof foyda yasalmasligi shart');
  assert.strictEqual((sec12Bd as any).profit, undefined);
  console.log('✓ Section 63: Boss dashboard haqiqiy server aggregatsiyalari va dataset aniq tekshirildi (PASSED)');

  console.log('\n--- 64. BOSQICH 12: ASIA/TASHKENT DAY BOUNDARY VA ORDER VS PAYMENT SANALARI ---');
  // Tashkent kuni chegaralarini tekshiramiz
  const sec12Bounds = getTashkentDayBounds('2026-10-09');
  assert.strictEqual(sec12Bounds.fromUtc.toISOString(), '2026-10-08T19:00:00.000Z', 'Tashkent 00:00 UTCda 19:00 (oldingi kun) bo\'lishi kerak');
  assert.strictEqual(sec12Bounds.toUtc.toISOString(), '2026-10-09T18:59:59.999Z', 'Tashkent 23:59:59.999 UTCda 18:59:59.999 bo\'lishi kerak');

  // Kechagi sana Tashkent vaqti bo'yicha: 2026-10-08
  const sec12YesterdayUtc = new Date(Date.UTC(2026, 9, 8, 12, 0, 0)); // 2026-10-08 17:00 Toshkent vaqti
  const sec12PastVisit = await prisma.visit.create({
    data: {
      restaurantId: restRayhon.id,
      tableId: sec12Table3.id,
      pinCode: '2001',
      status: VisitStatus.CLOSED,
      openedAt: sec12YesterdayUtc,
      closedAt: new Date(),
    },
  });
  const sec12PastOrder = await prisma.order.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec12PastVisit.id,
      orderNumber: 204,
      status: OrderStatus.SERVED,
      createdByRole: 'WAITER',
      createdAt: sec12YesterdayUtc,
    },
  });
  await prisma.orderItem.create({
    data: {
      restaurantId: restRayhon.id,
      orderId: sec12PastOrder.id,
      menuItemId: sec12Dish2.id,
      stationId: sec12Station.id,
      snapshotName: sec12Dish2.name,
      quantity: 1,
      snapshotPriceTiyin: 1000000n,
      status: OrderItemStatus.SERVED,
    },
  });
  // Lekin to'lov BUGUN amalga oshirildi (yangi Date()):
  const sec12TodayPayForPastOrder = await prisma.payment.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec12PastVisit.id,
      method: 'CASH',
      amountTiyin: 1000000n,
      status: 'COMPLETED',
      cashierId: cashierUser.id,
      createdAt: new Date(),
    },
  });

  // Bugungi batafsil hisobot (from=2026-10-09&to=2026-10-09):
  const sec12RepTodayRes = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/reports/detailed?from=2026-10-09&to=2026-10-09`,
    sec12BossToken
  );
  assert.strictEqual(sec12RepTodayRes.status, 200);
  const sec12RepToday = sec12RepTodayRes.json.data;

  // Kechagi batafsil hisobot (from=2026-10-08&to=2026-10-08):
  const sec12RepYestRes = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/reports/detailed?from=2026-10-08&to=2026-10-08`,
    sec12BossToken
  );
  assert.strictEqual(sec12RepYestRes.status, 200);
  const sec12RepYest = sec12RepYestRes.json.data;

  // Bugungi to'lovlar ichida sec12TodayPayForPastOrder summasi bor:
  assert.ok(BigInt(sec12RepToday.paymentsSummary.cashPaymentsTiyin) >= 1000000n);

  // Ammo sec12PastOrder bugungi buyurtmalar soniga qo'shilmagan; kechagi hisobotda esa bor:
  assert.ok(sec12RepYest.ordersSummary.totalOrdersCount >= 1);
  assert.strictEqual(sec12RepYest.paymentsSummary.cashPaymentsTiyin, '0');
  console.log('✓ Section 64: Asia/Tashkent kun chegarasi va Order vs Payment sanalari mustaqilligi tasdiqlandi (PASSED)');

  console.log('\n--- 65. BOSQICH 12: MULTI-TENANT IZOLYATSIYA VA RUXSATLAR CHEKLOVI ---');
  // Xodimlar uchun yangi faol tokenlarni olamiz
  const sec12WaiterLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998905555555',
    password: 'Demo12345!',
  });
  assert.strictEqual(sec12WaiterLogin.status, 200);
  const sec12WaiterToken = sec12WaiterLogin.json.data.token;

  const sec12CashierLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998904444444',
    password: 'Demo12345!',
  });
  assert.strictEqual(sec12CashierLogin.status, 200);
  const sec12CashierToken = sec12CashierLogin.json.data.token;

  const sec12ManagerLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998903333333',
    password: 'Demo12345!',
  });
  assert.strictEqual(sec12ManagerLogin.status, 200);
  let sec12ManagerToken = sec12ManagerLogin.json.data.token;

  // 1. Rayhon Boss Gijduvon hisobotiga kirmoqchi bo'lsa -> 404 NOT_FOUND
  const sec12CrossDash1 = await apiGet(`/api/v1/restaurants/${restGijduvon.id}/reports/dashboard`, sec12BossToken);
  assert.strictEqual(sec12CrossDash1.status, 404, 'Boshqa tenant hisobotiga kirish 404 berishi shart');

  // 2. Gijduvon Boss Rayhon hisobotiga kirmoqchi bo'lsa -> 404 NOT_FOUND
  const sec12CrossDash2 = await apiGet(`/api/v1/restaurants/${restRayhon.id}/reports/dashboard`, sec12GijduvonBossToken);
  assert.strictEqual(sec12CrossDash2.status, 404, 'Boshqa tenant hisobotiga kirish 404 berishi shart');

  // 3. Waiter Rayhon dashboardiga kirmoqchi bo'lsa -> 403 FORBIDDEN (reports.view yo'q)
  const sec12WaiterDash = await apiGet(`/api/v1/restaurants/${restRayhon.id}/reports/dashboard`, sec12WaiterToken);
  assert.strictEqual(sec12WaiterDash.status, 403, 'Waiter reports.view bo\'lmagani sababli 403 olishi shart');

  // 4. Cashier Rayhon dashboardiga kirmoqchi bo'lsa -> 403 FORBIDDEN (reports.view yo'q)
  const sec12CashierDash = await apiGet(`/api/v1/restaurants/${restRayhon.id}/reports/dashboard`, sec12CashierToken);
  assert.strictEqual(sec12CashierDash.status, 403, 'Cashier reports.view bo\'lmagani sababli 403 olishi shart');

  // 5. Manager Rayhon dashboardiga kira oladi (chunki unga reports.view berilgan)
  const sec12MgrDash = await apiGet(`/api/v1/restaurants/${restRayhon.id}/reports/dashboard`, sec12ManagerToken);
  assert.strictEqual(sec12MgrDash.status, 200, 'Manager reports.view bilan dashboardni ko\'ra oladi');

  // 6. Manager operatsion panelni ko'ra oladi, waiter esa yo'q
  const sec12MgrOps = await apiGet(`/api/v1/restaurants/${restRayhon.id}/reports/operations`, sec12ManagerToken);
  assert.strictEqual(sec12MgrOps.status, 200);
  const sec12WaiterOps = await apiGet(`/api/v1/restaurants/${restRayhon.id}/reports/operations`, sec12WaiterToken);
  assert.strictEqual(sec12WaiterOps.status, 403);
  console.log('✓ Section 65: Cross-tenant izolyatsiya va ruxsatlar guardlari to\'liq tasdiqlandi (PASSED)');

  console.log('\n--- 66. BOSQICH 12: XODIMLAR BOSHQARUVI, MULTI-ROLE, ESKALATSIYADAN HIMOYA ---');
  // 1. Boss xodimlar ro'yxatini oladi
  const sec12StaffListRes = await apiGet(`/api/v1/restaurants/${restRayhon.id}/staff`, sec12BossToken);
  assert.strictEqual(sec12StaffListRes.status, 200);

  // Eski test xodimini tozalash
  await prisma.user.deleteMany({ where: { phone: '+998908889911' } });

  // 2. Boss yangi ko'p rolli xodim yaratadi (WAITER va CASHIER bir vaqtda)
  const sec12NewStaffRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/staff`,
    {
      fullName: 'Sardor Testov',
      phone: '+998908889911',
      password: 'DemoPassword123!',
      roles: [Role.WAITER, Role.CASHIER],
      tableIds: [sec12Table1.id],
    },
    sec12BossToken
  );
  assert.strictEqual(sec12NewStaffRes.status, 201, 'Boss yangi xodim yarata olishi shart');
  const sec12NewStaffId = sec12NewStaffRes.json.data.userId;

  // Stolda assignedWaiterId birikkanini tekshiramiz
  const sec12AssignedTbl = await prisma.table.findUnique({ where: { id: sec12Table1.id } });
  assert.strictEqual(sec12AssignedTbl?.assignedWaiterId, sec12NewStaffId);

  // 3. Manager o'z vakolatidan yuqori rol (BOSS) biriktirishga urinsa -> 403 PRIVILEGE_ESCALATION_FORBIDDEN
  const sec12MgrEscalateRes = await apiPatch(
    `/api/v1/restaurants/${restRayhon.id}/staff/${sec12NewStaffId}`,
    { roles: [Role.BOSS] },
    sec12ManagerToken
  );
  assert.strictEqual(sec12MgrEscalateRes.status, 403);
  assert.strictEqual(sec12MgrEscalateRes.json.error.code, 'PRIVILEGE_ESCALATION_FORBIDDEN');

  // 4. Manager BOSS foydalanuvchini o'zgartirishga urinsa -> 403 FORBIDDEN
  const sec12MgrEditBossRes = await apiPatch(
    `/api/v1/restaurants/${restRayhon.id}/staff/${sec12BossUser.id}`,
    { fullName: 'Hacked Boss' },
    sec12ManagerToken
  );
  assert.strictEqual(sec12MgrEditBossRes.status, 403);

  // 5. Manager o'z-o'ziga rol yoki ruxsat oshirishga urinsa -> 403 SELF_ESCALATION_FORBIDDEN
  const sec12MgrSelfEscalateRes = await apiPatch(
    `/api/v1/restaurants/${restRayhon.id}/staff/${managerUser.id}`,
    { roles: [Role.BOSS] },
    sec12ManagerToken
  );
  assert.strictEqual(sec12MgrSelfEscalateRes.status, 403);
  assert.strictEqual(sec12MgrSelfEscalateRes.json.error.code, 'SELF_ESCALATION_FORBIDDEN');

  // 6. Boss xodimni faolsizlantiradi (deactivate)
  const sec12DeactRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/staff/${sec12NewStaffId}/deactivate`,
    {},
    sec12BossToken
  );
  assert.strictEqual(sec12DeactRes.status, 200);

  // Faolsizlangan xodim login qila olmasligi shart
  const sec12DisabledLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998908889911',
    password: 'DemoPassword123!',
  });
  assert.strictEqual(sec12DisabledLogin.status, 401, 'Faolsizlangan xodim tizimga kira olmasligi shart');
  console.log('✓ Section 66: Xodimlar boshqaruvi, ko\'p rol va eskalatsiyadan himoyalanish to\'liq tasdiqlandi (PASSED)');

  console.log('\n--- 67. BOSQICH 12: MOLIYAVIY VAKOLATLARNING BOSS SOZLAMASIDAN KELISHI ---');
  // Manager uchun refunds.approve vakolati bor-yo'qligini tekshiramiz
  const sec12MgrLogin1 = await apiPost('/api/v1/auth/login', {
    phone: '+998903333333',
    password: 'Demo12345!',
  });
  assert.ok(sec12MgrLogin1.json.data.permissions.includes('refunds.approve'));

  // Boss Managerdan 'refunds.approve' vakolatini bekor qiladi:
  const sec12RevokePermRes = await apiPut(
    `/api/v1/restaurants/${restRayhon.id}/staff/${managerUser.id}/permissions`,
    {
      customPermissions: { deny: ['refunds.approve'] },
    },
    sec12BossToken
  );
  assert.strictEqual(sec12RevokePermRes.status, 200);

  // Manager qayta login qilganda 'refunds.approve' bo'lmasligi kerak:
  const sec12MgrLogin2 = await apiPost('/api/v1/auth/login', {
    phone: '+998903333333',
    password: 'Demo12345!',
  });
  assert.strictEqual(sec12MgrLogin2.json.data.permissions.includes('refunds.approve'), false, 'Boss bekor qilgan ruxsat yo\'qolishi kerak');
  const sec12RestrictedMgrToken = sec12MgrLogin2.json.data.token;

  // Endi Manager refund qilmoqchi bo'lsa -> 403 FORBIDDEN
  const sec12BlockedRefund = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/refunds`,
    {
      paymentId: sec12Pay3.id,
      amountTiyin: '500000',
      reason: 'Ruxsatsiz qaytarishga urinish',
      idempotencyKey: 'sec12-blocked-refund-key',
    },
    sec12RestrictedMgrToken
  );
  assert.strictEqual(sec12BlockedRefund.status, 403, 'refunds.approve bekor qilingan managerga refund taqiqlanishi shart');

  // Boss vakolatni qaytarib beradi:
  const sec12RestorePermRes = await apiPut(
    `/api/v1/restaurants/${restRayhon.id}/staff/${managerUser.id}/permissions`,
    {
      customPermissions: null,
    },
    sec12BossToken
  );
  assert.strictEqual(sec12RestorePermRes.status, 200);

  const sec12MgrLogin3 = await apiPost('/api/v1/auth/login', {
    phone: '+998903333333',
    password: 'Demo12345!',
  });
  assert.ok(sec12MgrLogin3.json.data.permissions.includes('refunds.approve'), 'Boss ruxsatni tiklagach yana refund qila olishi shart');
  sec12ManagerToken = sec12MgrLogin3.json.data.token;
  console.log('✓ Section 67: Moliyaviy vakolatlarni Boss tomonidan sozlanishi va cheklanishi tasdiqlandi (PASSED)');

  console.log('\n--- 68. BOSQICH 12: RESTORAN SOZLAMALARI VA IMMUTABILITY KAFOLATI ---');
  // 1. Manager settings.manage ruxsatisiz sozlamani o'zgartirmoqchi bo'lsa -> 403 FORBIDDEN
  const sec12MgrSettingsRes = await apiPatch(
    `/api/v1/restaurants/${restRayhon.id}/settings`,
    { name: 'Xato Nomi' },
    sec12ManagerToken
  );
  assert.strictEqual(sec12MgrSettingsRes.status, 403, 'Manager sozlamani o\'zgartira olmasligi shart');

  // 2. Boss sozlamalarni yangilaydi (serviceChargeBps ni 1000 dan 1500 ga oshiradi)
  const sec12BossSettingsRes = await apiPatch(
    `/api/v1/restaurants/${restRayhon.id}/settings`,
    {
      name: 'Rayhon Premium Milliy Taomlar',
      serviceChargeBps: 1500, // 15%
      openingHours: '08:00 - 23:00',
      defaultLanguage: 'uz',
    },
    sec12BossToken
  );
  assert.strictEqual(sec12BossSettingsRes.status, 200);
  assert.strictEqual(sec12BossSettingsRes.json.data.serviceChargeBps, 1500);

  // 3. IMMUTABILITY TEKSHIRUVI:
  // Eski tashrif (sec12Visit1) xizmat haqi 10% (1000 bps snapshot) bilan ochilgan edi.
  // Restoran sozlamasi 15% ga o'zgargani bilan sec12Visit1 hisobi 10% bo'yicha hisoblanishda qolishi shart!
  const sec12Visit1AfterSettings = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${sec12Visit1.id}`,
    sec12BossToken
  );
  // Service charge 100 000 UZS chegirmadan keyingi ovqat summasidan 10% = 10 000 UZS (1 000 000 tiyin) bo'lishi shart, 15% (1 500 000 tiyin) EMAS!
  assert.strictEqual(
    sec12Visit1AfterSettings.json.data.bill.serviceChargeTiyin,
    '1000000',
    'Eski ochiq tashrifning snapshot xizmat haqi restoran sozlamasi o\'zgarganda o\'zgarmasligi shart!'
  );

  // 4. YANGI TASHRIF ochilganda yangi sozlama (15% = 1500 bps) qo'llaniladi:
  const sec12NewVisitRes = await apiPost(
    `/api/v1/restaurants/${restRayhon.id}/tables/${sec12Table3.id}/open-visit`,
    {},
    sec12WaiterToken
  );
  assert.strictEqual(sec12NewVisitRes.status, 201);
  const sec12NewVisitCreated = await prisma.visit.findUnique({ where: { id: sec12NewVisitRes.json.data.id } });
  assert.strictEqual(sec12NewVisitCreated?.serviceChargeBpsSnapshot, 1500, 'Yangi tashrif yangi 1500 bps siyosatni snapshot qilishi shart');

  // Yangi tashrifni tozalash va restoran sozlamasini 1000 ga qaytarish
  await prisma.visit.delete({ where: { id: sec12NewVisitCreated!.id } });
  await prisma.restaurant.update({
    where: { id: restRayhon.id },
    data: {
      serviceChargeBps: 1000,
      name: 'Rayhon Milliy Taomlar',
      subscriptionPlan: 'BUSINESS',
      allowedRoles: ['BOSS', 'MANAGER', 'CASHIER', 'KITCHEN', 'WAITER', 'GUEST'],
    },
  });
  console.log('✓ Section 68: Restoran sozlamalari va mavjud tashrif/orderlar immutability kafolati tasdiqlandi (PASSED)');

  console.log('\n--- 69. BOSQICH 12: AUDIT OYNASI, SIRLAR REDAKSIYASI VA CSV FORMULA INJECTION HIMOYA ---');
  // 1. Audit loglarini sahifalab olish
  const sec12AuditLogsRes = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/audit/logs?page=1&limit=20`,
    sec12BossToken
  );
  assert.strictEqual(sec12AuditLogsRes.status, 200);
  assert.ok(sec12AuditLogsRes.json.data.logs.length > 0);
  assert.ok(sec12AuditLogsRes.json.data.total > 0);

  // 2. Sirli ma'lumotlar (parollar, tokenlar, PINlar) loglarda [REDACTED] ekanligini tekshirish
  for (const log of sec12AuditLogsRes.json.data.logs) {
    const rawOld = JSON.stringify(log.oldStateJson || {});
    const rawNew = JSON.stringify(log.newStateJson || {});
    assert.strictEqual(rawOld.includes('DemoPassword123!'), false, 'Parol audit logda ochiq ko\'rinmasligi shart');
    assert.strictEqual(rawNew.includes('DemoPassword123!'), false, 'Parol audit logda ochiq ko\'rinmasligi shart');
  }

  // 3. Formula Injection sinovi:
  // Xavfli simvollar bilan boshlangan audit yozuv kiritamiz (=cmd, +formula, -sub, @call)
  await prisma.auditLog.create({
    data: {
      restaurantId: restRayhon.id,
      action: 'SECURITY_FORMULA_INJECTION_TEST',
      entityName: 'TestEntity',
      reason: '=cmd|\' /C calc\'!A0',
      actorName: '+998901234567',
      ipAddress: '127.0.0.1',
    },
  });

  // CSV eksport qilish
  const sec12CsvRes = await apiGetText(
    `/api/v1/restaurants/${restRayhon.id}/audit/export`,
    sec12BossToken
  );
  assert.strictEqual(sec12CsvRes.status, 200);
  console.log('DEBUG CSV CONTENT:', JSON.stringify(sec12CsvRes.text.slice(0, 300)));
  assert.ok(sec12CsvRes.text.includes('Foydalanuvchi'), 'CSV foydalanuvchi ustunini o\'z ichiga olishi kerak');

  // CSV ichida Formula Injection zararsizlantirilganini tekshirish:
  // '=cmd|' oldiga bittalik tirnoq (') qo'shilgan: "'=cmd|"
  assert.ok(
    sec12CsvRes.text.includes("\"'=cmd|' /C calc'!A0\""),
    'Formula injection belgisi (=) tirnoq bilan zararsizlantirilishi shart'
  );
  // '+998' oldiga bittalik tirnoq (') qo'shilgan: "'+998"
  assert.ok(
    sec12CsvRes.text.includes("\"'+998901234567\""),
    'Formula injection belgisi (+) tirnoq bilan zararsizlantirilishi shart'
  );

  // Tenant Scope tekshiruvi: Rayhon CSV eksportida G'ijduvon ma'lumotlari umuman yo'q
  const sec12GijduvonLog = await prisma.auditLog.create({
    data: {
      restaurantId: restGijduvon.id,
      action: 'GIJDUVON_ISOLATION_SECRET_ACTION',
      entityName: 'GijduvonEntity',
      reason: 'Gijduvon maxfiy amali',
    },
  });

  const sec12RayhonCsv = await apiGetText(
    `/api/v1/restaurants/${restRayhon.id}/audit/export`,
    sec12BossToken
  );
  assert.strictEqual(
    sec12RayhonCsv.text.includes('GIJDUVON_ISOLATION_SECRET_ACTION'),
    false,
    'Rayhon eksportida G\'ijduvon audit yozuvlari aslo ko\'rinmasligi shart'
  );

  console.log('✓ Section 69: Audit oynasi, maxfiy ma\'lumotlar sanitizatsiyasi va CSV formula injection himoyasi to\'liq tasdiqlandi (PASSED)');

  console.log('\n--- 70. BOSQICH 13: SUPER ADMIN LOGIN VA PLATFORMA TEXNIK MONITORINGI ---');
  // 1. Super Admin tizimga kirishi
  const sec13SuperLoginRes = await apiPost('/api/v1/auth/login', {
    phone: '+998901111111',
    password: 'Demo12345!',
  });
  assert.strictEqual(sec13SuperLoginRes.status, 200);
  assert.strictEqual(sec13SuperLoginRes.json.data.user.isSuperAdmin, true);
  const sec13SuperAdminToken = sec13SuperLoginRes.json.data.token;

  // 2. Super Admin texnik agregatsiyalarini olish (GET /api/v1/platform/overview)
  const sec13OverviewRes = await apiGet('/api/v1/platform/overview', sec13SuperAdminToken);
  assert.strictEqual(sec13OverviewRes.status, 200);
  const overviewData = sec13OverviewRes.json.data;
  assert.ok(overviewData.totalRestaurants >= 2, 'Kamida 2 ta restoran bo\'lishi shart');
  assert.strictEqual(overviewData.systemHealth.dbConnected, true);
  assert.ok(overviewData.systemHealth.uptimeSeconds >= 0);

  // 3. Oddiy xodim (Manager) platforma nazoratiga kirishga urinishi -> 403 SUPER_ADMIN_REQUIRED
  const sec13MgrLogin = await apiPost('/api/v1/auth/login', {
    phone: '+998903333333',
    password: 'Demo12345!',
  });
  const sec13ManagerToken = sec13MgrLogin.json.data.token;
  const sec13ManagerForbiddenRes = await apiGet('/api/v1/platform/overview', sec13ManagerToken);
  assert.strictEqual(sec13ManagerForbiddenRes.status, 403);
  assert.strictEqual(sec13ManagerForbiddenRes.json.error.code, 'SUPER_ADMIN_REQUIRED');
  console.log('✓ Section 70: Super Admin autentifikatsiyasi va platforma monitoringi tasdiqlandi (PASSED)');

  console.log('\n--- 71. BOSQICH 13: SUPER ADMIN RESTORAN VA BOSS MEMBERSHIP YARATISHI ---');
  // 1. Super Admin yangi restoran va yangi Boss yaratadi
  const newRestSlug = `samarqand-registon-${Date.now()}`;
  const sec13CreateRestRes = await apiPost(
    '/api/v1/platform/restaurants',
    {
      name: 'Samarqand Registon Milliy Taomlar',
      slug: newRestSlug,
      phone: '+998662334455',
      subscriptionPlan: 'ENTERPRISE',
      ownerName: 'Bekzod Karimov (Registon Boss)',
      ownerPhone: `+99890888${Math.floor(1000 + Math.random() * 9000)}`,
      ownerPassword: 'Demo12345!',
    },
    sec13SuperAdminToken
  );
  assert.strictEqual(sec13CreateRestRes.status, 201);
  const sec13CreatedRest = sec13CreateRestRes.json.data.restaurant;
  const sec13CreatedOwner = sec13CreateRestRes.json.data.owner;
  assert.ok(sec13CreatedRest.id);
  assert.strictEqual(sec13CreatedRest.name, 'Samarqand Registon Milliy Taomlar');
  assert.strictEqual(sec13CreatedRest.isActive, true);
  assert.strictEqual(sec13CreatedRest.subscriptionPlan, 'ENTERPRISE');

  // Audit log yozilganini tekshirish
  const sec13CreateLog = await prisma.auditLog.findFirst({
    where: {
      restaurantId: sec13CreatedRest.id,
      action: 'RESTAURANT_CREATED',
    },
  });
  assert.ok(sec13CreateLog);
  assert.strictEqual(sec13CreateLog.actorRole, 'SUPER_ADMIN');

  // Slugi takrorlanganda rad etilishi
  const sec13DuplicateSlugRes = await apiPost(
    '/api/v1/platform/restaurants',
    {
      name: 'Yana bir registon',
      slug: newRestSlug,
      ownerName: 'Test',
      ownerPhone: '+998901239999',
      ownerPassword: 'Demo12345!',
    },
    sec13SuperAdminToken
  );
  assert.strictEqual(sec13DuplicateSlugRes.status, 400);
  assert.strictEqual(sec13DuplicateSlugRes.json.error.code, 'SLUG_ALREADY_EXISTS');
  console.log('✓ Section 71: Super Admin restoran va Boss yaratishi muvaffaqiyatli (PASSED)');

  console.log('\n--- 72. BOSQICH 13: YANGI BOSSNING FAQAT O\'Z RESTORANINI KO\'RISHI VA IZOLYATSIYASI ---');
  // 1. Yangi yaratilgan Boss tizimga kiradi
  const sec13NewBossLogin = await apiPost('/api/v1/auth/login', {
    phone: sec13CreatedOwner.phone,
    password: 'Demo12345!',
  });
  assert.strictEqual(sec13NewBossLogin.status, 200);
  const sec13NewBossToken = sec13NewBossLogin.json.data.token;
  assert.strictEqual(sec13NewBossLogin.json.data.activeRestaurant.id, sec13CreatedRest.id);

  // 2. Yangi Boss o'z restoranining hisobotini ko'ra oladi
  const sec13BossOwnReport = await apiGet(
    `/api/v1/restaurants/${sec13CreatedRest.id}/reports/summary`,
    sec13NewBossToken
  );
  assert.strictEqual(sec13BossOwnReport.status, 200);

  // 3. Yangi Boss boshqa restoran (Rayhon)ga kira olmaydi -> 404 NOT_FOUND
  const sec13BossCrossAttack = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/reports/summary`,
    sec13NewBossToken
  );
  assert.strictEqual(sec13BossCrossAttack.status, 404);

  // 4. Yangi Boss Super Admin platformasiga kira olmaydi -> 403 SUPER_ADMIN_REQUIRED
  const sec13BossPlatformAttack = await apiGet(
    '/api/v1/platform/restaurants',
    sec13NewBossToken
  );
  assert.strictEqual(sec13BossPlatformAttack.status, 403);
  console.log('✓ Section 72: Boss izolyatsiyasi (faqat o\'z restorani) to\'liq tasdiqlandi (PASSED)');

  console.log('\n--- 73. BOSQICH 13: RESTORAN HOLATINI TO\'XTATISH (SUSPEND) VA SOZLAMALAR ---');
  // 1. Sababsiz to'xtatishga urinish rad etiladi
  const sec13NoReasonSuspend = await apiPatch(
    `/api/v1/platform/restaurants/${sec13CreatedRest.id}/status`,
    { status: 'SUSPENDED' },
    sec13SuperAdminToken
  );
  assert.strictEqual(sec13NoReasonSuspend.status, 400);
  assert.strictEqual(sec13NoReasonSuspend.json.error.code, 'REASON_REQUIRED');

  // 2. Super Admin sabab ko'rsatib restoranni SUSPENDED qiladi
  const sec13SuspendRes = await apiPatch(
    `/api/v1/platform/restaurants/${sec13CreatedRest.id}/status`,
    {
      status: 'SUSPENDED',
      reason: 'To\'lov muddati tugadi va texnik ko\'rik',
    },
    sec13SuperAdminToken
  );
  assert.strictEqual(sec13SuspendRes.status, 200);
  assert.strictEqual(sec13SuspendRes.json.data.isActive, false);
  assert.strictEqual(sec13SuspendRes.json.data.suspendedReason, 'To\'lov muddati tugadi va texnik ko\'rik');
  console.log('✓ Section 73: Restoranni sabab bilan to\'xtatish (SUSPENDED) tasdiqlandi (PASSED)');

  console.log('\n--- 74. BOSQICH 13: SUSPENDED RESTORANDA YANGI OPERATSIYALAR BLOKLANISHI INVARIANTI ---');
  // Test uchun Registon restoranida bitta stol yaratamiz
  const sec13RegistonHall = await prisma.hall.findFirst({ where: { restaurantId: sec13CreatedRest.id } });
  const sec13RegistonTable = await prisma.table.create({
    data: {
      restaurantId: sec13CreatedRest.id,
      hallId: sec13RegistonHall!.id,
      number: 1,
      status: TableStatus.FREE,
      qrToken: `qr-reg-${Date.now()}`,
    },
  });

  // 1. Yangi tashrif ochish bloklanadi -> 403 RESTAURANT_SUSPENDED
  const sec13OpenVisitBlocked = await apiPost(
    `/api/v1/restaurants/${sec13CreatedRest.id}/tables/${sec13RegistonTable.id}/open-visit`,
    {},
    sec13NewBossToken
  );
  assert.strictEqual(sec13OpenVisitBlocked.status, 403);
  assert.strictEqual(sec13OpenVisitBlocked.json.error.code, 'RESTAURANT_SUSPENDED');

  // 2. Yangi ofitsiant buyurtmasi kiritish bloklanadi -> 403 RESTAURANT_SUSPENDED
  const sec13StaffOrderBlocked = await apiPost(
    `/api/v1/restaurants/${sec13CreatedRest.id}/waiter/orders`,
    {
      visitId: '00000000-0000-0000-0000-000000000000',
      items: [],
    },
    sec13NewBossToken
  );
  assert.strictEqual(sec13StaffOrderBlocked.status, 403);
  assert.strictEqual(sec13StaffOrderBlocked.json.error.code, 'RESTAURANT_SUSPENDED');
  console.log('✓ Section 74: Suspended restoranda yangi tashrif va yangi buyurtmalar bloklanishi tasdiqlandi (PASSED)');

  console.log('\n--- 75. BOSQICH 13: MAVJUD QABUL QILINGAN TASHRIFNI XAVFSIZ YAKUNLASH (GRACEFUL WIND-DOWN) ---');
  // 1. Restoranni vaqtincha ACTIVE qilamiz va bitta faol tashrif ochamiz
  await prisma.restaurant.update({
    where: { id: sec13CreatedRest.id },
    data: { isActive: true },
  });
  const sec13Cat = await prisma.category.create({
    data: { restaurantId: sec13CreatedRest.id, name: 'Milliy Taomlar' },
  });
  const sec13Station = await prisma.preparationStation.create({
    data: { restaurantId: sec13CreatedRest.id, name: 'Oshxona', type: StationType.KITCHEN },
  });
  const sec13Dish = await prisma.menuItem.create({
    data: {
      restaurantId: sec13CreatedRest.id,
      categoryId: sec13Cat.id,
      stationId: sec13Station.id,
      name: 'Samarqand Palovi',
      basePriceTiyin: 4000000n,
      isAvailable: true,
    },
  });

  const sec13ActiveVisitRes = await apiPost(
    `/api/v1/restaurants/${sec13CreatedRest.id}/tables/${sec13RegistonTable.id}/open-visit`,
    {},
    sec13NewBossToken
  );
  assert.strictEqual(sec13ActiveVisitRes.status, 201);
  const sec13DrainVisitId = sec13ActiveVisitRes.json.data.id;

  // Buyurtma beramiz va CONFIRMED/ACCEPTED qilamiz
  const sec13DrainOrder = await prisma.order.create({
    data: {
      restaurantId: sec13CreatedRest.id,
      visitId: sec13DrainVisitId,
      orderNumber: 501,
      status: OrderStatus.CONFIRMED,
      createdByRole: 'WAITER',
      items: {
        create: [
          {
            menuItemId: sec13Dish.id,
            stationId: sec13Station.id,
            snapshotName: sec13Dish.name,
            snapshotPriceTiyin: 4000000n,
            quantity: 1,
            status: OrderItemStatus.ACCEPTED,
          },
        ],
      },
    },
    include: { items: true },
  });
  const sec13DrainItemId = sec13DrainOrder.items[0].id;

  // Endi restoranni QAYTA SUSPENDED holatiga o'tkazamiz
  await prisma.restaurant.update({
    where: { id: sec13CreatedRest.id },
    data: { isActive: false, suspendedReason: 'Xizmat to\'xtatildi, mavjud mijozlar tugatilmoqda' },
  });

  // A) OSHXONA: Mavjud accepted taomni PREPARING va READY qilish mumkin
  const sec13PrepareRes = await apiPost(
    `/api/v1/restaurants/${sec13CreatedRest.id}/kds/items/${sec13DrainItemId}/prepare`,
    {},
    sec13NewBossToken
  );
  assert.strictEqual(sec13PrepareRes.status, 200);

  const sec13ReadyRes = await apiPost(
    `/api/v1/restaurants/${sec13CreatedRest.id}/kds/items/${sec13DrainItemId}/ready`,
    {},
    sec13NewBossToken
  );
  assert.strictEqual(sec13ReadyRes.status, 200);

  // B) OFITSIANT: Tayyor taomni mehmonga yetkazish (SERVED) mumkin
  const sec13ServeRes = await apiPost(
    `/api/v1/restaurants/${sec13CreatedRest.id}/waiter/items/${sec13DrainItemId}/serve`,
    {},
    sec13NewBossToken
  );
  assert.strictEqual(sec13ServeRes.status, 200);

  // C) KASSA: Smena ochish va to'lov qabul qilish mumkin
  await prisma.shift.create({
    data: {
      restaurantId: sec13CreatedRest.id,
      userId: sec13CreatedOwner.id,
      status: ShiftStatus.OPEN,
    },
  });

  // Hisobni to'lash (44 000 UZS = 4 000 000 taom + 400 000 xizmat haqi = 4 400 000 tiyin)
  const sec13PayRes = await apiPost(
    `/api/v1/restaurants/${sec13CreatedRest.id}/billing/payments`,
    {
      visitId: sec13DrainVisitId,
      amountTiyin: '4400000',
      method: 'CASH',
    },
    sec13NewBossToken
  );
  assert.strictEqual(sec13PayRes.status, 200);

  // D) TASHRIFNI YOPISH: Xavfsiz yopiladi, stol holati DIRTY ga o'tadi
  const sec13CloseVisitRes = await apiPost(
    `/api/v1/restaurants/${sec13CreatedRest.id}/visits/${sec13DrainVisitId}/close`,
    {},
    sec13NewBossToken
  );
  assert.strictEqual(sec13CloseVisitRes.status, 200);

  const sec13ClosedVisitCheck = await prisma.visit.findUnique({ where: { id: sec13DrainVisitId } });
  assert.strictEqual(sec13ClosedVisitCheck?.status, VisitStatus.CLOSED);

  const sec13TableDirtyCheck = await prisma.table.findUnique({ where: { id: sec13RegistonTable.id } });
  assert.strictEqual(sec13TableDirtyCheck?.status, TableStatus.DIRTY);

  console.log('✓ Section 75: Suspended restoranda mavjud tashrif va taomlar xavfsiz yakunlanishi (Graceful wind-down) tasdiqlandi (PASSED)');

  console.log('\n--- 76. BOSQICH 13: SUPER ADMIN SUPPORT MODE, VAQT CHEGARASI VA AUDIT ---');
  // 1. Super Admin Support Tokensiz to'g'ridan-to'g'ri Rayhon hisobotiga kira olmaydi -> 403 SUPPORT_SESSION_REQUIRED
  const sec13DirectAccessDenied = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/reports/dashboard`,
    sec13SuperAdminToken
  );
  assert.strictEqual(sec13DirectAccessDenied.status, 403);
  assert.strictEqual(sec13DirectAccessDenied.json.error.code, 'SUPPORT_SESSION_REQUIRED');

  // 2. Super Admin Rayhon restorani uchun yordam sessiyasi ochadi (Read-Only)
  const sec13SupportSessionRes = await apiPost(
    `/api/v1/platform/restaurants/${restRayhon.id}/support-session`,
    {
      reason: 'Kassa hisobotlarini solishtirish va tekshirish',
      expiresInMinutes: 30,
      isReadOnly: true,
    },
    sec13SuperAdminToken
  );
  assert.strictEqual(sec13SupportSessionRes.status, 201);
  const sec13SupportToken = sec13SupportSessionRes.json.data.supportToken;
  assert.ok(sec13SupportToken);

  // 3. Endi Support Token bilan Super Admin Rayhon hisobotini o'qiy oladi (Read-Only 200 OK)
  const sec13SupportReadRes = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/reports/dashboard`,
    sec13SuperAdminToken,
    { 'X-Support-Token': sec13SupportToken }
  );
  assert.strictEqual(sec13SupportReadRes.status, 200);

  // 4. Read-Only rejimida Super Admin mutatsiya (PATCH settings) qilolmaydi -> 403 SUPPORT_READ_ONLY
  const sec13SupportMutationBlocked = await apiPatch(
    `/api/v1/restaurants/${restRayhon.id}/settings`,
    { name: 'Xaker O\'zgarishi' },
    sec13SuperAdminToken,
    undefined,
    { 'X-Support-Token': sec13SupportToken }
  );
  assert.strictEqual(sec13SupportMutationBlocked.status, 403);
  assert.strictEqual(sec13SupportMutationBlocked.json.error.code, 'SUPPORT_READ_ONLY');

  // 5. Yordam sessiyasini bekor qilish (Revoke)
  const sec13RevokeSupportRes = await apiPost(
    `/api/v1/platform/restaurants/${restRayhon.id}/support-session/revoke`,
    { supportToken: sec13SupportToken },
    sec13SuperAdminToken
  );
  assert.strictEqual(sec13RevokeSupportRes.status, 200);

  // Bekor qilingan token bilan qayta kirish -> 403 SUPPORT_SESSION_EXPIRED
  const sec13ExpiredAccessRes = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/reports/dashboard`,
    sec13SuperAdminToken,
    { 'X-Support-Token': sec13SupportToken }
  );
  assert.strictEqual(sec13ExpiredAccessRes.status, 403);
  assert.strictEqual(sec13ExpiredAccessRes.json.error.code, 'SUPPORT_SESSION_EXPIRED');

  // 6. Platforma Audit jurnali tekshiruvi: Super admin harakatlari to'liq SUPER_ADMIN sifatida qayd etilgan
  const sec13PlatformAuditRes = await apiGet(
    '/api/v1/platform/audit?limit=20',
    sec13SuperAdminToken
  );
  assert.strictEqual(sec13PlatformAuditRes.status, 200);
  const sec13PlatformLogs = sec13PlatformAuditRes.json.data.logs;
  assert.ok(sec13PlatformLogs.some((l: any) => l.action === 'SUPPORT_SESSION_STARTED'));
  assert.ok(sec13PlatformLogs.some((l: any) => l.action === 'SUPPORT_SESSION_REVOKED'));
  assert.ok(sec13PlatformLogs.some((l: any) => l.action === 'RESTAURANT_CREATED'));

  console.log('✓ Section 76: Super Admin support mode, vaqt chegarasi, read-only guard va audit to\'liq tasdiqlandi (PASSED)');

  console.log('\n--- 77. BOSQICH 14: MULTI-PROCESS PARALLEL PAYMENT VA OVERPAYMENT KAFOLATI (SCENARIO 17) ---');
  // 1. Yangi test stoli va 50 000 UZS (5 000 000 tiyin) hisobli tashrif ochamiz
  const existingTable991 = await prisma.table.findFirst({ where: { restaurantId: restRayhon.id, number: 991 } });
  if (existingTable991) {
    await prisma.payment.deleteMany({ where: { visit: { tableId: existingTable991.id } } });
    await prisma.orderItem.deleteMany({ where: { order: { visit: { tableId: existingTable991.id } } } });
    await prisma.order.deleteMany({ where: { visit: { tableId: existingTable991.id } } });
    await prisma.visit.deleteMany({ where: { tableId: existingTable991.id } });
    await prisma.table.delete({ where: { id: existingTable991.id } });
  }

  const sec14MultiProcTable = await prisma.table.create({
    data: {
      restaurantId: restRayhon.id,
      hallId: sec12Hall.id,
      number: 991,
      status: TableStatus.FREE,
      qrToken: `qr-multiproc-${Date.now()}`,
    },
  });

  const sec14MultiProcVisit = await prisma.visit.create({
    data: {
      restaurantId: restRayhon.id,
      tableId: sec14MultiProcTable.id,
      pinCode: '9911',
      status: VisitStatus.ACTIVE,
      serviceChargeBpsSnapshot: 0,
    },
  });

  await prisma.order.create({
    data: {
      restaurantId: restRayhon.id,
      visitId: sec14MultiProcVisit.id,
      orderNumber: 991,
      status: OrderStatus.CONFIRMED,
      createdByRole: 'WAITER',
      items: {
        create: [
          {
            menuItemId: sec12Dish1.id,
            stationId: sec12Station.id,
            snapshotName: 'Multi-Process Test Taom',
            snapshotPriceTiyin: 5000000n, // 50 000 UZS
            quantity: 1,
            status: OrderItemStatus.SERVED,
          },
        ],
      },
    },
  });

  // Kassa smenasini tekshiramiz/ochamiz
  let sec14CashierShift = await prisma.shift.findFirst({
    where: { restaurantId: restRayhon.id, userId: cashierUser.id, status: ShiftStatus.OPEN },
  });
  if (!sec14CashierShift) {
    sec14CashierShift = await prisma.shift.create({
      data: {
        restaurantId: restRayhon.id,
        userId: cashierUser.id,
        status: ShiftStatus.OPEN,
        startingCashTiyin: 50000000n,
      },
    });
  }

  // 2. Child process kodi (Alohida mustaqil Node.js OS jarayoni)
  const childWorkerCode = `
    const fetch = globalThis.fetch;
    async function run() {
      try {
        const res = await fetch('${baseUrl}/api/v1/restaurants/${restRayhon.id}/billing/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${sec11CashierToken}'
          },
          body: JSON.stringify({
            visitId: '${sec14MultiProcVisit.id}',
            amountTiyin: '3000000',
            method: 'CASH',
            idempotencyKey: 'child-proc-key-991'
          })
        });
        const json = await res.json();
        process.stdout.write(JSON.stringify({ status: res.status, code: json.error?.code || 'SUCCESS' }));
      } catch (e) {
        process.stderr.write(e.message);
        process.exit(1);
      }
    }
    run();
  `;

  // 3. Parent Process va Child Process bir vaqtda to'lov yuboradi
  const parentPaymentPromise = apiPost(
    `/api/v1/restaurants/${restRayhon.id}/billing/payments`,
    {
      visitId: sec14MultiProcVisit.id,
      amountTiyin: '3000000',
      method: 'CASH',
      idempotencyKey: 'parent-proc-key-991',
    },
    sec11CashierToken
  );

  const childPaymentPromise = new Promise<{ status: number; code: string }>((resolve, reject) => {
    cp.execFile('node', ['-e', childWorkerCode], (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        resolve(JSON.parse(stdout));
      } catch (parseErr) {
        reject(new Error(`Child process javobi xato: ${stdout}`));
      }
    });
  });

  const [parentRes, childRes] = await Promise.all([parentPaymentPromise, childPaymentPromise]);

  const multiProcStatuses = [parentRes.status, childRes.status].sort();
  assert.deepStrictEqual(
    multiProcStatuses,
    [200, 400],
    'Ikki mustaqil backend jarayoni parallel poygasida bittasi 200, ikkinchisi 400 OVERPAYMENT_REJECTED olishi shart'
  );

  const finalMultiProcBill = await apiGet(
    `/api/v1/restaurants/${restRayhon.id}/billing/visits/${sec14MultiProcVisit.id}`,
    sec11CashierToken
  );
  assert.strictEqual(finalMultiProcBill.json.data.bill.balanceTiyin, '2000000');
  console.log('✓ Section 77: Ikki mustaqil backend process/DB connection parallel overpayment himoyasi isbotlandi (PASSED)');

  // Section 77 tozalash
  await prisma.payment.deleteMany({ where: { visitId: sec14MultiProcVisit.id } });
  await prisma.orderItem.deleteMany({ where: { order: { visitId: sec14MultiProcVisit.id } } });
  await prisma.order.deleteMany({ where: { visitId: sec14MultiProcVisit.id } });
  await prisma.visit.delete({ where: { id: sec14MultiProcVisit.id } });
  await prisma.table.delete({ where: { id: sec14MultiProcTable.id } });

  console.log('\n--- 78. BOSQICH 14: DATABASE ZAXIRALASH VA TIKLASH (BACKUP & RESTORE) SINIXTI (SCENARIO 28) ---');
  const dumpFilePath = `test_qa_backup_${Date.now()}.dump`;
  const dumpCmd = `pg_dump -U postgres -h localhost -d menurest_v2 -F c -b -f "${dumpFilePath}"`;
  const restoreCmd = `pg_restore -U postgres -h localhost -d menurest_v2_test --clean --if-exists "${dumpFilePath}"`;

  cp.execSync(dumpCmd, { env: { ...process.env, PGPASSWORD: '123456' }, stdio: 'pipe' });
  cp.execSync(restoreCmd, { env: { ...process.env, PGPASSWORD: '123456' }, stdio: 'pipe' });

  const restoredCheckResult = cp.execSync(
    `psql -U postgres -h localhost -d menurest_v2_test -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"`,
    { env: { ...process.env, PGPASSWORD: '123456' }, stdio: 'pipe', encoding: 'utf-8' }
  );
  const tablesCountInTestDb = parseInt(restoredCheckResult.trim(), 10);
  assert.ok(tablesCountInTestDb >= 25, 'Tiklangan bazada barcha jadvallar saqlanishi shart');

  if (fs.existsSync(dumpFilePath)) {
    fs.unlinkSync(dumpFilePath);
  }
  console.log(`✓ Section 78: Database backup va restore muvaffaqiyatli tiklandi (${tablesCountInTestDb} ta jadval saqlandi) (PASSED)`);

  // Section 71-76 Tozalash
  await prisma.payment.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.orderItem.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.order.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.shift.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.visit.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.menuItem.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.preparationStation.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.category.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.table.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.hall.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.supportAccess.deleteMany({ where: { restaurantId: { in: [sec13CreatedRest.id, restRayhon.id] } } });
  await prisma.restaurantMembership.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.user.deleteMany({ where: { id: sec13CreatedOwner.id } });
  await prisma.auditLog.deleteMany({ where: { restaurantId: sec13CreatedRest.id } });
  await prisma.restaurant.delete({ where: { id: sec13CreatedRest.id } });

  // Section 63-69 tozalash
  await prisma.refund.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.payment.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.billAdjustment.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.orderItemAddonSnapshot.deleteMany({ where: { orderItem: { restaurantId: restRayhon.id } } });
  await prisma.orderItem.deleteMany({ where: { order: { restaurantId: restRayhon.id } } });
  await prisma.orderItem.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.order.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.visit.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.table.deleteMany({ where: { id: { in: [sec12Table1.id, sec12Table2.id, sec12Table3.id] } } });
  await prisma.menuItem.deleteMany({ where: { id: { in: [sec12Dish1.id, sec12Dish2.id] } } });
  await prisma.restaurantMembership.deleteMany({ where: { userId: sec12NewStaffId } });
  await prisma.user.deleteMany({ where: { id: sec12NewStaffId } });
  await prisma.auditLog.deleteMany({ where: { id: sec12GijduvonLog.id } });

  // Umumiy Tozalash
  await prisma.orderItemAddonSnapshot.deleteMany({ where: { orderItem: { restaurantId: restRayhon.id } } });
  await prisma.orderItem.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.order.deleteMany({ where: { restaurantId: restRayhon.id } });
  await prisma.idempotencyRecord.deleteMany();
  await prisma.menuItem.deleteMany({ where: { id: unavailableDish.id } });
  await prisma.serviceCall.deleteMany({ where: { tableId: createdTable.id } });
  await prisma.guestSession.deleteMany({ where: { tableId: createdTable.id } });
  await prisma.visit.deleteMany({ where: { tableId: createdTable.id } });
  await prisma.table.deleteMany({ where: { id: createdTable.id } });
  await prisma.hall.deleteMany({ where: { id: hallId } });

  // ============================================================================
  // 77. BOSQICH 14: TO'LIQ END-TO-END QA VA CONCURRENCY TESTLARI (SSENARIY 1 - 28)
  // ============================================================================
  console.log('\n================================================================');
  console.log('77-BO\'LIM: BOSQICH 14 TO\'LIQ QA INTEGRATSIYA VA CONCURRENCY SSENARIYLARI');
  console.log('================================================================');
  await runStage14QATests();

  outboxService.stop();
  realtimeService.destroy();
  await prisma.$disconnect();
  server.close();
  console.log('\n================================================================');
  console.log('BARCHA BOSQICH 1-14 TESTLARI VA 28 TA QA INTEGRATSIYA SSENARIYLARI TO\'LIQ PASSED!');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  outboxService.stop();
  realtimeService.destroy();
  if (server) server.close();
  process.exit(1);
});
