import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import postgres from "postgres";
import { keys } from "./keys";

// Prisma 7 over Neon, upstream, is postgres.js over Cloudflare Hyperdrive
// here, keeping the calls the apps make: `database.page.findMany()`,
// `.create({ data })`, `.delete({ where })`.
//
// ONE CLIENT PER CALL. A socket opened in one request cannot serve another on
// Workers ("Cannot perform I/O on behalf of a different request"), so nothing
// here lives at module scope: each call opens a client on the Worker's
// HYPERDRIVE binding — Hyperdrive is the pool, at the edge — runs its
// statement and closes it. Without a Cloudflare context (a script, a test,
// `next dev` before the bindings are up) DATABASE_URL is the connection
// string, as upstream.

const connectionString = async (): Promise<string> => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const hyperdrive = (env as { HYPERDRIVE?: { connectionString: string } })
      .HYPERDRIVE;
    if (hyperdrive?.connectionString) {
      return hyperdrive.connectionString;
    }
  } catch {
    // Not running under OpenNext: fall through.
  }
  const url = keys().DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database: neither a HYPERDRIVE binding nor DATABASE_URL is set"
    );
  }
  return url;
};

type Sql = postgres.Sql;

export const withDatabase = async <T>(run: (sql: Sql) => Promise<T>) => {
  // Few connections, no pg_types round trip, plain (unprepared) statements:
  // what Hyperdrive in transaction mode wants.
  const sql = postgres(await connectionString(), {
    max: 1,
    fetch_types: false,
    prepare: false,
  });
  try {
    return await run(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
};

// The schema's one model (packages/db/src/migrations): upstream's Prisma
// `Page`, whose table keeps Prisma's name.
export interface Page {
  id: number;
  name: string;
}

interface FindManyArgs {
  where?: { name?: { contains?: string } };
}

// Prisma's `contains` is a case-sensitive LIKE; the pattern's own wildcards
// are escaped.
const likePattern = (text: string) =>
  `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export const database = {
  page: {
    findMany: (args: FindManyArgs = {}): Promise<Page[]> =>
      withDatabase(async (sql) => {
        const contains = args.where?.name?.contains;
        const rows =
          contains === undefined
            ? await sql<Page[]>`select id, name from "Page" order by id`
            : await sql<
                Page[]
              >`select id, name from "Page" where name like ${likePattern(contains)} order by id`;
        return rows.map((row) => ({ id: Number(row.id), name: row.name }));
      }),

    count: (): Promise<number> =>
      withDatabase(async (sql) => {
        const [row] = await sql<
          { count: string }[]
        >`select count(*)::text as count from "Page"`;
        return Number(row?.count ?? 0);
      }),

    create: ({ data }: { data: { name: string } }): Promise<Page> =>
      withDatabase(async (sql) => {
        const [row] = await sql<
          Page[]
        >`insert into "Page" (name) values (${data.name}) returning id, name`;
        if (!row) {
          throw new Error("insert returned no row");
        }
        return { id: Number(row.id), name: row.name };
      }),

    delete: ({ where }: { where: { id: number } }): Promise<Page | null> =>
      withDatabase(async (sql) => {
        const [row] = await sql<
          Page[]
        >`delete from "Page" where id = ${where.id} returning id, name`;
        return row ? { id: Number(row.id), name: row.name } : null;
      }),
  },
};
