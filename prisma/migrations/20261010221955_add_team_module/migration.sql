-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "team_id" INTEGER;

-- CreateTable
CREATE TABLE "teams" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "leader_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" INTEGER NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" INTEGER,
    "record_status" "RecordStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE INDEX "teams_leader_id_idx" ON "teams"("leader_id");

-- CreateIndex
CREATE INDEX "employees_team_id_idx" ON "employees"("team_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
