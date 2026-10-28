-- CreateTable
CREATE TABLE "casual_leave_earnings" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casual_leave_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "casual_leave_earnings_employee_id_year_idx" ON "casual_leave_earnings"("employee_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "casual_leave_earnings_employee_id_date_key" ON "casual_leave_earnings"("employee_id", "date");

-- AddForeignKey
ALTER TABLE "casual_leave_earnings" ADD CONSTRAINT "casual_leave_earnings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
