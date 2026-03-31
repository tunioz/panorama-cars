-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "pricePerHour" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "pricePerDay" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "CompanyInfo" ALTER COLUMN "extraDriverPrice" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "insurancePrice" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "vatAmount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "ratePerDay" SET DATA TYPE DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "Car_deletedAt_idx" ON "Car"("deletedAt");

-- CreateIndex
CREATE INDEX "Invoice_deletedAt_idx" ON "Invoice"("deletedAt");

-- CreateIndex
CREATE INDEX "Reservation_deletedAt_idx" ON "Reservation"("deletedAt");
