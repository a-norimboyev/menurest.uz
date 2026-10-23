-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- AlterTable
ALTER TABLE "visits" ADD COLUMN "service_charge_bps_snapshot" INTEGER;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "tendered_cash_tiyin" BIGINT,
ADD COLUMN "change_tiyin" BIGINT,
ADD COLUMN "reversal_reason" TEXT,
ADD COLUMN "reversed_at" TIMESTAMPTZ(6),
ADD COLUMN "reversed_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN "shift_id" TEXT;

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN "counted_cash_tiyin" BIGINT,
ADD COLUMN "difference_tiyin" BIGINT,
ADD COLUMN "expected_cash_tiyin" BIGINT;

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount_tiyin" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_id_restaurant_id_key" ON "cash_movements"("id", "restaurant_id");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_shift_id_restaurant_id_fkey" FOREIGN KEY ("shift_id", "restaurant_id") REFERENCES "shifts"("id", "restaurant_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_shift_id_restaurant_id_fkey" FOREIGN KEY ("shift_id", "restaurant_id") REFERENCES "shifts"("id", "restaurant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
