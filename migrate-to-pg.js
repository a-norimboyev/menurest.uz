const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const storage = require('./src/services/storage.service.js');

async function migrateData() {
  console.log('Migrating data from JSON to PostgreSQL...');

  const restaurants = storage.getRestaurants();
  for (const r of restaurants) {
    // Upsert restaurant
    const rest = await prisma.restaurant.upsert({
      where: { id: r.id },
      update: {
        name: r.name,
        slug: r.slug,
        phone: r.phone,
        address: r.address,
        isActive: r.isActive
      },
      create: {
        id: r.id,
        name: r.name,
        slug: r.slug,
        phone: r.phone,
        address: r.address,
        isActive: r.isActive !== false
      }
    });

    // Create a boss user for this restaurant
    if (r.password) {
      await prisma.user.upsert({
        where: { username: `boss_${r.slug}` },
        update: {},
        create: {
          restaurantId: r.id,
          username: `boss_${r.slug}`,
          passwordHash: r.password, // already hashed in json
          role: 'BOSS',
          name: 'Restoran Egasi'
        }
      });
    }

    // Default table group
    const tablesCount = r.tablesCount || 10;
    for (let i = 1; i <= tablesCount; i++) {
      await prisma.table.upsert({
        where: {
          restaurantId_tableNumber: {
            restaurantId: r.id,
            tableNumber: i
          }
        },
        update: {},
        create: {
          restaurantId: r.id,
          tableNumber: i,
          capacity: 4
        }
      });
    }
  }

  const categories = storage.getAllCategories();
  for (const c of categories) {
    try {
      await prisma.category.upsert({
        where: { id: c.id },
        update: {
          nameUz: c.nameUz,
          nameRu: c.nameRu,
          nameEn: c.nameEn,
          sortOrder: c.sortOrder
        },
        create: {
          id: c.id,
          restaurantId: c.restaurantId,
          nameUz: c.nameUz,
          nameRu: c.nameRu,
          nameEn: c.nameEn,
          sortOrder: c.sortOrder
        }
      });
    } catch(e) {
      console.warn(`Could not migrate category ${c.id}: ${e.message}`);
    }
  }

  const menuItems = storage.getAllMenuItems();
  for (const m of menuItems) {
    try {
      await prisma.menuItem.upsert({
        where: { id: m.id },
        update: {
          nameUz: m.nameUz,
          price: m.price,
          isAvailable: m.isAvailable
        },
        create: {
          id: m.id,
          restaurantId: m.restaurantId,
          categoryId: m.categoryId,
          nameUz: m.nameUz,
          nameRu: m.nameRu,
          nameEn: m.nameEn,
          price: m.price,
          isAvailable: m.isAvailable
        }
      });
    } catch(e) {
      console.warn(`Could not migrate menu item ${m.id}: ${e.message}`);
    }
  }

  console.log('Migration completed successfully!');
  await prisma.$disconnect();
}

migrateData().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
