-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Skill" AS ENUM ('LISTENING', 'READING', 'WRITING', 'SPEAKING');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttemptMode" AS ENUM ('PRACTICE', 'MOCK');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "FullMockStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "AnswerReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TestimonialMedia" AS ENUM ('TEXT', 'YOUTUBE', 'INSTAGRAM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "premiumGrantedAt" TIMESTAMP(3),
    "premiumGrantedById" TEXT,
    "premiumNote" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "ipAddress" TEXT,
    "succeeded" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "status" "TestStatus" NOT NULL DEFAULT 'DRAFT',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "answerKey" JSONB NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "source" TEXT,
    "audioAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "mode" "AttemptMode" NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "fullMockId" TEXT,
    "sequence" INTEGER,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "flags" JSONB NOT NULL DEFAULT '[]',
    "annotations" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "rawScore" INTEGER,
    "band" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "timeSpentSeconds" INTEGER,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FullMock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "includeSpeaking" BOOLEAN NOT NULL DEFAULT false,
    "status" "FullMockStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "overallBand" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FullMock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSubmission" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "task1Text" TEXT NOT NULL,
    "task2Text" TEXT,
    "task1WordCount" INTEGER NOT NULL DEFAULT 0,
    "task2WordCount" INTEGER NOT NULL DEFAULT 0,
    "instructorBand" DOUBLE PRECISION,
    "instructorFeedback" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingRecording" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "promptIndex" INTEGER,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerReview" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "normalizedAnswer" TEXT NOT NULL,
    "rawExample" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "status" "AnswerReviewStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowcaseResult" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "overallBand" DOUBLE PRECISION NOT NULL,
    "listening" DOUBLE PRECISION,
    "reading" DOUBLE PRECISION,
    "writing" DOUBLE PRECISION,
    "speaking" DOUBLE PRECISION,
    "quoteEn" TEXT,
    "quoteUz" TEXT,
    "quoteRu" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowcaseResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "mediaType" "TestimonialMedia" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "quoteEn" TEXT,
    "quoteUz" TEXT,
    "quoteRu" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isPremium_idx" ON "User"("isPremium");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_identifier_createdAt_idx" ON "LoginAttempt"("identifier", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ipAddress_createdAt_idx" ON "LoginAttempt"("ipAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Test_slug_key" ON "Test"("slug");

-- CreateIndex
CREATE INDEX "Test_skill_status_idx" ON "Test"("skill", "status");

-- CreateIndex
CREATE INDEX "Test_status_isPremium_idx" ON "Test"("status", "isPremium");

-- CreateIndex
CREATE UNIQUE INDEX "AudioAsset_storageKey_key" ON "AudioAsset"("storageKey");

-- CreateIndex
CREATE INDEX "Attempt_userId_submittedAt_idx" ON "Attempt"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "Attempt_userId_status_idx" ON "Attempt"("userId", "status");

-- CreateIndex
CREATE INDEX "Attempt_testId_idx" ON "Attempt"("testId");

-- CreateIndex
CREATE INDEX "Attempt_fullMockId_idx" ON "Attempt"("fullMockId");

-- CreateIndex
CREATE INDEX "FullMock_userId_startedAt_idx" ON "FullMock"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WritingSubmission_attemptId_key" ON "WritingSubmission"("attemptId");

-- CreateIndex
CREATE INDEX "WritingSubmission_reviewedAt_idx" ON "WritingSubmission"("reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingRecording_storageKey_key" ON "SpeakingRecording"("storageKey");

-- CreateIndex
CREATE INDEX "SpeakingRecording_attemptId_idx" ON "SpeakingRecording"("attemptId");

-- CreateIndex
CREATE INDEX "AnswerReview_status_idx" ON "AnswerReview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerReview_testId_questionNumber_normalizedAnswer_key" ON "AnswerReview"("testId", "questionNumber", "normalizedAnswer");

-- CreateIndex
CREATE INDEX "ShowcaseResult_isVisible_displayOrder_idx" ON "ShowcaseResult"("isVisible", "displayOrder");

-- CreateIndex
CREATE INDEX "Testimonial_isVisible_displayOrder_idx" ON "Testimonial"("isVisible", "displayOrder");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_fullMockId_fkey" FOREIGN KEY ("fullMockId") REFERENCES "FullMock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FullMock" ADD CONSTRAINT "FullMock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSubmission" ADD CONSTRAINT "WritingSubmission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSubmission" ADD CONSTRAINT "WritingSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingRecording" ADD CONSTRAINT "SpeakingRecording_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerReview" ADD CONSTRAINT "AnswerReview_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
