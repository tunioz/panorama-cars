/*
  Warnings:

  - You are about to drop the column `issuedAt` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `paid` on the `Invoice` table. All the data in the column will be lost.
  - Added the required column `supplierAddr` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierEik` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `supplierName` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentMethod" TEXT,
    "paymentTerms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "supplierName" TEXT NOT NULL,
    "supplierEik" TEXT NOT NULL,
    "supplierVat" TEXT,
    "supplierAddr" TEXT NOT NULL,
    "supplierMol" TEXT,
    "supplierEmail" TEXT,
    "supplierPhone" TEXT,
    "supplierBank" TEXT,
    "supplierIban" TEXT,
    "supplierBic" TEXT,
    "buyerType" TEXT,
    "buyerName" TEXT,
    "buyerEik" TEXT,
    "buyerVat" TEXT,
    "buyerEgn" TEXT,
    "buyerMol" TEXT,
    "buyerAddr" TEXT,
    "buyerEmail" TEXT,
    "buyerBank" TEXT,
    "buyerIban" TEXT,
    "buyerBic" TEXT,
    "items" TEXT,
    "subtotal" REAL,
    "vatAmount" REAL,
    "total" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("id", "number", "reservationId", "total") SELECT "id", "number", "reservationId", "total" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
