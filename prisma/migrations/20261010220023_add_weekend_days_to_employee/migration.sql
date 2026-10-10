-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "weekend_days" INTEGER[] DEFAULT ARRAY[5, 6]::INTEGER[];
