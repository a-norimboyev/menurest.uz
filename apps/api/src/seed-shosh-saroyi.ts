import { PrismaClient, Role, TableStatus, VisitStatus, OrderStatus, OrderItemStatus, PaymentMethod, PaymentStatus, StationType, ShiftStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🏛️  SHOSH SAROYI — 4 OYLIK TARIYGA EGA TO\'LIQ RESTORANNI YARATISH');
  console.log('================================================================');

  const defaultPassword = 'Demo12345!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const now = new Date();
  const fourMonthsAgo = new Date(now.getTime() - 120 * 24 * 3600 * 1000);

  // 1. RESTORANNI YARATISH YOKI YANGILASH
  console.log('\n1. Restoran yaratilmoqda/yangilanmoqda...');
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'shosh-saroyi' },
    update: {
      name: 'Shosh Saroyi',
      phone: '+998 71 200 44 44',
      extraPhones: ['+998 90 999 11 22', '+998 91 100 00 01'],
      telegram: '@shosh_saroyi_rest',
      instagram: '@shosh_saroyi_uz',
      address: 'Toshkent sh., Chilonzor tumani, Bunyodkor shox ko\'chasi 42-uy',
      openingHours: '10:00 - 23:30',
      isActive: true,
      serviceChargeBps: 1000, // 10%
      subscriptionPlan: 'ENTERPRISE',
      subscriptionExpiresAt: new Date(now.getTime() + 365 * 24 * 3600 * 1000),
      allowedRoles: ['MANAGER', 'CASHIER', 'WAITER', 'GUEST'],
      createdAt: fourMonthsAgo,
    },
    create: {
      name: 'Shosh Saroyi',
      slug: 'shosh-saroyi',
      phone: '+998 71 200 44 44',
      extraPhones: ['+998 90 999 11 22', '+998 91 100 00 01'],
      telegram: '@shosh_saroyi_rest',
      instagram: '@shosh_saroyi_uz',
      address: 'Toshkent sh., Chilonzor tumani, Bunyodkor shox ko\'chasi 42-uy',
      openingHours: '10:00 - 23:30',
      isActive: true,
      serviceChargeBps: 1000,
      subscriptionPlan: 'ENTERPRISE',
      subscriptionExpiresAt: new Date(now.getTime() + 365 * 24 * 3600 * 1000),
      allowedRoles: ['MANAGER', 'CASHIER', 'WAITER', 'GUEST'],
      createdAt: fourMonthsAgo,
    },
  });
  console.log(`   ✅ Restoran ID: ${restaurant.id} (${restaurant.name})`);

  // 2. BARCHA FOYDALANILADIGAN ROLLAR UCHUN XODIM FOYDALANUVCHILARI (MANAGER, CASHIER, WAITER)
  console.log('\n2. Xodimlar yaratilmoqda (MANAGER, CASHIER, WAITER)...');
  const staffSpecs = [
    { phone: '+998911000002', name: 'Davron Aliyev', role: Role.MANAGER },
    { phone: '+998911000003', name: 'Nilufar Karimova', role: Role.CASHIER },
    { phone: '+998911000004', name: 'Sardor Rustamov', role: Role.WAITER },
    { phone: '+998911000005', name: 'Malika Rahimova', role: Role.WAITER },
  ];

  const createdUsers: Record<string, any> = {};

  for (const spec of staffSpecs) {
    const user = await prisma.user.upsert({
      where: { phone: spec.phone },
      update: {
        fullName: spec.name,
        passwordHash,
        plainPassword: defaultPassword,
        isActive: true,
      },
      create: {
        phone: spec.phone,
        fullName: spec.name,
        passwordHash,
        plainPassword: defaultPassword,
        isActive: true,
        createdAt: fourMonthsAgo,
      },
    });
    createdUsers[spec.role] = user;

    // Membership
    const membership = await prisma.restaurantMembership.upsert({
      where: {
        restaurantId_userId: {
          restaurantId: restaurant.id,
          userId: user.id,
        },
      },
      update: { isActive: true },
      create: {
        restaurantId: restaurant.id,
        userId: user.id,
        isActive: true,
        createdAt: fourMonthsAgo,
      },
    });

    await prisma.membershipRole.upsert({
      where: {
        membershipId_role: {
          membershipId: membership.id,
          role: spec.role,
        },
      },
      update: {},
      create: {
        membershipId: membership.id,
        role: spec.role,
      },
    });

    console.log(`   👤 [${spec.role}] ${spec.name} (${spec.phone}) -> Parol: ${defaultPassword}`);
  }

  // Umumiy demo akkauntlarni ham ushbu restoranga biriktiramiz
  const globalDemoPhones = [
    { phone: '+998902222222', role: Role.BOSS },
    { phone: '+998903333333', role: Role.MANAGER },
    { phone: '+998904444444', role: Role.CASHIER },
    { phone: '+998905555555', role: Role.WAITER },
  ];
  for (const g of globalDemoPhones) {
    const u = await prisma.user.findUnique({ where: { phone: g.phone } });
    if (u) {
      const m = await prisma.restaurantMembership.upsert({
        where: { restaurantId_userId: { restaurantId: restaurant.id, userId: u.id } },
        update: { isActive: true },
        create: { restaurantId: restaurant.id, userId: u.id, isActive: true, createdAt: fourMonthsAgo },
      });
      await prisma.membershipRole.upsert({
        where: { membershipId_role: { membershipId: m.id, role: g.role } },
        update: {},
        create: { membershipId: m.id, role: g.role },
      });
    }
  }

  // 3. OSHXONA VA BAR STANSIYALARI (KITCHEN STATIONS)
  console.log('\n3. Oshxona va Bar stansiyalari...');
  const stationsData = [
    { name: 'Issiq Oshxona', type: StationType.KITCHEN },
    { name: 'Mangal va Shashlikxona', type: StationType.GRILL },
    { name: 'Bar va Ichimliklar', type: StationType.BAR },
    { name: 'Somsa va Nonvoyxona', type: StationType.PASTRY },
  ];

  const stations: Record<string, any> = {};
  for (const st of stationsData) {
    let s = await prisma.preparationStation.findFirst({
      where: { restaurantId: restaurant.id, name: st.name },
    });
    if (!s) {
      s = await prisma.preparationStation.create({
        data: {
          restaurantId: restaurant.id,
          name: st.name,
          type: st.type,
        },
      });
    }
    stations[st.type] = s;
    console.log(`   🍳 Stansiya: ${st.name} (${st.type})`);
  }

  // 4. ZALLAR VA STOLLAR
  console.log('\n4. Zallar va 24 ta stol yaratilmoqda...');
  const hallsData = [
    { name: 'Asosiy Saroy Zali', sortOrder: 1, tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], cap: 4 },
    { name: 'VIP Xonalar', sortOrder: 2, tables: [21, 22, 23, 24], cap: 8 },
    { name: 'Yozgi Bog\' va Terrasa', sortOrder: 3, tables: [31, 32, 33, 34, 35, 36, 37, 38], cap: 6 },
  ];

  const allTables: any[] = [];
  for (const hd of hallsData) {
    let hall = await prisma.hall.findFirst({
      where: { restaurantId: restaurant.id, name: hd.name },
    });
    if (!hall) {
      hall = await prisma.hall.create({
        data: {
          restaurantId: restaurant.id,
          name: hd.name,
          sortOrder: hd.sortOrder,
        },
      });
    }

    for (const num of hd.tables) {
      const qrToken = `qr_shosh_${num}`;
      const tbl = await prisma.table.upsert({
        where: { restaurantId_number: { restaurantId: restaurant.id, number: num } },
        update: {
          hallId: hall.id,
          capacity: hd.cap,
          qrToken,
          status: TableStatus.FREE,
        },
        create: {
          restaurantId: restaurant.id,
          hallId: hall.id,
          number: num,
          capacity: hd.cap,
          qrToken,
          status: TableStatus.FREE,
        },
      });
      allTables.push(tbl);
    }
    console.log(`   🚪 ${hd.name}: ${hd.tables.length} ta stol.`);
  }

  // 5. TO'LIQ MILLIY VA MANGAL MENYUSI (KATEGORIYALAR VA TAOMLAR)
  console.log('\n5. Boyitilgan taomlar va menyu...');
  const menuConfig = [
    {
      category: 'Milliy Taomlar',
      station: StationType.KITCHEN,
      items: [
        { name: "Toshkent To'y Oshi", price: 42000, desc: 'Lazer guruch, mayin go\'sht, noxat, mayiz va qazi bilan' },
        { name: 'Choyxona Oshi', price: 40000, desc: 'Devzira guruch, barra qo\'y go\'shti, dumba yog\'i' },
        { name: 'Qozon Kabob', price: 58000, desc: 'Tillorang qovurilgan yosh buzoq go\'shti va qarsildoq kartoshka' },
        { name: 'Qo\'y Go\'shtli Dimlama', price: 54000, desc: 'Sabzavotlar va qo\'y qovurg\'alari bilan dimlangan shohona taom' },
        { name: 'Uyg\'urcha Qovurma Lag\'mon', price: 42000, desc: 'Cho\'zilgan xamir, shirali mol go\'shti va barra sabzavotlar' },
        { name: 'Qazi-Qarta Assorti', price: 48000, desc: 'An\'anaviy tayyorlangan sarxil ot go\'shti qazisi' },
      ],
    },
    {
      category: 'Kaboblar',
      station: StationType.GRILL,
      items: [
        { name: 'Gijduvoncha Qiyma Shashlik', price: 22000, desc: 'Mayin va shirali mol/qo\'y qiymasi' },
        { name: 'Qo\'y Go\'shtli Kuskovoy', price: 26000, desc: 'Dumba bilan tizilgan momiq qo\'y go\'shti' },
        { name: 'Tovuq Gril Kabob', price: 20000, desc: 'Maxsus sousda marinadlangan barra tovuq lahm' },
        { name: 'Jigar va Dumba Kabob', price: 21000, desc: 'Yumshoq jigar va dumba kabob' },
        { name: 'Ribay Steyk', price: 85000, desc: 'Ko\'mirda qovurilgan suvli ribay steyk garnir bilan' },
        { name: 'Qanotcha Kabob', price: 22000, desc: 'Spetsiyali qizarib pishgan tovuq qanotlari' },
      ],
    },
    {
      category: 'Sho\'rvalar',
      station: StationType.KITCHEN,
      items: [
        { name: 'Ko\'za Sho\'rva', price: 36000, desc: 'Sopol ko\'zada uzoq qaynagan go\'shtli xushbo\'y sho\'rva' },
        { name: 'Qo\'y Go\'shtli Mastava', price: 32000, desc: 'Guruch va mayda to\'g\'ralgan go\'shtli milliy sho\'rva, suzma bilan' },
        { name: 'Chuchvara Sho\'rva', price: 34000, desc: 'Qo\'lda tugilgan mayda mitti chuchvaralar' },
      ],
    },
    {
      category: 'Salatlar',
      station: StationType.KITCHEN,
      items: [
        { name: 'Klassik Achchiq-Chuchuk', price: 16000, desc: 'Yozgi shirin pomidor, yupqa archilgan piyoz va achchiq qalampir' },
        { name: 'Sezar Salati', price: 35000, desc: 'Aysberg, grilda pishgan tovuq filesi, parmezan va maxsus sous' },
        { name: 'Bahor Salati', price: 18000, desc: 'Bodring, turp, ko\'katlar va sarxil smetana' },
        { name: 'Choponcha Suzma', price: 14000, desc: 'Ko\'katlar va sarimsoq bilan boyitilgan tog\' suzmasi' },
      ],
    },
    {
      category: 'Nonlar',
      station: StationType.PASTRY,
      items: [
        { name: 'Tandir Somsa', price: 15000, desc: 'Tandirda qarsildoq qilib yopilgan to\'yimli go\'shtli somsa' },
        { name: 'Qatlama Patir Non', price: 10000, desc: 'Sariyoqli xushbo\'y qat-qat patir' },
        { name: 'Toshkent Tandir Non', price: 5000, desc: 'Issiq tandir non' },
      ],
    },
    {
      category: 'Ichimliklar',
      station: StationType.BAR,
      items: [
        { name: 'Shosh Maxsus Choyi', price: 18000, desc: 'Choynakda damlangan yangi rayhon, limon va zanjabil' },
        { name: 'Ko\'k Choy 95', price: 8000, desc: 'Samovarda damlangan an\'anaviy 95 ko\'k choy' },
        { name: 'Qora Choy', price: 12000, desc: 'Hushbo\'y limon va barra yalpiz bilan' },
        { name: 'Yangi Siqilgan Apelsin Sharbati', price: 28000, desc: '300 ml 100% tabiiy fresh sharbat' },
        { name: 'Muzdek Milliy Ayron', price: 12000, desc: 'Suzmadan tayyorlangan chanqoqbosti ayron' },
        { name: 'Klassik Moxito', price: 24000, desc: 'Muzdek tetiklashtiruvchi kokteyl' },
      ],
    },
    {
      category: 'Shirinliklar',
      station: StationType.PASTRY,
      items: [
        { name: 'Shokoladli Medovik', price: 28000, desc: 'Asalli va nozik qaymoqli xamir qavatlari' },
        { name: 'Nyu-York Chizkeyk', price: 32000, desc: 'Klassik pishirilgan chizkeyk mevali sous bilan' },
        { name: 'Turkcha Paxlava', price: 26000, desc: 'Shirali qarsildoq qatlamlar va sarxil pista' },
      ],
    },
  ];

  const allMenuItems: any[] = [];
  let catSort = 1;
  for (const group of menuConfig) {
    let cat = await prisma.category.findFirst({
      where: { restaurantId: restaurant.id, name: group.category },
    });
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          name: group.category,
          sortOrder: catSort++,
        },
      });
    }

    const station = stations[group.station] || stations[StationType.KITCHEN];

    let itemSort = 1;
    for (const item of group.items) {
      let mi = await prisma.menuItem.findFirst({
        where: { restaurantId: restaurant.id, name: item.name },
      });
      if (!mi) {
        mi = await prisma.menuItem.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: cat.id,
            stationId: station.id,
            name: item.name,
            description: item.desc,
            basePriceTiyin: BigInt(item.price * 100),
            isAvailable: true,
            sortOrder: itemSort++,
          },
        });
      }
      allMenuItems.push(mi);
    }
  }
  console.log(`   🍽️ Jami ${allMenuItems.length} ta xaridorgir taomlar muvaffaqiyatli yuklandi.`);

  // 6. 4 OYLIK (120 KUNLIK) SMENALAR VA ANALITIK BUYURTMALAR
  console.log('\n6. 4 oylik (120 kunlik) to\'liq buxgalteriya, smenalar va buyurtmalar yaratilmoqda...');
  console.log('   (Har kuni 12-16 tadan stol to\'liq hisob-kitob qilinadi, ~1,700 buyurtma)...');

  const cashier = createdUsers[Role.CASHIER];
  const waiter1 = createdUsers[Role.WAITER];
  const waiter2 = staffSpecs.find(s => s.phone === '+998911000005') ? await prisma.user.findUnique({ where: { phone: '+998911000005' } }) : waiter1;
  const defaultStation = stations[StationType.KITCHEN];

  let orderNumberSeq = 5000;
  let totalRevenueTiyin = 0n;
  let totalVisitsCount = 0;

  // 120 kundan boshlab kechagacha (o'tgan kunlar)
  for (let daysAgo = 120; daysAgo >= 1; daysAgo--) {
    const shiftDate = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    const shiftStart = new Date(shiftDate);
    shiftStart.setHours(9, 30, 0, 0);
    const shiftEnd = new Date(shiftDate);
    shiftEnd.setHours(23, 15, 0, 0);

    // Kunning smenasi
    const shift = await prisma.shift.create({
      data: {
        restaurantId: restaurant.id,
        userId: cashier.id,
        status: ShiftStatus.CLOSED,
        openedAt: shiftStart,
        closedAt: shiftEnd,
        startingCashTiyin: 50000000n, // 500,000 UZS
        notes: `${shiftDate.toLocaleDateString('uz-UZ')} kunlik to'liq yakunlangan kassa smenasi`,
      },
    });

    // Kunning tashriflari (hafta oxirlarida ko'proq)
    const isWeekend = shiftDate.getDay() === 0 || shiftDate.getDay() === 6;
    const visitsToday = isWeekend ? 16 : 12;

    let dayCashTiyin = 0n;
    let dayTerminalTiyin = 0n;

    for (let v = 0; v < visitsToday; v++) {
      totalVisitsCount++;
      orderNumberSeq++;
      const table = allTables[v % allTables.length];
      const assignedWaiter = (v % 2 === 0) ? waiter1 : waiter2;

      const visitOpenTime = new Date(shiftStart.getTime() + (v * 45 + 15) * 60 * 1000);
      const visitCloseTime = new Date(visitOpenTime.getTime() + 65 * 60 * 1000);

      const visit = await prisma.visit.create({
        data: {
          restaurantId: restaurant.id,
          tableId: table.id,
          pinCode: `${1000 + (v % 9000)}`,
          status: VisitStatus.CLOSED,
          openedAt: visitOpenTime,
          closedAt: visitCloseTime,
          waiterId: assignedWaiter.id,
          serviceChargeBpsSnapshot: 1000,
        },
      });

      const order = await prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          visitId: visit.id,
          orderNumber: orderNumberSeq,
          status: OrderStatus.SERVED,
          createdByRole: 'WAITER',
          createdById: assignedWaiter.id,
          createdAt: visitOpenTime,
        },
      });

      // 3-5 xil taom
      const itemsInOrder = 3 + (v % 3);
      let subtotalTiyin = 0n;

      for (let i = 0; i < itemsInOrder; i++) {
        const itemIdx = (daysAgo * 7 + v * 3 + i) % allMenuItems.length;
        const mi = allMenuItems[itemIdx];
        const qty = 1 + ((v + i) % 3);
        const itemPrice = BigInt(mi.basePriceTiyin);
        subtotalTiyin += itemPrice * BigInt(qty);

        await prisma.orderItem.create({
          data: {
            restaurantId: restaurant.id,
            orderId: order.id,
            menuItemId: mi.id,
            stationId: mi.stationId || defaultStation.id,
            status: OrderItemStatus.SERVED,
            quantity: qty,
            snapshotName: mi.name,
            snapshotPriceTiyin: itemPrice,
          },
        });
      }

      // Xizmat haqi va to'lov
      const serviceTiyin = (subtotalTiyin * 1000n) / 10000n;
      const totalDueTiyin = subtotalTiyin + serviceTiyin;
      totalRevenueTiyin += totalDueTiyin;

      // 60% Terminal, 40% Naqd
      const isTerminal = (v % 5 !== 0 && v % 5 !== 2);
      if (isTerminal) {
        dayTerminalTiyin += totalDueTiyin;
      } else {
        dayCashTiyin += totalDueTiyin;
      }

      await prisma.payment.create({
        data: {
          restaurantId: restaurant.id,
          visitId: visit.id,
          shiftId: shift.id,
          cashierId: cashier.id,
          method: isTerminal ? PaymentMethod.TERMINAL : PaymentMethod.CASH,
          amountTiyin: totalDueTiyin,
          tenderedCashTiyin: isTerminal ? null : totalDueTiyin + 2000000n,
          changeTiyin: isTerminal ? null : 2000000n,
          status: PaymentStatus.COMPLETED,
          createdAt: visitCloseTime,
        },
      });

      // Ba'zi stollardan ofitsiant chaqiruvi
      if (v % 3 === 0) {
        await prisma.serviceCall.create({
          data: {
            restaurantId: restaurant.id,
            visitId: visit.id,
            tableId: table.id,
            type: 'WAITER',
            status: 'RESOLVED',
            acknowledgedByUserId: assignedWaiter.id,
            resolvedByUserId: assignedWaiter.id,
            createdAt: visitOpenTime,
            resolvedAt: new Date(visitOpenTime.getTime() + 4 * 60 * 1000),
          },
        });
      }
    }

    // Smenani hisobotlar bilan yopish
    const expectedCash = 50000000n + dayCashTiyin;
    await prisma.shift.update({
      where: { id: shift.id },
      data: {
        closingCashTiyin: expectedCash,
        countedCashTiyin: expectedCash,
        expectedCashTiyin: expectedCash,
        terminalTotalTiyin: dayTerminalTiyin,
        differenceTiyin: 0n,
      },
    });
  }

  // 7. BUGUNGI KUN: JONLI VA FAOL BUYURTMALAR (KASSA, OFITSIANT, OSHXONA UCHUN)
  console.log('\n7. Bugungi kunlik faol smena va jonli stollar tayyorlanmoqda...');
  const todayShiftStart = new Date(now);
  todayShiftStart.setHours(9, 0, 0, 0);

  const todayShift = await prisma.shift.create({
    data: {
      restaurantId: restaurant.id,
      userId: cashier.id,
      status: ShiftStatus.OPEN,
      openedAt: todayShiftStart,
      startingCashTiyin: 60000000n, // 600,000 UZS
      notes: 'Bugungi faol ishchi smena',
    },
  });

  // A) Bugun tugallangan 5 ta hisob (kassada daromad ko'rinishi uchun)
  for (let i = 0; i < 5; i++) {
    totalVisitsCount++;
    orderNumberSeq++;
    const table = allTables[i];
    const visitOpen = new Date(todayShiftStart.getTime() + (i * 35 + 20) * 60 * 1000);
    const visitClose = new Date(visitOpen.getTime() + 45 * 60 * 1000);

    const v = await prisma.visit.create({
      data: {
        restaurantId: restaurant.id,
        tableId: table.id,
        pinCode: '7788',
        status: VisitStatus.CLOSED,
        openedAt: visitOpen,
        closedAt: visitClose,
        waiterId: waiter1.id,
        serviceChargeBpsSnapshot: 1000,
      },
    });

    const o = await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        visitId: v.id,
        orderNumber: orderNumberSeq,
        status: OrderStatus.SERVED,
        createdByRole: 'WAITER',
        createdById: waiter1.id,
        createdAt: visitOpen,
      },
    });

    let sub = 0n;
    for (let j = 0; j < 3; j++) {
      const mi = allMenuItems[j];
      const p = BigInt(mi.basePriceTiyin);
      sub += p;
      await prisma.orderItem.create({
        data: {
          restaurantId: restaurant.id,
          orderId: o.id,
          menuItemId: mi.id,
          stationId: mi.stationId || defaultStation.id,
          status: OrderItemStatus.SERVED,
          quantity: 1,
          snapshotName: mi.name,
          snapshotPriceTiyin: p,
        },
      });
    }

    const total = sub + (sub * 1000n) / 10000n;
    totalRevenueTiyin += total;

    await prisma.payment.create({
      data: {
        restaurantId: restaurant.id,
        visitId: v.id,
        shiftId: todayShift.id,
        cashierId: cashier.id,
        method: i % 2 === 0 ? PaymentMethod.TERMINAL : PaymentMethod.CASH,
        amountTiyin: total,
        status: PaymentStatus.COMPLETED,
        createdAt: visitClose,
      },
    });
  }

  // B) Hozirda stolda o'tirgan 4 ta faol jonli buyurtmalar (Ochiq hisoblar):
  const liveTablesData = [
    { tableNum: 1, waiter: waiter1, items: [0, 6, 17], status: OrderStatus.PREPARING, label: 'Palov va Kabob pishmoqda' },
    { tableNum: 3, waiter: waiter2, items: [1, 7, 18], status: OrderStatus.READY, label: 'Tayyor, eltish kutilmoqda' },
    { tableNum: 21, waiter: waiter1, items: [2, 3, 10, 19], status: OrderStatus.SERVED, label: 'VIP zal — taomlar yetkazilgan, hisob kutmoqda' },
    { tableNum: 32, waiter: waiter2, items: [4, 8, 20], status: OrderStatus.CONFIRMED, label: 'Terrasa — yangi tasdiqlangan' },
  ];

  for (const lt of liveTablesData) {
    const table = allTables.find(t => t.number === lt.tableNum) || allTables[0];
    await prisma.table.update({
      where: { id: table.id },
      data: { status: TableStatus.OCCUPIED, assignedWaiterId: lt.waiter.id },
    });

    orderNumberSeq++;
    const visitOpen = new Date(now.getTime() - 25 * 60 * 1000); // 25 daqiqa oldin ochilgan

    const visit = await prisma.visit.create({
      data: {
        restaurantId: restaurant.id,
        tableId: table.id,
        pinCode: '5566',
        status: VisitStatus.ACTIVE,
        openedAt: visitOpen,
        waiterId: lt.waiter.id,
        serviceChargeBpsSnapshot: 1000,
      },
    });

    const order = await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        visitId: visit.id,
        orderNumber: orderNumberSeq,
        status: lt.status,
        createdByRole: 'WAITER',
        createdById: lt.waiter.id,
        createdAt: visitOpen,
        notes: lt.label,
      },
    });

    for (const idx of lt.items) {
      const mi = allMenuItems[idx % allMenuItems.length];
      const p = BigInt(mi.basePriceTiyin);
      await prisma.orderItem.create({
        data: {
          restaurantId: restaurant.id,
          orderId: order.id,
          menuItemId: mi.id,
          stationId: mi.stationId || defaultStation.id,
          status: lt.status === OrderStatus.SERVED ? OrderItemStatus.SERVED : OrderItemStatus.PREPARING,
          quantity: 2,
          snapshotName: mi.name,
          snapshotPriceTiyin: p,
        },
      });
    }

    // Faol ofitsiant chaqiruvi
    if (lt.tableNum === 21) {
      await prisma.serviceCall.create({
        data: {
          restaurantId: restaurant.id,
          visitId: visit.id,
          tableId: table.id,
          type: 'BILL',
          status: 'PENDING',
          createdAt: new Date(now.getTime() - 5 * 60 * 1000),
        },
      });
    }
  }

  const revenueBillions = (Number(totalRevenueTiyin / 100n) / 1000000000).toFixed(2);
  const revenueMillions = (Number(totalRevenueTiyin / 100n) / 1000000).toLocaleString('uz-UZ');

  console.log('\n================================================================');
  console.log('🎉 "SHOSH SAROYI" RESTORANI 4 OYLIK TARIX BILAN TAYYOR!');
  console.log('================================================================');
  console.log(`• Restoran nomi:     ${restaurant.name}`);
  console.log(`• Restoran ID/Slug:  ${restaurant.slug} (${restaurant.id})`);
  console.log(`• Faoliyat davri:    120 kun (4 oy)`);
  console.log(`• Jami tashriflar:   ${totalVisitsCount.toLocaleString()} ta`);
  console.log(`• Jami tushum (4 oy): ${revenueMillions} UZS (~${revenueBillions} mlrd so'm)`);
  console.log(`• Zallar va stollar: 3 ta zal, 24 ta stol`);
  console.log(`• Menyudagi taomlar: ${allMenuItems.length} ta xilma-xil taom`);
  console.log('\n🔑 TIZIMGA KIRISH UCHUN ROLLAR VA AKKAUNTLAR (Parol: Demo12345!):');
  console.log('1. MENEJER:          +998911000002 (Davron Aliyev)');
  console.log('2. KASSIR:           +998911000003 (Nilufar Karimova)');
  console.log('3. OFITSIANT 1:      +998911000004 (Sardor Rustamov)');
  console.log('4. OFITSIANT 2:      +998911000005 (Malika Rahimova)');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('Xatolik:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
