-- AlterTable
ALTER TABLE "video" ADD COLUMN     "codec" TEXT,
ADD COLUMN     "fps" DOUBLE PRECISION,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "thumbnailKey" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "width" INTEGER,
ALTER COLUMN "fileSize" SET DATA TYPE BIGINT;

-- CreateTable
CREATE TABLE "upload_session" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "s3UploadId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "totalParts" INTEGER NOT NULL,
    "partSize" INTEGER NOT NULL,
    "completedParts" JSONB NOT NULL DEFAULT '[]',
    "totalBytes" BIGINT NOT NULL,
    "uploadedBytes" BIGINT NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clip" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "storageKey" TEXT,
    "storageUrl" TEXT,
    "thumbnailKey" TEXT,
    "thumbnailUrl" TEXT,
    "labels" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_session_videoId_key" ON "upload_session"("videoId");

-- CreateIndex
CREATE INDEX "upload_session_videoId_idx" ON "upload_session"("videoId");

-- CreateIndex
CREATE INDEX "clip_videoId_idx" ON "clip"("videoId");

-- CreateIndex
CREATE INDEX "clip_organizationId_idx" ON "clip"("organizationId");

-- AddForeignKey
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip" ADD CONSTRAINT "clip_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip" ADD CONSTRAINT "clip_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
