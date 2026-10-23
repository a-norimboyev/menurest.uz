-- AlterTable Restaurant
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "banner_url" TEXT;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "opening_hours" JSONB;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "default_language" TEXT NOT NULL DEFAULT 'uz';

-- AlterTable RestaurantMembership
ALTER TABLE "restaurant_memberships" ADD COLUMN IF NOT EXISTS "custom_permissions" JSONB;

-- AlterTable AuditLog
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actor_name" TEXT;
CREATE INDEX IF NOT EXISTS "audit_logs_restaurant_id_created_at_idx" ON "audit_logs"("restaurant_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_restaurant_id_action_idx" ON "audit_logs"("restaurant_id", "action");
