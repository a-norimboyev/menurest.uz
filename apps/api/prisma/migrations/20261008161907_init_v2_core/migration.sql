-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'BOSS', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('FREE', 'OCCUPIED', 'DIRTY');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'CONFIRMED', 'PREPARING', 'PARTIALLY_READY', 'READY', 'PARTIALLY_SERVED', 'SERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceCallType" AS ENUM ('WAITER', 'BILL', 'WATER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ServiceCallStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('DISCOUNT', 'SURCHARGE', 'CORRECTION');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TERMINAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "StationType" AS ENUM ('KITCHEN', 'BAR', 'GRILL', 'COLD_DISH', 'PASTRY');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "restaurants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "serviceChargeBps" INTEGER NOT NULL DEFAULT 1000,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tashkent',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_memberships" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_roles" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permission" TEXT,

    CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "halls" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "halls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preparation_stations" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StationType" NOT NULL DEFAULT 'KITCHEN',

    CONSTRAINT "preparation_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "hall_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" "TableStatus" NOT NULL DEFAULT 'FREE',
    "qr_token" TEXT NOT NULL,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_price_tiyin" BIGINT NOT NULL,
    "image_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_translations" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "menu_item_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_variants" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_diff_tiyin" BIGINT NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "menu_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_groups" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "menu_item_id" TEXT,
    "name" TEXT NOT NULL,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "addon_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_options" (
    "id" TEXT NOT NULL,
    "addon_group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_tiyin" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "addon_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "pin_code" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'ACTIVE',
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "opened_by_user_id" TEXT,
    "closed_by_user_id" TEXT,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_info" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "order_number" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "created_by_role" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "snapshot_name" TEXT NOT NULL,
    "snapshot_price_tiyin" BIGINT NOT NULL,
    "snapshot_variant_name" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_by_user_id" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_addon_snapshots" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_tiyin" BIGINT NOT NULL,

    CONSTRAINT "order_item_addon_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_calls" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "table_id" TEXT NOT NULL,
    "type" "ServiceCallType" NOT NULL DEFAULT 'WAITER',
    "status" "ServiceCallStatus" NOT NULL DEFAULT 'PENDING',
    "acknowledged_by_user_id" TEXT,
    "resolved_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "service_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_adjustments" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "amount_tiyin" BIGINT NOT NULL,
    "percentage_bps" INTEGER,
    "reason" TEXT NOT NULL,
    "approved_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "shift_id" TEXT,
    "cashier_id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount_tiyin" BIGINT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "allocated_to_bill_type" TEXT NOT NULL,
    "amount_tiyin" BIGINT NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount_tiyin" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "authorized_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "starting_cash_tiyin" BIGINT NOT NULL DEFAULT 0,
    "closing_cash_tiyin" BIGINT,
    "terminal_total_tiyin" BIGINT,
    "notes" TEXT,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_state_json" JSONB,
    "new_state_json" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_memberships_restaurant_id_user_id_key" ON "restaurant_memberships"("restaurant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_memberships_id_restaurant_id_key" ON "restaurant_memberships"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_roles_membership_id_role_key" ON "membership_roles"("membership_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "halls_id_restaurant_id_key" ON "halls"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "preparation_stations_id_restaurant_id_key" ON "preparation_stations"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tables_qr_token_key" ON "tables"("qr_token");

-- CreateIndex
CREATE UNIQUE INDEX "tables_id_restaurant_id_key" ON "tables"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tables_restaurant_id_number_key" ON "tables"("restaurant_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "categories_id_restaurant_id_key" ON "categories"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_id_restaurant_id_key" ON "menu_items"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_translations_menu_item_id_language_key" ON "menu_item_translations"("menu_item_id", "language");

-- CreateIndex
CREATE UNIQUE INDEX "addon_groups_id_restaurant_id_key" ON "addon_groups"("id", "restaurant_id");

-- CreateIndex
CREATE INDEX "visits_restaurant_id_status_idx" ON "visits"("restaurant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "visits_id_restaurant_id_key" ON "visits"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_token_hash_key" ON "guest_sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "orders_id_restaurant_id_key" ON "orders"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_id_restaurant_id_key" ON "order_items"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_calls_id_restaurant_id_key" ON "service_calls"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_adjustments_id_restaurant_id_key" ON "bill_adjustments"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_id_restaurant_id_key" ON "payments"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_id_restaurant_id_key" ON "refunds"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_id_restaurant_id_key" ON "shifts"("id", "restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_key_key" ON "idempotency_records"("key");

-- AddForeignKey
ALTER TABLE "restaurant_memberships" ADD CONSTRAINT "restaurant_memberships_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_memberships" ADD CONSTRAINT "restaurant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "restaurant_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halls" ADD CONSTRAINT "halls_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preparation_stations" ADD CONSTRAINT "preparation_stations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_hall_id_restaurant_id_fkey" FOREIGN KEY ("hall_id", "restaurant_id") REFERENCES "halls"("id", "restaurant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_restaurant_id_fkey" FOREIGN KEY ("category_id", "restaurant_id") REFERENCES "categories"("id", "restaurant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_station_id_restaurant_id_fkey" FOREIGN KEY ("station_id", "restaurant_id") REFERENCES "preparation_stations"("id", "restaurant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_translations" ADD CONSTRAINT "menu_item_translations_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_variants" ADD CONSTRAINT "menu_variants_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_groups" ADD CONSTRAINT "addon_groups_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_groups" ADD CONSTRAINT "addon_groups_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_options" ADD CONSTRAINT "addon_options_addon_group_id_fkey" FOREIGN KEY ("addon_group_id") REFERENCES "addon_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_table_id_restaurant_id_fkey" FOREIGN KEY ("table_id", "restaurant_id") REFERENCES "tables"("id", "restaurant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_visit_id_restaurant_id_fkey" FOREIGN KEY ("visit_id", "restaurant_id") REFERENCES "visits"("id", "restaurant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_restaurant_id_fkey" FOREIGN KEY ("order_id", "restaurant_id") REFERENCES "orders"("id", "restaurant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_restaurant_id_fkey" FOREIGN KEY ("menu_item_id", "restaurant_id") REFERENCES "menu_items"("id", "restaurant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_station_id_restaurant_id_fkey" FOREIGN KEY ("station_id", "restaurant_id") REFERENCES "preparation_stations"("id", "restaurant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_addon_snapshots" ADD CONSTRAINT "order_item_addon_snapshots_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_calls" ADD CONSTRAINT "service_calls_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_calls" ADD CONSTRAINT "service_calls_visit_id_restaurant_id_fkey" FOREIGN KEY ("visit_id", "restaurant_id") REFERENCES "visits"("id", "restaurant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_calls" ADD CONSTRAINT "service_calls_table_id_restaurant_id_fkey" FOREIGN KEY ("table_id", "restaurant_id") REFERENCES "tables"("id", "restaurant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_adjustments" ADD CONSTRAINT "bill_adjustments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_adjustments" ADD CONSTRAINT "bill_adjustments_visit_id_restaurant_id_fkey" FOREIGN KEY ("visit_id", "restaurant_id") REFERENCES "visits"("id", "restaurant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_visit_id_restaurant_id_fkey" FOREIGN KEY ("visit_id", "restaurant_id") REFERENCES "visits"("id", "restaurant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_shift_id_restaurant_id_fkey" FOREIGN KEY ("shift_id", "restaurant_id") REFERENCES "shifts"("id", "restaurant_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_restaurant_id_fkey" FOREIGN KEY ("payment_id", "restaurant_id") REFERENCES "payments"("id", "restaurant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial Unique Index: Faqat bitta stolda bir vaqtning o'zida yagona ACTIVE tashrif bo'lishi kafolati
CREATE UNIQUE INDEX "idx_unique_active_visit_per_table" ON "visits" ("table_id") WHERE "status" = 'ACTIVE';

-- Partial Unique Index: Bitta restoranda bitta xodim uchun bir vaqtning o'zida yagona OPEN smena bo'lishi kafolati
CREATE UNIQUE INDEX "idx_unique_active_shift_per_user" ON "shifts" ("restaurant_id", "user_id") WHERE "status" = 'OPEN';

