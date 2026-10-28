import { database } from "@repo/database";

// Added for the deploy's smoke: answered only by this Worker, through its
// HYPERDRIVE binding, after the migrations created the table — and outside
// the dashboard, so it answers whether or not Clerk is connected.
export const dynamic = "force-dynamic";

export const GET = async (): Promise<Response> => {
  try {
    const pages = await database.page.count();
    return Response.json({ ok: true, pages });
  } catch (error) {
    console.error(error);
    return Response.json(
      { ok: false, error: "database unreachable" },
      { status: 503 }
    );
  }
};
