import { beforeEach, describe, expect, it, vi } from "vitest";

// @repo/database keeps the Prisma calls the apps make —
// `database.page.findMany/create/delete`, and `count` for the health check —
// over postgres.js, with ONE client per call on the Worker's HYPERDRIVE
// binding: a socket opened in one request cannot serve another on Workers.
// postgres.js is stood in for here by a recorder: what each call sends, on
// which connection string, and that every client it opened is closed.

interface Sent {
  sql: string;
  values: unknown[];
}

const sent: Sent[] = [];
const opened: string[] = [];
let ended = 0;
let rows: unknown[] = [];

vi.mock("postgres", () => ({
  default: (connectionString: string) => {
    opened.push(connectionString);
    const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
      sent.push({ sql: strings.join("?"), values });
      return Promise.resolve(rows);
    };
    sql.end = async () => {
      ended += 1;
    };
    return sql;
  },
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({
    env: { HYPERDRIVE: { connectionString: "postgres://hyperdrive.invalid/db" } },
  }),
}));

describe("@repo/database over Hyperdrive", () => {
  beforeEach(() => {
    sent.length = 0;
    opened.length = 0;
    ended = 0;
    rows = [];
  });

  it("lists the pages in id order, on the HYPERDRIVE binding, and closes its client", async () => {
    rows = [
      { id: "1", name: "Getting started" },
      { id: 2, name: "Roadmap" },
    ];
    const { database } = await import("@repo/database");
    expect(await database.page.findMany()).toEqual([
      { id: 1, name: "Getting started" },
      { id: 2, name: "Roadmap" },
    ]);
    expect(opened).toEqual(["postgres://hyperdrive.invalid/db"]);
    expect(ended).toBe(1);
    expect(sent[0]?.sql).toBe('select id, name from "Page" order by id');
  });

  it("filters by name as Prisma's contains does, with the pattern's wildcards escaped", async () => {
    const { database } = await import("@repo/database");
    await database.page.findMany({ where: { name: { contains: "50%_off" } } });
    expect(sent[0]?.sql).toBe('select id, name from "Page" where name like ? order by id');
    expect(sent[0]?.values).toEqual(["%50\\%\\_off%"]);
  });

  it("creates, counts and deletes, each on its own client", async () => {
    const { database } = await import("@repo/database");
    rows = [{ id: 7, name: "cron-temp" }];
    expect(await database.page.create({ data: { name: "cron-temp" } })).toEqual({
      id: 7,
      name: "cron-temp",
    });
    expect(await database.page.delete({ where: { id: 7 } })).toEqual({
      id: 7,
      name: "cron-temp",
    });
    rows = [{ count: "3" }];
    expect(await database.page.count()).toBe(3);
    expect(opened).toHaveLength(3);
    expect(ended).toBe(3);
    expect(sent.map((s) => s.values)).toEqual([["cron-temp"], [7], []]);
  });
});
