-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STUDENT', 'PREMIUM');

-- AlterTable: subscription, mock allowance and Telegram identity.
-- email and passwordHash become optional because an account created through the
-- bot has neither; the instructor still signs in with an address.
ALTER TABLE "User"
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "planExpiresAt" TIMESTAMP(3),
  ADD COLUMN "unlimitedMocks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "telegramId" TEXT,
  ADD COLUMN "telegramUsername" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "isStudent" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
CREATE INDEX "User_plan_idx" ON "User"("plan");
CREATE INDEX "User_isStudent_idx" ON "User"("isStudent");

-- Anyone already granted premium keeps it, as the PREMIUM plan with no expiry.
UPDATE "User" SET "plan" = 'PREMIUM' WHERE "isPremium" = true;
