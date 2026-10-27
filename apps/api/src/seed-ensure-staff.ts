import bcrypt from 'bcryptjs';
import { prisma } from './db.js';
import { Role } from '@prisma/client';

async function main() {
  console.log('👥 Demo xodimlarni tekshirish va yaratish boshlandi...');

  const passwordHash = await bcrypt.hash('Demo12345!', 10);

  // 1. Foydalanuvchilar
  const staffToCreate = [
    {
      phone: '+998903333333',
      fullName: 'Bobur Rahimov (Manager)',
      role: Role.MANAGER,
    },
    {
      phone: '+998905555555',
      fullName: 'Jahongir Rustamov (Waiter)',
      role: Role.WAITER,
    },
    {
      phone: '+998904444444',
      fullName: 'Madina Karimova (Cashier)',
      role: Role.CASHIER,
    },
  ];

  const restaurants = await prisma.restaurant.findMany();

  for (const item of staffToCreate) {
    const user = await prisma.user.upsert({
      where: { phone: item.phone },
      update: {
        fullName: item.fullName,
        passwordHash,
        plainPassword: 'Demo12345!',
        isActive: true,
      },
      create: {
        phone: item.phone,
        fullName: item.fullName,
        passwordHash,
        plainPassword: 'Demo12345!',
        isActive: true,
      },
    });

    console.log(`✅ Foydalanuvchi: ${user.fullName} (${user.phone})`);

    // Har bir restoranga a'zo qilish
    for (const rest of restaurants) {
      const membership = await prisma.restaurantMembership.upsert({
        where: {
          restaurantId_userId: {
            restaurantId: rest.id,
            userId: user.id,
          },
        },
        update: { isActive: true },
        create: {
          restaurantId: rest.id,
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

      console.log(`   🏢 Restoran ${rest.name} ga ${item.role} roli berildi.`);
    }
  }

  // Restoran sluglarini yangilash
  for (const rest of restaurants) {
    if (rest.slug === 'rayhon') {
      await prisma.restaurant.update({
        where: { id: rest.id },
        data: { name: 'Rayhon Milliy Taomlar', slug: 'rayhon-chilonzor' },
      });
      console.log('   🔄 rayhon slugi rayhon-chilonzor ga yangilandi.');
    }
  }

  console.log('🎉 Demo xodimlar muvaffaqiyatli saqlandi!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
