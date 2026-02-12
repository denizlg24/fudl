-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('OPPONENT', 'FIELD', 'CAMERA_ANGLE', 'GENERAL');

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TagCategory" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags_on_games" (
    "gameId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "tags_on_games_pkey" PRIMARY KEY ("gameId","tagId")
);

-- CreateTable
CREATE TABLE "tags_on_videos" (
    "videoId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "tags_on_videos_pkey" PRIMARY KEY ("videoId","tagId")
);

-- CreateIndex
CREATE INDEX "tag_organizationId_category_idx" ON "tag"("organizationId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "tag_organizationId_category_name_key" ON "tag"("organizationId", "category", "name");

-- CreateIndex
CREATE INDEX "tags_on_games_tagId_idx" ON "tags_on_games"("tagId");

-- CreateIndex
CREATE INDEX "tags_on_videos_tagId_idx" ON "tags_on_videos"("tagId");

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags_on_games" ADD CONSTRAINT "tags_on_games_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags_on_games" ADD CONSTRAINT "tags_on_games_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags_on_videos" ADD CONSTRAINT "tags_on_videos_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags_on_videos" ADD CONSTRAINT "tags_on_videos_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Remove opponent column from game
ALTER TABLE "game" DROP COLUMN "opponent";

-- AlterTable: Make seasonId required and change FK to RESTRICT
-- First drop the old FK (ON DELETE SET NULL)
ALTER TABLE "game" DROP CONSTRAINT "game_seasonId_fkey";

-- Delete any games with NULL seasonId (data cleanup for non-nullable migration)
DELETE FROM "game" WHERE "seasonId" IS NULL;

-- Make seasonId non-nullable
ALTER TABLE "game" ALTER COLUMN "seasonId" SET NOT NULL;

-- Re-add FK with ON DELETE RESTRICT
ALTER TABLE "game" ADD CONSTRAINT "game_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
