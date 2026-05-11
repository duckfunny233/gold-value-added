-- CreateEnum
CREATE TYPE "ChatGroupRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "ChatConversation" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "dissolvedAt" TIMESTAMP(3),
ADD COLUMN     "mutedAll" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notice" TEXT;

-- AlterTable
ALTER TABLE "ChatParticipant" ADD COLUMN     "clearedAt" TIMESTAMP(3),
ADD COLUMN     "groupNickname" TEXT,
ADD COLUMN     "groupRole" "ChatGroupRole" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "mutedUntil" TIMESTAMP(3),
ADD COLUMN     "notificationMuted" BOOLEAN NOT NULL DEFAULT false;
