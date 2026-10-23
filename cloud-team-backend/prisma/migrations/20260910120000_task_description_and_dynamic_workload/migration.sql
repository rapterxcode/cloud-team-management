-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "users" DROP COLUMN "workload";
