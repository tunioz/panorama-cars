-- AlterTable
ALTER TABLE "CompanyInfo" ADD COLUMN     "extraDriverPrice" DOUBLE PRECISION DEFAULT 10,
ADD COLUMN     "insurancePrice" DOUBLE PRECISION DEFAULT 15;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "extraDriver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insurance" BOOLEAN NOT NULL DEFAULT false;
