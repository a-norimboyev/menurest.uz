const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const res = await prisma.$queryRawUnsafe('SELECT * FROM _prisma_migrations');
    console.log('Migrations in DB:', res);
  } catch (e) {
    console.log('Error querying _prisma_migrations:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
check();
