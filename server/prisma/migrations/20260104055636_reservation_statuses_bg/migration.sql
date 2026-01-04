-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "carId" TEXT NOT NULL,
    "from" DATETIME NOT NULL,
    "to" DATETIME NOT NULL,
    "pickPlace" TEXT,
    "dropPlace" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "driverEmail" TEXT,
    "driverLicense" TEXT,
    "driverBirth" DATETIME,
    "driverAddress" TEXT,
    "invoiceType" TEXT,
    "invoiceName" TEXT,
    "invoiceNum" TEXT,
    "invoiceEgn" TEXT,
    "invoiceVat" TEXT,
    "invoiceMol" TEXT,
    "invoiceBank" TEXT,
    "invoiceIban" TEXT,
    "invoiceBic" TEXT,
    "invoiceAddr" TEXT,
    "invoiceEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "total" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reservation_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Reservation" ("carId", "createdAt", "driverAddress", "driverBirth", "driverEmail", "driverLicense", "driverName", "driverPhone", "dropPlace", "from", "id", "invoiceAddr", "invoiceBank", "invoiceBic", "invoiceEgn", "invoiceEmail", "invoiceIban", "invoiceMol", "invoiceName", "invoiceNum", "invoiceType", "invoiceVat", "pickPlace", "seq", "status", "to", "total") SELECT "carId", "createdAt", "driverAddress", "driverBirth", "driverEmail", "driverLicense", "driverName", "driverPhone", "dropPlace", "from", "id", "invoiceAddr", "invoiceBank", "invoiceBic", "invoiceEgn", "invoiceEmail", "invoiceIban", "invoiceMol", "invoiceName", "invoiceNum", "invoiceType", "invoiceVat", "pickPlace", "seq", "status", "to", "total" FROM "Reservation";
DROP TABLE "Reservation";
ALTER TABLE "new_Reservation" RENAME TO "Reservation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
