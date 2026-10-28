import { prisma } from './db.js';
import { PaymentMethod, PaymentStatus, TableStatus, VisitStatus, OrderStatus, OrderItemStatus } from '@prisma/client';

async function seedMonthlyDemoData() {
  console.log('🚀 1 oylik tahliliy va 12 ta buyurtma ma\'lumotlarini kiritish boshlandi...');

  const restaurants = await prisma.restaurant.findMany({
    include: {
      tables: true,
      menuItems: true,
      stations: true,
    },
  });

  if (restaurants.length === 0) {
    console.error('❌ Xatolik: Hech qanday restoran topilmadi.');
    return;
  }

  // Barcha xodimlarni olamiz
  const waiterUser = await prisma.user.findFirst({
    where: { phone: { in: ['+998905555555', '+998781136963'] } },
  }) || await prisma.user.findFirst();

  const cashierUser = await prisma.user.findFirst({
    where: { phone: { in: ['+998904444444', '+998781136963'] } },
  }) || await prisma.user.findFirst();

  if (!waiterUser || !cashierUser) {
    console.error('❌ Xatolik: Ofitsiant yoki Kassir foydalanuvchisi topilmadi.');
    return;
  }

  for (const restaurant of restaurants) {
    console.log(`\n🏢 Restoran: ${restaurant.name} (${restaurant.id})`);

    let tables = [...restaurant.tables];
    if (tables.length === 0) {
      console.log('   🔨 Stollar yaratilmoqda...');
      let hall = await prisma.hall.findFirst({ where: { restaurantId: restaurant.id } });
      if (!hall) {
        hall = await prisma.hall.create({
          data: {
            restaurantId: restaurant.id,
            name: 'Asosiy Zal',
            sortOrder: 1,
          },
        });
      }
      for (let n = 1; n <= 12; n++) {
        const t = await prisma.table.create({
          data: {
            restaurantId: restaurant.id,
            hallId: hall.id,
            number: n,
            capacity: 4,
            status: TableStatus.FREE,
            qrToken: `qr_${restaurant.slug}_tbl_${n}`,
          },
        });
        tables.push(t);
      }
    }

    let allMenuItems = [...restaurant.menuItems];
    if (allMenuItems.length === 0) {
      console.log('   🍲 Taomlar yaratilmoqda...');
      let cat = await prisma.category.findFirst({ where: { restaurantId: restaurant.id } });
      if (!cat) {
        cat = await prisma.category.create({
          data: {
            restaurantId: restaurant.id,
            name: 'Milliy Taomlar',
            sortOrder: 1,
          },
        });
      }
      let station = restaurant.stations[0];
      if (!station) {
        station = await prisma.preparationStation.create({
          data: {
            restaurantId: restaurant.id,
            name: 'Asosiy Oshxona',
            type: 'KITCHEN',
          },
        });
      }
      const demoDishes = [
        { name: 'Choyxona Oshi', price: 38000, desc: 'Toshkent to\'y oshi mayiz va noxat bilan' },
        { name: 'Mol go\'shtli Shashlik', price: 24000, desc: 'Lula va qiyma kabob' },
        { name: 'Qozon kabob', price: 55000, desc: 'Qovurilgan go\'sht va kartoshka' },
        { name: 'Tandir somsa', price: 14000, desc: 'Go\'shtli va qarsildoq xamir' },
        { name: 'Achchiq-chuchuk', price: 15000, desc: 'Pomidor, piyoz, qalampir' },
        { name: 'Tandir non', price: 5000, desc: 'Issiq patir non' },
        { name: 'Ko\'k choy', price: 6000, desc: 'Ko\'k choy 95' },
        { name: 'Ayron', price: 12000, desc: 'Muzdek milliy ayron' },
      ];
      for (const d of demoDishes) {
        const m = await prisma.menuItem.create({
          data: {
            restaurantId: restaurant.id,
            categoryId: cat.id,
            stationId: station.id,
            name: d.name,
            description: d.desc,
            basePriceTiyin: BigInt(d.price * 100),
            isAvailable: true,
          },
        });
        allMenuItems.push(m);
      }
    }

    // Oshxona stansiyasi
    let defaultStation = restaurant.stations[0];
    if (!defaultStation) {
      defaultStation = await prisma.preparationStation.create({
        data: {
          restaurantId: restaurant.id,
          name: 'Asosiy Oshxona',
          type: 'KITCHEN',
        },
      });
    }

    // 1. Kassir uchun smena topish yoki yaratish
    let shift = await prisma.shift.findFirst({
      where: { restaurantId: restaurant.id, userId: cashierUser.id, status: 'OPEN' },
    });
    if (!shift) {
      shift = await prisma.shift.create({
        data: {
          restaurantId: restaurant.id,
          userId: cashierUser.id,
          status: 'OPEN',
          openedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
          startingCashTiyin: 50000000n, // 500,000 UZS
        },
      });
    }

    // 2. O'tgan 30 kunlik buyurtmalar (Tarixiy hisobotlar uchun)
    console.log('   ⏳ O\'tgan 30 kunlik tahliliy ma\'lumotlar yaratilmoqda (~1,800 buyurtma)...');

    const now = Date.now();
    let orderCounter = 100;

    // 30 kun bo'yicha aylanamiz
    for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
      const dayDate = new Date(now - dayOffset * 24 * 3600 * 1000 + 4 * 3600 * 1000); // kunduzi soat 13:00 atrofida
      const visitsPerDay = 18; // Har kuni 18 ta stol tashrifi

      for (let v = 0; v < visitsPerDay; v++) {
        const table = tables[v % tables.length];
        const visitTime = new Date(dayDate.getTime() + v * 25 * 60 * 1000);

        const visit = await prisma.visit.create({
          data: {
            restaurantId: restaurant.id,
            tableId: table.id,
            pinCode: '1234',
            status: VisitStatus.CLOSED,
            openedAt: visitTime,
            closedAt: new Date(visitTime.getTime() + 50 * 60 * 1000),
            waiterId: waiterUser.id,
            serviceChargeBpsSnapshot: 1000, // 10%
          },
        });

        orderCounter++;
        const order = await prisma.order.create({
          data: {
            restaurantId: restaurant.id,
            visitId: visit.id,
            orderNumber: orderCounter,
            status: OrderStatus.SERVED,
            createdByRole: 'GUEST',
            createdById: waiterUser.id,
            createdAt: visitTime,
          },
        });

        // 3-5 ta taom qo'shamiz
        const itemCount = 3 + (v % 3);
        let orderSubtotalTiyin = 0n;

        for (let i = 0; i < itemCount; i++) {
          const menuItem = allMenuItems[(v * 3 + i) % allMenuItems.length];
          const qty = 1 + ((v + i) % 3);
          const priceTiyin = BigInt(menuItem.basePriceTiyin || 3000000n);
          orderSubtotalTiyin += priceTiyin * BigInt(qty);

          await prisma.orderItem.create({
            data: {
              restaurantId: restaurant.id,
              orderId: order.id,
              menuItemId: menuItem.id,
              stationId: defaultStation.id,
              status: OrderItemStatus.SERVED,
              quantity: qty,
              snapshotName: menuItem.name,
              snapshotPriceTiyin: priceTiyin,
            },
          });
        }

        // 10% xizmat haqi
        const serviceChargeTiyin = (orderSubtotalTiyin * 1000n) / 10000n;
        const totalDueTiyin = orderSubtotalTiyin + serviceChargeTiyin;

        // To'lov turi: 58% Terminal, 42% Naqd (yoki QR)
        const isTerminal = (v % 5 !== 0 && v % 5 !== 3);
        await prisma.payment.create({
          data: {
            restaurantId: restaurant.id,
            visitId: visit.id,
            shiftId: shift.id,
            cashierId: cashierUser.id,
            method: isTerminal ? PaymentMethod.TERMINAL : PaymentMethod.CASH,
            amountTiyin: totalDueTiyin,
            tenderedCashTiyin: isTerminal ? null : totalDueTiyin + 1000000n, // naqd bo'lsa ozroq ortiqcha
            changeTiyin: isTerminal ? null : 1000000n,
            status: PaymentStatus.COMPLETED,
            createdAt: new Date(visitTime.getTime() + 48 * 60 * 1000),
          },
        });

        // Ofitsiant chaqiruvi (yechilgan)
        if (v % 2 === 0) {
          await prisma.serviceCall.create({
            data: {
              restaurantId: restaurant.id,
              visitId: visit.id,
              tableId: table.id,
              type: 'WAITER',
              status: 'RESOLVED',
              acknowledgedByUserId: waiterUser.id,
              resolvedByUserId: waiterUser.id,
              createdAt: visitTime,
              resolvedAt: new Date(visitTime.getTime() + 5 * 60 * 1000),
            },
          });
        }
      }
    }

    // 3. Bugungi 12 ta aniq simulyatsiya buyurtmalari!
    console.log('   🎯 Bugungi 12 ta simulyatsiya buyurtmalari yaratilmoqda...');

    const todayDate = new Date();
    const simulatedOrders = [
      {
        tableIndex: 0,
        waiter: waiterUser,
        isClosed: true,
        method: PaymentMethod.TERMINAL,
        dishes: [
          { name: 'Osh', qty: 2, price: 38000 },
          { name: 'Achchiq-chuchuk', qty: 1, price: 15000 },
          { name: 'Tandir non', qty: 2, price: 5000 },
          { name: 'Ko\'k choy', qty: 1, price: 6000 },
        ],
      },
      {
        tableIndex: 1,
        waiter: waiterUser,
        isClosed: true,
        method: PaymentMethod.CASH,
        dishes: [
          { name: 'Qiyma shashlik', qty: 4, price: 24000 },
          { name: 'Tandir non', qty: 2, price: 5000 },
          { name: 'Salqin choy', qty: 1, price: 12000 },
          { name: 'Qora choy', qty: 1, price: 6000 },
        ],
      },
      {
        tableIndex: 2,
        waiter: waiterUser,
        isClosed: true,
        method: PaymentMethod.TERMINAL,
        dishes: [
          { name: 'Qozon kabob', qty: 1, price: 55000 },
          { name: 'Osh', qty: 1, price: 38000 },
          { name: 'Bahor salati', qty: 1, price: 18000 },
          { name: 'Tandir non', qty: 2, price: 5000 },
          { name: 'Ko\'k choy', qty: 2, price: 6000 },
        ],
      },
      {
        tableIndex: 3,
        waiter: waiterUser,
        isClosed: true,
        method: PaymentMethod.TERMINAL,
        dishes: [
          { name: 'Osh', qty: 3, price: 38000 },
          { name: 'Somsa', qty: 3, price: 14000 },
          { name: 'Achchiq-chuchuk', qty: 2, price: 15000 },
          { name: 'Tandir non', qty: 3, price: 5000 },
          { name: 'Ko\'k choy', qty: 2, price: 6000 },
        ],
      },
      {
        tableIndex: 4,
        waiter: waiterUser,
        isClosed: true,
        method: PaymentMethod.CASH,
        dishes: [
          { name: 'Jigar shashlik', qty: 2, price: 24000 },
          { name: 'Osh', qty: 1, price: 38000 },
          { name: 'Tandir non', qty: 1, price: 5000 },
          { name: 'Ayron', qty: 1, price: 12000 },
        ],
      },
      {
        tableIndex: 5,
        waiter: waiterUser,
        isClosed: true,
        method: PaymentMethod.TERMINAL,
        dishes: [
          { name: 'Qozon kabob', qty: 4, price: 55000 },
          { name: 'Somsa', qty: 4, price: 14000 },
          { name: 'Bahor salati', qty: 2, price: 18000 },
          { name: 'Tandir non', qty: 4, price: 5000 },
          { name: 'Ko\'k choy', qty: 2, price: 6000 },
        ],
      },
      {
        tableIndex: 6,
        waiter: waiterUser,
        isClosed: true,
        method: PaymentMethod.TERMINAL,
        dishes: [
          { name: 'Go\'shtli somsa', qty: 2, price: 14000 },
          { name: 'Ko\'k choy', qty: 1, price: 6000 },
          { name: 'Tandir non', qty: 1, price: 5000 },
        ],
      },
      {
        tableIndex: 7,
        waiter: waiterUser,
        isClosed: true,
        method: PaymentMethod.CASH,
        dishes: [
          { name: 'Shashlik', qty: 3, price: 24000 },
          { name: 'Qozon kabob', qty: 1, price: 55000 },
          { name: 'Achchiq-chuchuk', qty: 1, price: 15000 },
          { name: 'Tandir non', qty: 2, price: 5000 },
          { name: 'Ko\'k choy', qty: 2, price: 6000 },
        ],
      },
      {
        tableIndex: 8,
        waiter: waiterUser,
        isClosed: true,
        method: PaymentMethod.TERMINAL,
        dishes: [
          { name: 'To\'y oshi', qty: 5, price: 38000 },
          { name: 'Achchiq-chuchuk', qty: 3, price: 15000 },
          { name: 'Tandir non', qty: 4, price: 5000 },
          { name: 'Choy', qty: 3, price: 6000 },
          { name: 'Ayron', qty: 2, price: 12000 },
        ],
      },
      {
        tableIndex: 9,
        waiter: waiterUser,
        isClosed: true,
        method: PaymentMethod.TERMINAL,
        dishes: [
          { name: 'Qozon kabob', qty: 2, price: 55000 },
          { name: 'Shashlik', qty: 2, price: 24000 },
          { name: 'Tandir non', qty: 2, price: 5000 },
          { name: 'Choy', qty: 1, price: 6000 },
        ],
      },
      // 11 va 12: Hozirda faol stollar (Ofitsiant va Kassirda jonli ko'rinishi uchun!)
      {
        tableIndex: 10 % tables.length,
        waiter: waiterUser,
        isClosed: false,
        method: PaymentMethod.CASH,
        dishes: [
          { name: 'Choyxona Oshi', qty: 2, price: 38000 },
          { name: 'Achchiq-chuchuk', qty: 1, price: 15000 },
          { name: 'Tandir non', qty: 2, price: 5000 },
          { name: 'Ko\'k choy', qty: 1, price: 6000 },
        ],
      },
      {
        tableIndex: 11 % tables.length,
        waiter: waiterUser,
        isClosed: false,
        method: PaymentMethod.TERMINAL,
        dishes: [
          { name: 'Mol go\'shtli Shashlik', qty: 4, price: 24000 },
          { name: 'Qozon kabob', qty: 2, price: 55000 },
          { name: 'Tandir non', qty: 3, price: 5000 },
          { name: 'Ko\'k choy', qty: 2, price: 6000 },
        ],
      },
    ];

    for (let idx = 0; idx < simulatedOrders.length; idx++) {
      const sim = simulatedOrders[idx];
      const table = tables[sim.tableIndex % tables.length];
      const orderTime = new Date(todayDate.getTime() - (12 - idx) * 15 * 60 * 1000);

      // Stol holatini belgilash
      if (!sim.isClosed) {
        await prisma.table.update({
          where: { id: table.id },
          data: { status: TableStatus.OCCUPIED },
        });
      }

      const visit = await prisma.visit.create({
        data: {
          restaurantId: restaurant.id,
          tableId: table.id,
          pinCode: '5555',
          status: sim.isClosed ? VisitStatus.CLOSED : VisitStatus.ACTIVE,
          openedAt: orderTime,
          closedAt: sim.isClosed ? new Date(orderTime.getTime() + 35 * 60 * 1000) : null,
          waiterId: sim.waiter.id,
          serviceChargeBpsSnapshot: 1000,
        },
      });

      orderCounter++;
      const order = await prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          visitId: visit.id,
          orderNumber: orderCounter,
          status: sim.isClosed ? OrderStatus.SERVED : OrderStatus.CONFIRMED,
          createdByRole: 'GUEST',
          createdById: sim.waiter.id,
          createdAt: orderTime,
        },
      });

      let orderSubtotal = 0;

      for (const d of sim.dishes) {
        // Mos keladigan menuItem topamiz
        const matchItem = allMenuItems.find((m) =>
          m.name.toLowerCase().includes(d.name.toLowerCase()) ||
          d.name.toLowerCase().includes(m.name.toLowerCase())
        ) || allMenuItems[idx % allMenuItems.length];

        const linePrice = d.price * 100; // tiyin
        orderSubtotal += d.price * d.qty;

        await prisma.orderItem.create({
          data: {
            restaurantId: restaurant.id,
            orderId: order.id,
            menuItemId: matchItem.id,
            stationId: defaultStation.id,
            status: sim.isClosed ? OrderItemStatus.SERVED : OrderItemStatus.PREPARING,
            quantity: d.qty,
            snapshotName: d.name,
            snapshotPriceTiyin: BigInt(linePrice),
          },
        });
      }

      // Agar yopilgan bo'lsa, to'lovni ham kiritamiz
      if (sim.isClosed) {
        const subtotalTiyin = BigInt(orderSubtotal) * 100n;
        const serviceTiyin = (subtotalTiyin * 1000n) / 10000n;
        const totalTiyin = subtotalTiyin + serviceTiyin;

        await prisma.payment.create({
          data: {
            restaurantId: restaurant.id,
            visitId: visit.id,
            shiftId: shift.id,
            cashierId: cashierUser.id,
            method: sim.method,
            amountTiyin: totalTiyin,
            status: PaymentStatus.COMPLETED,
            createdAt: new Date(orderTime.getTime() + 32 * 60 * 1000),
          },
        });
      }
    }

    console.log(`   ✅ ${restaurant.name} uchun barcha buyurtmalar va tahlillar muvaffaqiyatli saqlandi!`);
  }

  console.log('\n🎉 BARCHA MA\'LUMOTLAR MUVAFFAQIYATLI YARATILDI!');
}

seedMonthlyDemoData()
  .catch((err) => {
    console.error('Xatolik yuz berdi:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
