import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Restoranni Qaldirg\'och milliy taomlari (Bodomzor) ga yangilash...');

  // 1. Eski slugni bo'shatamiz
  await prisma.restaurant.updateMany({
    where: {
      slug: 'qaldirgoch-bodomzor',
      NOT: { id: 'ef5ac39f-8794-499e-ada6-d2fc9632f8e8' },
    },
    data: { slug: 'qaldirgoch-old-demo' },
  });

  // 2. 4 oylik restoranni to'liq Qaldirg'och rekvizitlari bilan yangilaymiz
  const restId = 'ef5ac39f-8794-499e-ada6-d2fc9632f8e8';
  const updated = await prisma.restaurant.update({
    where: { id: restId },
    data: {
      name: "Qaldirg'och milliy taomlari",
      slug: 'qaldirgoch-bodomzor',
      phone: '+998 78 113 69 63',
      extraPhones: ['+998 78 113 69 63', '+998 90 999 11 22'],
      address: 'Chingiz Aytmatov 52/2, Mazali Maskan',
      telegram: 'qaldirgoch_bodomzor',
      instagram: 'https://www.instagram.com/qaldirgoch_bodomzor/',
      logoUrl: '/qaldirgoch-logo.png',
      openingHours: '09:00 - 23:00',
      serviceChargeBps: 1000,
      allowedRoles: ['MANAGER', 'CASHIER', 'WAITER', 'GUEST'],
    },
  });

  console.log(`✅ Yangilandi: ${updated.name}`);
  console.log(`   Slug: ${updated.slug}`);
  console.log(`   Telefon: ${updated.phone}`);
  console.log(`   Manzil: ${updated.address}`);
  console.log(`   Logotip: ${updated.logoUrl}`);
  console.log(`   Instagram: ${updated.instagram}`);

  // 3. Menyuga Uyg'ur taomlarini alohida kategoriya yoki taomlar sifatida boyitish
  const existingCat = await prisma.category.findFirst({
    where: { restaurantId: restId, name: { contains: 'Uyg\'ur' } },
  });

  if (!existingCat) {
    const defaultStation = await prisma.preparationStation.findFirst({
      where: { restaurantId: restId },
    });

    const uyghurCat = await prisma.category.create({
      data: {
        restaurantId: restId,
        name: "Uyg'ur Taomlari",
        sortOrder: 2,
        isVisible: true,
      },
    });

    await prisma.menuItem.createMany({
      data: [
        {
          restaurantId: restId,
          categoryId: uyghurCat.id,
          stationId: defaultStation!.id,
          name: "Uyg'urcha Say Lag'mon",
          description: "Cho'zma xamir, sarxil sabzavotlar, lahm mol go'shti va xushbo'y ziravorlar",
          basePriceTiyin: BigInt(4500000), // 45 000 UZS
          isAvailable: true,
          imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
        },
        {
          restaurantId: restId,
          categoryId: uyghurCat.id,
          stationId: defaultStation!.id,
          name: "Uyg'urcha Qovurma Lag'mon",
          description: "Maxsus qozonda qovurilgan mayin go'sht, sarimsoq va sabzavotli cho'zma lag'mon",
          basePriceTiyin: BigInt(4800000), // 48 000 UZS
          isAvailable: true,
          imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80',
        },
        {
          restaurantId: restId,
          categoryId: uyghurCat.id,
          stationId: defaultStation!.id,
          name: "Uyg'urcha Go'ja Manti",
          description: "Yupqa xamir, maydalangan barra qo'y go'shti va piyozli shirali manti",
          basePriceTiyin: BigInt(4200000), // 42 000 UZS
          isAvailable: true,
          imageUrl: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=600&q=80',
        },
        {
          restaurantId: restId,
          categoryId: uyghurCat.id,
          stationId: defaultStation!.id,
          name: "Chuchvara Sho'rva",
          description: "Mayda tugilgan mitti chuchvaralar, to'yimli go'shtli sho'rvada",
          basePriceTiyin: BigInt(3600000), // 36 000 UZS
          isAvailable: true,
          imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
        },
      ],
    });
    console.log('✅ Uyg\'ur taomlari toifasi va taomlari qo\'shildi!');
  }

  // 4. Stollar soni va QR kodlarni tekshirish
  const tablesCount = await prisma.table.count({ where: { restaurantId: restId } });
  console.log(`   Jami stollar: ${tablesCount} ta`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
