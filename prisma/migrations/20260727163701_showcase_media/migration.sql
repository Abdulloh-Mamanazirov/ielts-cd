-- AlterTable
ALTER TABLE "ShowcaseResult" ADD COLUMN     "certificateUrl" TEXT,
ADD COLUMN     "testDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Testimonial" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;
