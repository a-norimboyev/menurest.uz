-- AlterTable: tables
ALTER TABLE "tables" ADD COLUMN "assigned_waiter_id" TEXT;

-- AlterTable: visits
ALTER TABLE "visits" ADD COLUMN "pin_code_hash" TEXT,
ADD COLUMN "failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "locked_until" TIMESTAMPTZ(6),
ADD COLUMN "code_rotated_at" TIMESTAMPTZ(6),
ADD COLUMN "waiter_id" TEXT;

-- AlterTable: guest_sessions
ALTER TABLE "guest_sessions" ADD COLUMN "restaurant_id" TEXT,
ADD COLUMN "table_id" TEXT,
ADD COLUMN "expires_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "is_revoked" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_assigned_waiter_id_fkey" FOREIGN KEY ("assigned_waiter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
