/*
  Warnings:

  - A unique constraint covering the columns `[sessionId,qlooId]` on the table `entities` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "personas" ADD COLUMN "gender" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "entities_sessionId_qlooId_key" ON "entities"("sessionId", "qlooId");
