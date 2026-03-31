-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_reservationId_fkey";

-- CreateIndex
CREATE INDEX "Car_status_idx" ON "Car"("status");

-- CreateIndex
CREATE INDEX "Car_brand_idx" ON "Car"("brand");

-- CreateIndex
CREATE INDEX "CarParamValue_carId_idx" ON "CarParamValue"("carId");

-- CreateIndex
CREATE INDEX "CarParamValue_paramId_idx" ON "CarParamValue"("paramId");

-- CreateIndex
CREATE INDEX "Invoice_reservationId_idx" ON "Invoice"("reservationId");

-- CreateIndex
CREATE INDEX "Invoice_type_idx" ON "Invoice"("type");

-- CreateIndex
CREATE INDEX "Log_userId_idx" ON "Log"("userId");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt");

-- CreateIndex
CREATE INDEX "Reservation_carId_idx" ON "Reservation"("carId");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_from_idx" ON "Reservation"("from");

-- CreateIndex
CREATE INDEX "Reservation_to_idx" ON "Reservation"("to");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
