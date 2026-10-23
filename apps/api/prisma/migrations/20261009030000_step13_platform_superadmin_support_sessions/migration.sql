-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "subscription_plan" TEXT NOT NULL DEFAULT 'BUSINESS';
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "subscription_expires_at" TIMESTAMPTZ(6);
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "suspended_reason" TEXT;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE IF NOT EXISTS "support_accesses" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "super_admin_user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "is_read_only" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "support_accesses_token_hash_key" ON "support_accesses"("token_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_accesses_restaurant_id_idx" ON "support_accesses"("restaurant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_accesses_super_admin_user_id_idx" ON "support_accesses"("super_admin_user_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'support_accesses_restaurant_id_fkey'
    ) THEN
        ALTER TABLE "support_accesses" ADD CONSTRAINT "support_accesses_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'support_accesses_super_admin_user_id_fkey'
    ) THEN
        ALTER TABLE "support_accesses" ADD CONSTRAINT "support_accesses_super_admin_user_id_fkey" FOREIGN KEY ("super_admin_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
