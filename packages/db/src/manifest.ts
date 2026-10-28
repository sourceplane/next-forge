import type { MigrationManifest } from "./types.js";

// Every migration the runner applies, in order, with the sha256 of its file.
// `pnpm --filter @saas/db run manifest:check` verifies the checksums;
// `manifest:fix` rewrites them after a migration file changes (only ever
// before that migration has been applied anywhere — an applied migration's
// checksum is immutable).
export const manifest: MigrationManifest = {
  version: 1,
  migrations: [
    {
      id: "000_control_baseline",
      context: "control",
      path: "000_control/up.sql",
      checksum:
        "2a5d7f30684c99e3ff441ca8a2c38038dedd1bab4db4a40e92cd36bb22be297f",
      description:
        "Baseline control migration — creates the migration tracking schema",
    },
    {
      id: "010_pages",
      context: "app",
      path: "010_pages/up.sql",
      checksum:
        "5a470a82a50d5fb84703b090d1b6987508fcb33087e12962a942eedde231d3bc",
      description:
        "The template's schema: upstream's one Prisma model, the stub Page table, with Prisma's table and key names",
    },
    {
      id: "020_row_level_security",
      context: "app",
      path: "020_row_level_security/up.sql",
      checksum:
        "08bd7f0a84d5ebef70195b6bbb51fa9ac3c1c11d0263c2352a3ae9fa9f6a0546",
      description:
        "Row-level security, with no policies, on every table in public — closed to Supabase's Data API (anon, authenticated), open to the apps, which own them; refuses to run if the apps' role would be locked out",
    },
  ],
};
