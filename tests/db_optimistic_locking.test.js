const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runOptimisticLockProof() {
  console.log('--- TESTING DATABASE-LEVEL OPTIMISTIC CONCURRENCY WITHOUT NODE.JS MUTEX ---');

  // 1. Setup restaurant, visit, bill with version 0
  const rest = await prisma.restaurant.findFirst();
  const table = await prisma.table.findFirst({ where: { restaurantId: rest.id } });
  const visit = await prisma.visit.create({
    data: { restaurantId: rest.id, tableId: table.id, status: 'ACTIVE' }
  });

  const bill = await prisma.bill.create({
    data: {
      restaurantId: rest.id,
      visitId: visit.id,
      subtotal: 100000,
      finalAmount: 100000,
      paidAmount: 0,
      version: 0,
      status: 'UNPAID'
    }
  });

  console.log(`Created Bill ${bill.id} with initial version = ${bill.version}`);

  // Helper simulating cashier payment transaction directly against DB
  async function simulateCashierTransaction(cashierName, key) {
    return prisma.$transaction(async (tx) => {
      // 1. Read current bill
      const currentBill = await tx.bill.findUnique({
        where: { id: bill.id },
        include: { payments: true }
      });

      const alreadyPaid = currentBill.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Number(currentBill.finalAmount) - alreadyPaid;

      if (remaining <= 0) {
        throw new Error('Hisob allaqachon to\'liq to\'langan');
      }

      // Small artificial delay to simulate concurrent execution overlap
      await new Promise(r => setTimeout(r, 20));

      // 2. Atomic conditional update on Bill.version
      const updateResult = await tx.bill.updateMany({
        where: { id: currentBill.id, version: currentBill.version },
        data: { version: { increment: 1 } }
      });

      if (updateResult.count === 0) {
        // Concurrency conflict: another cashier updated the version first!
        const conflictErr = new Error(`KONFLIKT: ${cashierName} hisob versiyasini yangilay olmadi. Boshqa kassir oldinroq yozdi.`);
        conflictErr.code = 'OPTIMISTIC_LOCK_FAILED';
        throw conflictErr;
      }

      // 3. Create payment ONLY if atomic version update succeeded
      const payment = await tx.payment.create({
        data: {
          restaurantId: rest.id,
          billId: currentBill.id,
          amount: remaining,
          method: 'CASH',
          idempotencyKey: key
        }
      });

      await tx.bill.update({
        where: { id: currentBill.id },
        data: { paidAmount: alreadyPaid + remaining, status: 'PAID' }
      });

      return { cashierName, payment, version: currentBill.version + 1 };
    });
  }

  // Run two transactions truly concurrently at database level
  const key1 = 'direct_db_pay_1_' + Date.now();
  const key2 = 'direct_db_pay_2_' + Date.now();

  const results = await Promise.allSettled([
    simulateCashierTransaction('Kassir-A', key1),
    simulateCashierTransaction('Kassir-B', key2)
  ]);

  console.log('Result 1:', results[0].status, results[0].value?.cashierName || results[0].reason?.message);
  console.log('Result 2:', results[1].status, results[1].value?.cashierName || results[1].reason?.message);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  const paymentsInDb = await prisma.payment.findMany({ where: { billId: bill.id } });
  const finalBill = await prisma.bill.findUnique({ where: { id: bill.id } });

  console.log(`\nDB Check:`);
  console.log(`- Final Bill Version in DB: ${finalBill.version}`);
  console.log(`- Final Bill Status in DB: ${finalBill.status}`);
  console.log(`- Total Payments Created in DB: ${paymentsInDb.length}`);
  console.log(`- Total Paid Amount: ${paymentsInDb.reduce((s, p) => s + Number(p.amount), 0)} so'm`);

  const pass = fulfilled.length === 1 && rejected.length === 1 && paymentsInDb.length === 1 && finalBill.version === 1;
  if (pass) {
    console.log('\n[PASS] Database-level optimistic locking prevented concurrent duplicate payments without mutex!');
  } else {
    console.error('\n[FAIL] Optimistic concurrency test failed!');
    process.exit(1);
  }
}

runOptimisticLockProof()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
