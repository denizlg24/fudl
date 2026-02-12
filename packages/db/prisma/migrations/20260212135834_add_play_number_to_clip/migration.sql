/*
  Warnings:

  - A unique constraint covering the columns `[videoId,playNumber]` on the table `clip` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `playNumber` to the `clip` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "clip_videoId_idx";

-- AlterTable
ALTER TABLE "clip" ADD COLUMN     "playNumber" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "clip_videoId_playNumber_key" ON "clip"("videoId", "playNumber");
