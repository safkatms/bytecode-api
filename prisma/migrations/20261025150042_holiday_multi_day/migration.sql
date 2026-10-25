/*
  Warnings:

  - You are about to drop the column `date` on the `holidays` table. All the data in the column will be lost.
  - Added the required column `end_date` to the `holidays` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date` to the `holidays` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "holidays_date_idx";

-- AlterTable
ALTER TABLE "holidays" DROP COLUMN "date",
ADD COLUMN     "end_date" DATE NOT NULL,
ADD COLUMN     "start_date" DATE NOT NULL;

-- CreateIndex
CREATE INDEX "holidays_start_date_idx" ON "holidays"("start_date");
