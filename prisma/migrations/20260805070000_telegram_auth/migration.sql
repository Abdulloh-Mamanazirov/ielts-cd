-- CreateTable
CREATE TABLE "TelegramRegistration" (
    "telegramId" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'NAME',
    "fullName" TEXT,
    "isStudent" BOOLEAN,
    "username" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramRegistration_pkey" PRIMARY KEY ("telegramId")
);

-- CreateTable
CREATE TABLE "LoginToken" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex
CREATE INDEX "LoginToken_userId_idx" ON "LoginToken"("userId");

-- AddForeignKey
ALTER TABLE "LoginToken" ADD CONSTRAINT "LoginToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
