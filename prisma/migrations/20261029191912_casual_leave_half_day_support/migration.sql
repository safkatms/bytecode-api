-- AlterTable
ALTER TABLE "casual_leave_balances" ALTER COLUMN "allocated_days" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "carry_forward_days" SET DEFAULT 0,
ALTER COLUMN "carry_forward_days" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "used_days" SET DEFAULT 0,
ALTER COLUMN "used_days" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "casual_leave_requests" ALTER COLUMN "total_days" SET DATA TYPE DOUBLE PRECISION;
