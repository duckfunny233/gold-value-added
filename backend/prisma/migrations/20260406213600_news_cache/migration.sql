-- CreateTable
CREATE TABLE "NewsCache" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "NewsCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsCache_fetchedAt_idx" ON "NewsCache"("fetchedAt");

-- CreateIndex
CREATE INDEX "NewsCache_publishedAt_idx" ON "NewsCache"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsCache_source_fetchedAt_idx" ON "NewsCache"("source", "fetchedAt");
