-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanyInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "eik" TEXT NOT NULL,
    "vat" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'България',
    "mol" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "bank" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "proStart" INTEGER NOT NULL DEFAULT 1,
    "invStart" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanyInfo" ("address", "bank", "bic", "city", "country", "createdAt", "eik", "email", "iban", "id", "mol", "name", "phone", "updatedAt", "vat") SELECT "address", "bank", "bic", "city", "country", "createdAt", "eik", "email", "iban", "id", "mol", "name", "phone", "updatedAt", "vat" FROM "CompanyInfo";
DROP TABLE "CompanyInfo";
ALTER TABLE "new_CompanyInfo" RENAME TO "CompanyInfo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
