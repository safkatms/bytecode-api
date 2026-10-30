/*
  Warnings:

  - A unique constraint covering the columns `[office_email]` on the table `employees` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "blood_group" VARCHAR(5),
ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "emergency_contact_no" VARCHAR(30),
ADD COLUMN     "father_name" VARCHAR(100),
ADD COLUMN     "office_email" VARCHAR(255),
ADD COLUMN     "permanent_address" TEXT,
ADD COLUMN     "present_address" TEXT,
ADD COLUMN     "prime_bank_account_no" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "employees_office_email_key" ON "employees"("office_email");
