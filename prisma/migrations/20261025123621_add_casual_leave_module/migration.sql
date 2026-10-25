-- CreateEnum
CREATE TYPE "CasualLeaveStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'casual_leave';

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "casual_leave_request_id" INTEGER;

-- CreateTable
CREATE TABLE "casual_leave_policies" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "total_days" INTEGER NOT NULL DEFAULT 12,
    "max_carry_forward" INTEGER NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" INTEGER NOT NULL,

    CONSTRAINT "casual_leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casual_leave_balances" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "allocated_days" INTEGER NOT NULL,
    "carry_forward_days" INTEGER NOT NULL DEFAULT 0,
    "used_days" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "casual_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casual_leave_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_days" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "status" "CasualLeaveStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "review_note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" INTEGER NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" INTEGER,
    "record_status" "RecordStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "casual_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "casual_leave_policies_year_key" ON "casual_leave_policies"("year");

-- CreateIndex
CREATE INDEX "casual_leave_balances_employee_id_idx" ON "casual_leave_balances"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "casual_leave_balances_employee_id_year_key" ON "casual_leave_balances"("employee_id", "year");

-- CreateIndex
CREATE INDEX "casual_leave_requests_employee_id_idx" ON "casual_leave_requests"("employee_id");

-- CreateIndex
CREATE INDEX "casual_leave_requests_status_idx" ON "casual_leave_requests"("status");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_casual_leave_request_id_fkey" FOREIGN KEY ("casual_leave_request_id") REFERENCES "casual_leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casual_leave_balances" ADD CONSTRAINT "casual_leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casual_leave_requests" ADD CONSTRAINT "casual_leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
