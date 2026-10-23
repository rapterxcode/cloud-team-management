-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'engineering',
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT 'purple',
    "icon" TEXT NOT NULL DEFAULT 'Cloud',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL DEFAULT '',
    "user_agent" TEXT NOT NULL DEFAULT '',
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "details" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "workspace_id" TEXT;

-- AlterTable
ALTER TABLE "knowledge_articles" ADD COLUMN "workspace_id" TEXT;
ALTER TABLE "knowledge_articles" ADD COLUMN "is_global" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill default workspace and associate existing records
DO $$
DECLARE
    default_ws_id TEXT := 'default-workspace-engineering';
    usr RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "workspaces" WHERE "id" = default_ws_id) THEN
        INSERT INTO "workspaces" ("id", "name", "type", "description", "color", "icon", "created_at", "updated_at")
        VALUES (default_ws_id, 'Cloud workspace', 'engineering', 'Core engineering & platform delivery workspace', 'purple', 'Cloud', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    END IF;

    -- Backfill existing projects to default workspace
    UPDATE "projects" SET "workspace_id" = default_ws_id WHERE "workspace_id" IS NULL;

    -- Register existing users to default workspace
    FOR usr IN SELECT "id", "role" FROM "users" LOOP
        IF NOT EXISTS (SELECT 1 FROM "workspace_members" WHERE "workspace_id" = default_ws_id AND "user_id" = usr.id) THEN
            INSERT INTO "workspace_members" ("id", "workspace_id", "user_id", "role", "joined_at")
            VALUES (gen_random_uuid()::text, default_ws_id, usr.id, usr.role, CURRENT_TIMESTAMP);
        END IF;
    END LOOP;
END $$;
