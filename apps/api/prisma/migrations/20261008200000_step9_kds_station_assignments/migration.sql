-- AlterTable order_items
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "prepared_at" TIMESTAMPTZ(6);
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "ready_at" TIMESTAMPTZ(6);

-- CreateTable staff_station_assignments
CREATE TABLE IF NOT EXISTS "staff_station_assignments" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_station_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "staff_station_assignments_restaurant_id_user_id_station_id_key" ON "staff_station_assignments"("restaurant_id", "user_id", "station_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_station_assignments_restaurant_id_fkey'
  ) THEN
    ALTER TABLE "staff_station_assignments" ADD CONSTRAINT "staff_station_assignments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_station_assignments_user_id_fkey'
  ) THEN
    ALTER TABLE "staff_station_assignments" ADD CONSTRAINT "staff_station_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_station_assignments_station_id_restaurant_id_fkey'
  ) THEN
    ALTER TABLE "staff_station_assignments" ADD CONSTRAINT "staff_station_assignments_station_id_restaurant_id_fkey" FOREIGN KEY ("station_id", "restaurant_id") REFERENCES "preparation_stations"("id", "restaurant_id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
