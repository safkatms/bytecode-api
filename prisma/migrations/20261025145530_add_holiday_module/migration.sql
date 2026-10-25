-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "holiday_id" INTEGER;

-- CreateTable
CREATE TABLE "holidays" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" INTEGER NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" INTEGER,
    "record_status" "RecordStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_exclusions" (
    "id" SERIAL NOT NULL,
    "holiday_id" INTEGER NOT NULL,
    "employee_id" INTEGER,
    "team_id" INTEGER,

    CONSTRAINT "holiday_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holidays_date_idx" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "holiday_exclusions_holiday_id_idx" ON "holiday_exclusions"("holiday_id");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_exclusions_holiday_id_employee_id_key" ON "holiday_exclusions"("holiday_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_exclusions_holiday_id_team_id_key" ON "holiday_exclusions"("holiday_id", "team_id");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "holidays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_exclusions" ADD CONSTRAINT "holiday_exclusions_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_exclusions" ADD CONSTRAINT "holiday_exclusions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_exclusions" ADD CONSTRAINT "holiday_exclusions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
