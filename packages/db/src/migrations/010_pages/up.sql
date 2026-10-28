-- The template's schema: upstream's one Prisma model
-- (packages/database/prisma/schema.prisma), the stub `Page` its app lists and
-- its keep-alive cron writes, as `prisma migrate` would create it — the table
-- and its key keep Prisma's names, so a product that brings Prisma back finds
-- the table it expects. @repo/database reads and writes it over Hyperdrive.
CREATE TABLE IF NOT EXISTS "Page" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);
