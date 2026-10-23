import crypto from 'node:crypto';
import { PrismaClient, Role, StationType, TableStatus, VisitStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('XATOLIK: Production muhitida demo ma\'lumotlar bilan seed qilish qat\'iy taqiqlangan!');
    console.error('Super Admin yaratish uchun xavfsiz buyruqdan foydalaning:');
    console.error('  npm run bootstrap:superadmin --workspace=@menurest/api');
    process.exit(1);
  }

  console.log('--- MENUREST.UZ DATABASE SEED BOSHLANDI ---');

  const demoPasswordHash = await bcrypt.hash('Demo12345!', 10);

  // 1. FOYDALANUVCHILARNI YARATISH (IDEMPOTENT)
  console.log('1. Demo foydalanuvchilar tekshirilmoqda/yaratilmoqda...');
  const superAdmin = await prisma.user.upsert({
    where: { phone: '+998901111111' },
    update: { fullName: 'Platforma Super Admini', isSuperAdmin: true },
    create: {
      phone: '+998901111111',
      fullName: 'Platforma Super Admini',
      passwordHash: demoPasswordHash,
      isSuperAdmin: true,
    },
  });

  const boss = await prisma.user.upsert({
    where: { phone: '+998902222222' },
    update: { fullName: 'Alisher Usmonov (Boss)' },
    create: {
      phone: '+998902222222',
      fullName: 'Alisher Usmonov (Boss)',
      passwordHash: demoPasswordHash,
    },
  });

  const manager = await prisma.user.upsert({
    where: { phone: '+998903333333' },
    update: { fullName: 'Bobur Rahimov (Manager)' },
    create: {
      phone: '+998903333333',
      fullName: 'Bobur Rahimov (Manager)',
      passwordHash: demoPasswordHash,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { phone: '+998904444444' },
    update: { fullName: 'Madina Karimova (Cashier)' },
    create: {
      phone: '+998904444444',
      fullName: 'Madina Karimova (Cashier)',
      passwordHash: demoPasswordHash,
    },
  });

  const waiter = await prisma.user.upsert({
    where: { phone: '+998905555555' },
    update: { fullName: 'Jahongir Rustamov (Waiter)' },
    create: {
      phone: '+998905555555',
      fullName: 'Jahongir Rustamov (Waiter)',
      passwordHash: demoPasswordHash,
    },
  });

  const cook = await prisma.user.upsert({
    where: { phone: '+998906666666' },
    update: { fullName: 'Usta Shuhrat (Kitchen)' },
    create: {
      phone: '+998906666666',
      fullName: 'Usta Shuhrat (Kitchen)',
      passwordHash: demoPasswordHash,
    },
  });

  const boss2 = await prisma.user.upsert({
    where: { phone: '+998907777777' },
    update: { fullName: 'Farhod Nazarov (Gijduvon Boss)' },
    create: {
      phone: '+998907777777',
      fullName: 'Farhod Nazarov (Gijduvon Boss)',
      passwordHash: demoPasswordHash,
    },
  });

  // 2. 1-RESTORAN: RAYHON MILLIY TAOMLAR (CHILONZOR)
  console.log('2. 1-Restoran: Rayhon Milliy Taomlar yaratilmoqda...');
  const rest1 = await prisma.restaurant.upsert({
    where: { slug: 'rayhon-chilonzor' },
    update: { name: 'Rayhon Milliy Taomlar', serviceChargeBps: 1000 },
    create: {
      name: 'Rayhon Milliy Taomlar',
      slug: 'rayhon-chilonzor',
      phone: '+998712001122',
      address: 'Toshkent sh., Chilonzor 9-mavze, 12-uy',
      serviceChargeBps: 1000, // 10%
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
    },
  });

  // Restoran 1 Membership & Rollar
  const staffAssignments: { user: typeof boss; role: Role }[] = [
    { user: boss, role: Role.BOSS },
    { user: manager, role: Role.MANAGER },
    { user: cashier, role: Role.CASHIER },
    { user: waiter, role: Role.WAITER },
    { user: cook, role: Role.KITCHEN },
  ];

  for (const item of staffAssignments) {
    const membership = await prisma.restaurantMembership.upsert({
      where: {
        restaurantId_userId: {
          restaurantId: rest1.id,
          userId: item.user.id,
        },
      },
      update: {},
      create: {
        restaurantId: rest1.id,
        userId: item.user.id,
      },
    });

    await prisma.membershipRole.upsert({
      where: {
        membershipId_role: {
          membershipId: membership.id,
          role: item.role,
        },
      },
      update: {},
      create: {
        membershipId: membership.id,
        role: item.role,
      },
    });
  }

  // Restoran 1: 2 ta Zal (Asosiy Zal va Yozgi Terassa)
  const hallMain = await prisma.hall.upsert({
    where: { id: `hall-rayhon-main` },
    update: { name: 'Asosiy Zal', sortOrder: 1 },
    create: {
      id: `hall-rayhon-main`,
      restaurantId: rest1.id,
      name: 'Asosiy Zal',
      sortOrder: 1,
    },
  });

  const hallTerrace = await prisma.hall.upsert({
    where: { id: `hall-rayhon-terrace` },
    update: { name: 'Yozgi Terassa', sortOrder: 2 },
    create: {
      id: `hall-rayhon-terrace`,
      restaurantId: rest1.id,
      name: 'Yozgi Terassa',
      sortOrder: 2,
    },
  });

  // Restoran 1: 12 ta Stol (1-8 Asosiy zalda, 9-12 Terassada)
  console.log('   12 ta stol yaratilmoqda...');
  for (let i = 1; i <= 8; i++) {
    await prisma.table.upsert({
      where: {
        restaurantId_number: {
          restaurantId: rest1.id,
          number: i,
        },
      },
      update: { hallId: hallMain.id, capacity: 4, status: TableStatus.FREE },
      create: {
        restaurantId: rest1.id,
        hallId: hallMain.id,
        number: i,
        capacity: 4,
        status: TableStatus.FREE,
        qrToken: `qr_rayhon_tbl_${i}`,
      },
    });
  }

  for (let i = 9; i <= 12; i++) {
    await prisma.table.upsert({
      where: {
        restaurantId_number: {
          restaurantId: rest1.id,
          number: i,
        },
      },
      update: { hallId: hallTerrace.id, capacity: 6, status: TableStatus.FREE },
      create: {
        restaurantId: rest1.id,
        hallId: hallTerrace.id,
        number: i,
        capacity: 6,
        status: TableStatus.FREE,
        qrToken: `qr_rayhon_tbl_${i}`,
      },
    });
  }

  // Restoran 1: 4-stol uchun faol tashrif (mehmon sinovlari va UI uchun)
  const tbl4 = await prisma.table.findUnique({
    where: {
      restaurantId_number: {
        restaurantId: rest1.id,
        number: 4,
      },
    },
  });
  if (tbl4) {
    await prisma.table.update({
      where: { id: tbl4.id },
      data: { status: TableStatus.OCCUPIED },
    });
    const pinCode = '1234';
    const pinCodeHash = crypto.createHash('sha256').update(pinCode).digest('hex');
    const existingActiveVisit = await prisma.visit.findFirst({
      where: { tableId: tbl4.id, status: VisitStatus.ACTIVE },
    });
    if (!existingActiveVisit) {
      await prisma.visit.create({
        data: {
          restaurantId: rest1.id,
          tableId: tbl4.id,
          waiterId: waiter.id,
          pinCode,
          pinCodeHash,
          status: VisitStatus.ACTIVE,
        },
      });
    }
  }

  // Restoran 1: Stansiyalar (Oshxona va Bar)
  const kitchenStation = await prisma.preparationStation.upsert({
    where: { id: 'station-rayhon-kitchen' },
    update: { name: 'Issiq Oshxona', type: StationType.KITCHEN },
    create: {
      id: 'station-rayhon-kitchen',
      restaurantId: rest1.id,
      name: 'Issiq Oshxona',
      type: StationType.KITCHEN,
    },
  });

  const barStation = await prisma.preparationStation.upsert({
    where: { id: 'station-rayhon-bar' },
    update: { name: 'Ichimliklar Bari', type: StationType.BAR },
    create: {
      id: 'station-rayhon-bar',
      restaurantId: rest1.id,
      name: 'Ichimliklar Bari',
      type: StationType.BAR,
    },
  });

  // Restoran 1: 5 ta Kategoriya
  console.log('   5 ta kategoriya yaratilmoqda...');
  const catNames = [
    { id: 'cat-milliy', name: 'Milliy Taomlar', order: 1 },
    { id: 'cat-kabob', name: 'Kabob va Gril', order: 2 },
    { id: 'cat-shorva', name: 'Sho\'rvalar', order: 3 },
    { id: 'cat-salat', name: 'Salatlar va Gazaklar', order: 4 },
    { id: 'cat-ichimlik', name: 'Ichimliklar', order: 5 },
  ];

  const categoriesMap = new Map<string, string>();
  for (const c of catNames) {
    const cat = await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name, sortOrder: c.order },
      create: {
        id: c.id,
        restaurantId: rest1.id,
        name: c.name,
        sortOrder: c.order,
      },
    });
    categoriesMap.set(c.id, cat.id);
  }

  // Restoran 1: Kamida 20 ta taom (21 ta taom)
  console.log('   21 ta taom, variantlar va qo\'shimchalar yaratilmoqda...');
  const dishes = [
    // 1. Milliy Taomlar
    { id: 'dish-1', name: 'To\'y Oshi', cat: 'cat-milliy', station: kitchenStation.id, price: 42000n, desc: 'Devzira guruch, barra go\'sht, noxat va mayiz' },
    { id: 'dish-2', name: 'Chayxona Oshi', cat: 'cat-milliy', station: kitchenStation.id, price: 40000n, desc: 'Lazer guruchli qovurma osh' },
    { id: 'dish-3', name: 'Uyg\'ur Lag\'mon', cat: 'cat-milliy', station: kitchenStation.id, price: 38000n, desc: 'Cho\'zma xamir va sousli yangi sabzavotlar' },
    { id: 'dish-4', name: 'Qovurma Lag\'mon', cat: 'cat-milliy', station: kitchenStation.id, price: 40000n, desc: 'Maxsus tovada qovurilgan lazzatli lag\'mon' },
    { id: 'dish-5', name: 'Toshkent Mantisi (4 dona)', cat: 'cat-milliy', station: kitchenStation.id, price: 36000n, desc: 'Mayin go\'shtli bug\'da pishgan manti' },
    { id: 'dish-6', name: 'Qozon Kabob', cat: 'cat-milliy', station: kitchenStation.id, price: 65000n, desc: 'Qozonda qizargan barra qo\'y go\'shti va kartoshka' },
    
    // 2. Kabob va Gril
    { id: 'dish-7', name: 'Qo\'y Go\'shti Shashlik', cat: 'cat-kabob', station: kitchenStation.id, price: 24000n, desc: 'Ko\'mirda pishirilgan barra go\'sht' },
    { id: 'dish-8', name: 'Mol Go\'shti Qiyma', cat: 'cat-kabob', station: kitchenStation.id, price: 18000n, desc: 'Lazzatli shirin qiyma kabob' },
    { id: 'dish-9', name: 'Tovuq Shashlik', cat: 'cat-kabob', station: kitchenStation.id, price: 17000n, desc: 'Maxsus marinadlangan tovuq filesi' },
    { id: 'dish-10', name: 'Jigar Dumba Shashlik', cat: 'cat-kabob', station: kitchenStation.id, price: 19000n, desc: 'Yumshoq jigar va dumba go\'shti' },
    { id: 'dish-11', name: 'Rulet Shashlik', cat: 'cat-kabob', station: kitchenStation.id, price: 26000n, desc: 'Mayin qatlama rulet shashlik' },

    // 3. Sho'rvalar
    { id: 'dish-12', name: 'Kosa Sho\'rva', cat: 'cat-shorva', station: kitchenStation.id, price: 32000n, desc: 'Barra qo\'y go\'shti va sabzavotli tiniq sho\'rva' },
    { id: 'dish-13', name: 'Mastava', cat: 'cat-shorva', station: kitchenStation.id, price: 28000n, desc: 'Guruchli va qatiqli milliy sho\'rva' },
    { id: 'dish-14', name: 'Chuchvara Sho\'rva', cat: 'cat-shorva', station: kitchenStation.id, price: 30000n, desc: 'Qo\'lda tugilgan mayda mitti chuchvaralar' },

    // 4. Salatlar
    { id: 'dish-15', name: 'Achichuk Salati', cat: 'cat-salat', station: kitchenStation.id, price: 14000n, desc: 'Yupqa to\'g\'ralgan pomidor, piyoz va rayhon' },
    { id: 'dish-16', name: 'Bahor Salati', cat: 'cat-salat', station: kitchenStation.id, price: 16000n, desc: 'Bodring, redis, ko\'katlar va yangi tuxum' },
    { id: 'dish-17', name: 'Suzma Chakkasi', cat: 'cat-salat', station: kitchenStation.id, price: 12000n, desc: 'Yalpizli yangi qatiq suzmasi' },
    { id: 'dish-18', name: 'Tandir Issiq Non', cat: 'cat-salat', station: kitchenStation.id, price: 6000n, desc: 'Tandirdan uzilgan sedanalik issiq non' },

    // 5. Ichimliklar
    { id: 'dish-19', name: 'Ko\'k Choy 95 (Choynak)', cat: 'cat-ichimlik', station: barStation.id, price: 8000n, desc: 'Samovarda damlangan sara ko\'k choy' },
    { id: 'dish-20', name: 'Qora Choy Limonli (Choynak)', cat: 'cat-ichimlik', station: barStation.id, price: 12000n, desc: 'Yangi kesilgan limon bilan qora choy' },
    { id: 'dish-21', name: 'Uy Kompoti (1 litr)', cat: 'cat-ichimlik', station: barStation.id, price: 20000n, desc: 'Tabiiy mevalardan tayyorlangan muzdek kompot' },
  ];

  for (const d of dishes) {
    const item = await prisma.menuItem.upsert({
      where: { id: d.id },
      update: {
        name: d.name,
        description: d.desc,
        basePriceTiyin: d.price * 100n, // 1 UZS = 100 tiyin
        categoryId: d.cat,
        stationId: d.station,
      },
      create: {
        id: d.id,
        restaurantId: rest1.id,
        categoryId: d.cat,
        stationId: d.station,
        name: d.name,
        description: d.desc,
        basePriceTiyin: d.price * 100n,
        isAvailable: true,
      },
    });

    // Ruscha tarjima
    await prisma.menuItemTranslation.upsert({
      where: {
        menuItemId_language: {
          menuItemId: item.id,
          language: 'ru',
        },
      },
      update: {},
      create: {
        menuItemId: item.id,
        language: 'ru',
        name: `${d.name} (RU)`,
        description: `${d.desc} (описание на русском)`,
      },
    });
  }

  // To'y Oshi uchun Variantlar (0.7 porsiya va 1.0 porsiya)
  await prisma.menuVariant.createMany({
    data: [
      { menuItemId: 'dish-1', name: '1.0 Standart Porsiya', priceDifferenceTiyin: 0n, isDefault: true },
      { menuItemId: 'dish-1', name: '0.7 Kichik Porsiya', priceDifferenceTiyin: -1000000n, isDefault: false },
    ],
    skipDuplicates: true,
  });

  // Qo'shimchalar guruhi
  const addonGrp = await prisma.addonGroup.upsert({
    where: { id: 'grp-addons-osh' },
    update: {},
    create: {
      id: 'grp-addons-osh',
      restaurantId: rest1.id,
      menuItemId: 'dish-1',
      name: 'Osh uchun qo\'shimchalar',
      minSelect: 0,
      maxSelect: 3,
    },
  });

  await prisma.addonOption.createMany({
    data: [
      { addonGroupId: addonGrp.id, name: 'Qazi (bo\'lak)', priceTiyin: 800000n },
      { addonGroupId: addonGrp.id, name: 'Bedana tuxumi', priceTiyin: 300000n },
      { addonGroupId: addonGrp.id, name: 'Achchiq qalampir', priceTiyin: 200000n },
    ],
    skipDuplicates: true,
  });

  // 3. 2-RESTORAN: G'IJDUVON SHASHLIK MARKAZI (IZOLYATSIYANI TEKSHIRISH UCHUN)
  console.log('3. 2-Restoran: G\'ijduvon Shashlik Markazi yaratilmoqda...');
  const rest2 = await prisma.restaurant.upsert({
    where: { slug: 'gijduvon-shashlik' },
    update: { name: 'G\'ijduvon Shashlik Markazi' },
    create: {
      name: 'G\'ijduvon Shashlik Markazi',
      slug: 'gijduvon-shashlik',
      phone: '+998655721100',
      address: 'Buxoro vil., G\'ijduvon tumani, A.Navoiy ko\'chasi',
      serviceChargeBps: 1200, // 12%
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
    },
  });

  // Restoran 2 Membership
  const membership2 = await prisma.restaurantMembership.upsert({
    where: {
      restaurantId_userId: {
        restaurantId: rest2.id,
        userId: boss2.id,
      },
    },
    update: {},
    create: {
      restaurantId: rest2.id,
      userId: boss2.id,
    },
  });

  await prisma.membershipRole.upsert({
    where: {
      membershipId_role: {
        membershipId: membership2.id,
        role: Role.BOSS,
      },
    },
    update: {},
    create: {
      membershipId: membership2.id,
      role: Role.BOSS,
    },
  });

  const hall2 = await prisma.hall.upsert({
    where: { id: 'hall-gijduvon-1' },
    update: {},
    create: {
      id: 'hall-gijduvon-1',
      restaurantId: rest2.id,
      name: 'Asosiy Manqal Zali',
      sortOrder: 1,
    },
  });

  for (let i = 1; i <= 4; i++) {
    await prisma.table.upsert({
      where: {
        restaurantId_number: {
          restaurantId: rest2.id,
          number: i,
        },
      },
      update: {},
      create: {
        restaurantId: rest2.id,
        hallId: hall2.id,
        number: i,
        capacity: 4,
        status: TableStatus.FREE,
        qrToken: `qr_gijduvon_tbl_${i}`,
      },
    });
  }

  console.log('==================================================');
  console.log('SEEDED MUVAFFAQIShTLI YAKUNLANDI (IDEMPOTENT)!');
  console.log(`Restoran 1 ID: ${rest1.id} (Rayhon)`);
  console.log(`Restoran 2 ID: ${rest2.id} (G'ijduvon)`);
  console.log('Super Admin telefon: +998901111111 (Parol: Demo12345!)');
  console.log('Boss telefon:        +998902222222 (Parol: Demo12345!)');
  console.log('Manager telefon:     +998903333333 (Parol: Demo12345!)');
  console.log('Cashier telefon:     +998904444444 (Parol: Demo12345!)');
  console.log('Waiter telefon:      +998905555555 (Parol: Demo12345!)');
  console.log('Kitchen telefon:     +998906666666 (Parol: Demo12345!)');
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('Seed xatoligi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
