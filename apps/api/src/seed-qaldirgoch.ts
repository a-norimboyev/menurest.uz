import bcrypt from 'bcryptjs';
import { prisma } from './db.js';
import { Role, TableStatus, StationType } from '@menurest/shared';

async function seedQaldirgoch() {
  console.log('🚀 Qaldirg\'och Bodomzor restorani yaratilmoqda...');

  // 1. Restoran Yaratish
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'qaldirgoch-bodomzor' },
    update: {
      name: "Qaldirg'och Bodomzor",
      phone: '+998781136963',
      extraPhones: ['(78) 113-69-63'],
      address: 'Chingiz Aytmatov 52/2 (Bodomzor)',
      logoUrl: '/uploads/qaldirgoch-logo.jpg',
      bannerUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
      telegram: 'qaldirgoch_bodomzor',
      instagram: 'https://www.instagram.com/qaldirgoch_bodomzor/',
      serviceChargeBps: 1000, // 10%
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
      openingHours: '09:00 - 23:00',
      isActive: true,
      subscriptionPlan: 'PRO',
    },
    create: {
      name: "Qaldirg'och Bodomzor",
      slug: 'qaldirgoch-bodomzor',
      phone: '+998781136963',
      extraPhones: ['(78) 113-69-63'],
      address: 'Chingiz Aytmatov 52/2 (Bodomzor)',
      logoUrl: '/uploads/qaldirgoch-logo.jpg',
      bannerUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
      telegram: 'qaldirgoch_bodomzor',
      instagram: 'https://www.instagram.com/qaldirgoch_bodomzor/',
      serviceChargeBps: 1000, // 10%
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
      openingHours: '09:00 - 23:00',
      isActive: true,
      subscriptionPlan: 'PRO',
    },
  });

  console.log(`✅ Restoran: ${restaurant.name} (ID: ${restaurant.id})`);

  // 2. Qaldirg'och uchun maxsus boshqaruvchi (login: +998781136963 / Demo12345!)
  const passwordHash = await bcrypt.hash('Demo12345!', 10);
  const qaldirgochBoss = await prisma.user.upsert({
    where: { phone: '+998781136963' },
    update: {
      fullName: 'Qaldirg\'och Boshqaruvchisi',
      passwordHash,
      plainPassword: 'Demo12345!',
      isActive: true,
    },
    create: {
      phone: '+998781136963',
      fullName: 'Qaldirg\'och Boshqaruvchisi',
      passwordHash,
      plainPassword: 'Demo12345!',
      isActive: true,
      isSuperAdmin: false,
    },
  });

  // Barcha asosiy test foydalanuvchilariga ushbu restoranga kirish ruxsatini beramiz
  const usersToAssign = [
    { phone: '+998781136963', role: Role.BOSS },
    { phone: '+998902222222', role: Role.BOSS },
    { phone: '+998903333333', role: Role.MANAGER },
    { phone: '+998904444444', role: Role.CASHIER },
    { phone: '+998905555555', role: Role.WAITER },
    { phone: '+998906666666', role: Role.KITCHEN },
  ];

  for (const item of usersToAssign) {
    const user = await prisma.user.findUnique({ where: { phone: item.phone } });
    if (!user) continue;

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

  // 3. Zallar (Halls)
  const hallMain = await prisma.hall.upsert({
    where: { id: 'hall-qaldirgoch-main' },
    update: { name: 'Asosiy Zal', sortOrder: 1 },
    create: {
      id: 'hall-qaldirgoch-main',
      restaurantId: restaurant.id,
      name: 'Asosiy Zal',
      sortOrder: 1,
    },
  });

  const hallTerrace = await prisma.hall.upsert({
    where: { id: 'hall-qaldirgoch-terrace' },
    update: { name: 'Shinam Terassa', sortOrder: 2 },
    create: {
      id: 'hall-qaldirgoch-terrace',
      restaurantId: restaurant.id,
      name: 'Shinam Terassa',
      sortOrder: 2,
    },
  });

  const hallVip = await prisma.hall.upsert({
    where: { id: 'hall-qaldirgoch-vip' },
    update: { name: 'VIP Xona', sortOrder: 3 },
    create: {
      id: 'hall-qaldirgoch-vip',
      restaurantId: restaurant.id,
      name: 'VIP Xona',
      sortOrder: 3,
    },
  });

  // 4. Stollar (Tables)
  const tables = [
    { number: 1, capacity: 4, hallId: hallMain.id },
    { number: 2, capacity: 4, hallId: hallMain.id },
    { number: 3, capacity: 6, hallId: hallMain.id },
    { number: 4, capacity: 2, hallId: hallMain.id },
    { number: 5, capacity: 4, hallId: hallTerrace.id },
    { number: 6, capacity: 6, hallId: hallTerrace.id },
    { number: 7, capacity: 8, hallId: hallTerrace.id },
    { number: 8, capacity: 12, hallId: hallVip.id },
  ];

  for (const t of tables) {
    await prisma.table.upsert({
      where: {
        restaurantId_number: {
          restaurantId: restaurant.id,
          number: t.number,
        },
      },
      update: {
        capacity: t.capacity,
        hallId: t.hallId,
        status: TableStatus.FREE,
        qrToken: `qr_qaldirgoch_tbl_${t.number}`,
      },
      create: {
        restaurantId: restaurant.id,
        hallId: t.hallId,
        number: t.number,
        capacity: t.capacity,
        status: TableStatus.FREE,
        qrToken: `qr_qaldirgoch_tbl_${t.number}`,
      },
    });
  }
  console.log('✅ 8 ta stol muvaffaqiyatli yaratildi.');

  // 5. Stansiyalar (Stations)
  const kitchenStation = await prisma.preparationStation.upsert({
    where: { id: 'station-qaldirgoch-kitchen' },
    update: { name: 'Issiq Oshxona', type: StationType.KITCHEN },
    create: {
      id: 'station-qaldirgoch-kitchen',
      restaurantId: restaurant.id,
      name: 'Issiq Oshxona',
      type: StationType.KITCHEN,
    },
  });

  const mangalStation = await prisma.preparationStation.upsert({
    where: { id: 'station-qaldirgoch-mangal' },
    update: { name: 'Manqal va Kabobxona', type: StationType.KITCHEN },
    create: {
      id: 'station-qaldirgoch-mangal',
      restaurantId: restaurant.id,
      name: 'Manqal va Kabobxona',
      type: StationType.KITCHEN,
    },
  });

  const barStation = await prisma.preparationStation.upsert({
    where: { id: 'station-qaldirgoch-bar' },
    update: { name: 'Ichimliklar va Choy Bari', type: StationType.BAR },
    create: {
      id: 'station-qaldirgoch-bar',
      restaurantId: restaurant.id,
      name: 'Ichimliklar va Choy Bari',
      type: StationType.BAR,
    },
  });

  // 6. Kategoriyalar (Categories)
  const categoriesData = [
    { id: 'cat-qald-milliy', name: 'Milliy Taomlar', order: 1 },
    { id: 'cat-qald-kabob', name: 'Kaboblar va Gril', order: 2 },
    { id: 'cat-qald-shorva', name: 'Sho\'rvalar', order: 3 },
    { id: 'cat-qald-salat', name: 'Salatlar va Gazaklar', order: 4 },
    { id: 'cat-qald-ichimlik', name: 'Ichimliklar va Choylar', order: 5 },
  ];

  for (const c of categoriesData) {
    await prisma.category.upsert({
      where: {
        id_restaurantId: {
          id: c.id,
          restaurantId: restaurant.id,
        },
      },
      update: { name: c.name, sortOrder: c.order, isVisible: true },
      create: {
        id: c.id,
        restaurantId: restaurant.id,
        name: c.name,
        sortOrder: c.order,
        isVisible: true,
      },
    });
  }

  // 7. Taomlar (Dishes)
  const dishes = [
    // Milliy Taomlar
    {
      id: 'qald-dish-1',
      name: 'Choyxona Palov (To\'y Oshi)',
      cat: 'cat-qald-milliy',
      station: kitchenStation.id,
      price: 45000n,
      desc: 'Tirik dumba, sara Devzira guruch, zira va barra qo\'y go\'shti bilan damlangan an\'anaviy palov.',
      img: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-2',
      name: 'Qozon Kabob (Qo\'zichoq)',
      cat: 'cat-qald-milliy',
      station: kitchenStation.id,
      price: 75000n,
      desc: 'Qozonda qizartirilgan yumshoq qo\'zi go\'shti va tillarang qovurilgan kartoshka.',
      img: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-3',
      name: 'Uyg\'ur Cho\'zma Lag\'mon',
      cat: 'cat-qald-milliy',
      station: kitchenStation.id,
      price: 42000n,
      desc: 'Qo\'lda cho\'zilgan mayin xamir, sara mol go\'shti va barra sabzavotli mazali say.',
      img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-4',
      name: 'Tandir Somsa (Go\'shtli, 2 dona)',
      cat: 'cat-qald-milliy',
      station: kitchenStation.id,
      price: 24000n,
      desc: 'Tandirda qizargan qarsildoq, mayin maydalangan go\'sht va piyozli somsa.',
      img: 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-5',
      name: 'Toshkent Mantisi (4 dona)',
      cat: 'cat-qald-milliy',
      station: kitchenStation.id,
      price: 38000n,
      desc: 'Yupqa xamir ichida mayin mol go\'shti va dumba, qatiq sousi bilan tortiladi.',
      img: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=600&q=80',
    },

    // Kaboblar
    {
      id: 'qald-dish-6',
      name: 'Bodomzor Qiyma Kabob',
      cat: 'cat-qald-kabob',
      station: mangalStation.id,
      price: 22000n,
      desc: 'Maxsus sirli ziravorlar bilan charxlangan shirin barra go\'shtli qiyma kabob.',
      img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-7',
      name: 'Kuskovoy Mol Go\'shti Kabob',
      cat: 'cat-qald-kabob',
      station: mangalStation.id,
      price: 26000n,
      desc: 'Yumshoq lahm mol go\'shti, ko\'mirda bir me\'yorda pishirilgan.',
      img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-8',
      name: 'Jigar va Dumba Kabob',
      cat: 'cat-qald-kabob',
      station: mangalStation.id,
      price: 22000n,
      desc: 'Barra jigar bo\'laklari va xushbo\'y dumba uyg\'unligi.',
      img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-9',
      name: 'Tovuq Qanotlari Gril',
      cat: 'cat-qald-kabob',
      station: mangalStation.id,
      price: 24000n,
      desc: 'Xushbo\'y sousda marinadlangan qizargan qanotlar.',
      img: 'https://images.unsplash.com/photo-1527477378377-f8e1262d5bc9?auto=format&fit=crop&w=600&q=80',
    },

    // Sho'rvalar
    {
      id: 'qald-dish-10',
      name: 'Ko\'za Sho\'rva (Maxsus)',
      cat: 'cat-qald-shorva',
      station: kitchenStation.id,
      price: 36000n,
      desc: 'Sopol ko\'zada uzoq qaynatilgan barra qo\'y go\'shti, no\'xat va sabzavotlar.',
      img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-11',
      name: 'Chuchvara Sho\'rva',
      cat: 'cat-qald-shorva',
      station: kitchenStation.id,
      price: 32000n,
      desc: 'Qo\'lda tugilgan mayda chuchvaralar, barra bulyon va qatiq bilan.',
      img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-12',
      name: 'Mastava',
      cat: 'cat-qald-shorva',
      station: kitchenStation.id,
      price: 28000n,
      desc: 'Guruch, mayda to\'g\'ralgan mol go\'shti va sabzavotli quyuq sho\'rva.',
      img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
    },

    // Salatlar
    {
      id: 'qald-dish-13',
      name: 'Achchiq-Chuchuk (Bodomzor)',
      cat: 'cat-qald-salat',
      station: kitchenStation.id,
      price: 18000n,
      desc: 'Yupqa to\'g\'ralgan yangi pomidor, piyoz, achchiq qalampir va rayhon.',
      img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-14',
      name: 'Smak Salati',
      cat: 'cat-qald-salat',
      station: kitchenStation.id,
      price: 28000n,
      desc: 'Qarsildoq suxariki, qattiq pishloq, pomidor va mayonez sousi.',
      img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-15',
      name: 'Suzma Chakkasi',
      cat: 'cat-qald-salat',
      station: kitchenStation.id,
      price: 12000n,
      desc: 'Yalpiz va sarimsoq bilan qorilgan xushbo\'y suzma.',
      img: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-16',
      name: 'Tandir Patir Non',
      cat: 'cat-qald-salat',
      station: kitchenStation.id,
      price: 8000n,
      desc: 'Sariyog\'li, kunjutli issiq tandir non.',
      img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    },

    // Ichimliklar
    {
      id: 'qald-dish-17',
      name: 'Qaldirg\'och Maxsus Choyi',
      cat: 'cat-qald-ichimlik',
      station: barStation.id,
      price: 18000n,
      desc: 'Limon, tog\' giyohlari, yalpiz va tabiiy asal solingan muattar choy.',
      img: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-18',
      name: 'Ko\'k Choy (№95 Choynak)',
      cat: 'cat-qald-ichimlik',
      station: barStation.id,
      price: 6000n,
      desc: 'Samovar qaynatmasida damlangan sara ko\'k choy.',
      img: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-19',
      name: 'Qora Choy Limonli',
      cat: 'cat-qald-ichimlik',
      station: barStation.id,
      price: 10000n,
      desc: 'Yangi kesilgan limon bo\'laklari bilan qora choy.',
      img: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'qald-dish-20',
      name: 'Uy Qaynatmasi Kompot (1L)',
      cat: 'cat-qald-ichimlik',
      station: barStation.id,
      price: 16000n,
      desc: 'Tabiiy mevalardan tayyorlangan muzdek chanqoqbosti kompot.',
      img: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
    },
  ];

  for (const d of dishes) {
    await prisma.menuItem.upsert({
      where: {
        id_restaurantId: {
          id: d.id,
          restaurantId: restaurant.id,
        },
      },
      update: {
        name: d.name,
        description: d.desc,
        basePriceTiyin: d.price * 100n,
        categoryId: d.cat,
        stationId: d.station,
        imageUrl: d.img,
        isAvailable: true,
      },
      create: {
        id: d.id,
        restaurantId: restaurant.id,
        categoryId: d.cat,
        stationId: d.station,
        name: d.name,
        description: d.desc,
        basePriceTiyin: d.price * 100n,
        imageUrl: d.img,
        isAvailable: true,
      },
    });
  }
  console.log(`✅ ${dishes.length} ta sara taom muvaffaqiyatli saqlandi.`);
  console.log('🎉 Qaldirg\'och Bodomzor to\'liq tayyor!');
}

seedQaldirgoch()
  .catch((e) => {
    console.error('❌ Xatolik:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
