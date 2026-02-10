-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "year" INTEGER,
    "pricePerHour" DOUBLE PRECISION NOT NULL,
    "pricePerDay" DOUBLE PRECISION,
    "bodyStyle" TEXT,
    "transmission" TEXT,
    "fuel" TEXT,
    "seats" INTEGER,
    "images" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarParamDef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" TEXT,
    "unit" TEXT,

    CONSTRAINT "CarParamDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarParamValue" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "paramId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNum" DOUBLE PRECISION,
    "valueEnum" TEXT,

    CONSTRAINT "CarParamValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "carId" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "pickPlace" TEXT,
    "dropPlace" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "driverEmail" TEXT,
    "driverLicense" TEXT,
    "driverBirth" TIMESTAMP(3),
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
    "total" DOUBLE PRECISION,
    "ratePerDay" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "number" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
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
    "subtotal" DOUBLE PRECISION,
    "vatAmount" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInfo" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CarParamDef_name_key" ON "CarParamDef"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Location_label_key" ON "Location"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_slug_key" ON "Policy"("slug");

-- AddForeignKey
ALTER TABLE "CarParamValue" ADD CONSTRAINT "CarParamValue_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarParamValue" ADD CONSTRAINT "CarParamValue_paramId_fkey" FOREIGN KEY ("paramId") REFERENCES "CarParamDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
