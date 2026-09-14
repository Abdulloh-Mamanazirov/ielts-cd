-- CreateEnum
CREATE TYPE "MockEventStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "FullMock" ADD COLUMN     "eventId" TEXT;

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "eventOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MockEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "token" TEXT NOT NULL,
    "status" "MockEventStatus" NOT NULL DEFAULT 'DRAFT',
    "closesAt" TIMESTAMP(3),
    "maxParticipants" INTEGER,
    "listeningTestId" TEXT NOT NULL,
    "readingTestId" TEXT NOT NULL,
    "writingTestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullMockId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockEvent_token_key" ON "MockEvent"("token");

-- CreateIndex
CREATE INDEX "MockEvent_status_idx" ON "MockEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_fullMockId_key" ON "EventParticipant"("fullMockId");

-- CreateIndex
CREATE INDEX "EventParticipant_userId_idx" ON "EventParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_eventId_userId_key" ON "EventParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "FullMock_eventId_idx" ON "FullMock"("eventId");

-- AddForeignKey
ALTER TABLE "FullMock" ADD CONSTRAINT "FullMock_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MockEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockEvent" ADD CONSTRAINT "MockEvent_listeningTestId_fkey" FOREIGN KEY ("listeningTestId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockEvent" ADD CONSTRAINT "MockEvent_readingTestId_fkey" FOREIGN KEY ("readingTestId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockEvent" ADD CONSTRAINT "MockEvent_writingTestId_fkey" FOREIGN KEY ("writingTestId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MockEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventParticipant" ADD CONSTRAINT "EventParticipant_fullMockId_fkey" FOREIGN KEY ("fullMockId") REFERENCES "FullMock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
