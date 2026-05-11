-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "ChatConversation_ownerId_updatedAt_idx" ON "ChatConversation"("ownerId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
