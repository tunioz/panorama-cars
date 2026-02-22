-- CreateTable
CREATE TABLE "FileStore" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileStore_path_key" ON "FileStore"("path");
