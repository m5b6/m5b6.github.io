import { sinceSchema, wardDelta, wardSnapshot } from "@/lib/asylum/engine";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("since");
  const query = sinceSchema.safeParse(raw === null ? {} : { since: raw });

  if (!query.success) {
    return Response.json({ error: "Invalid ward query" }, { status: 400 });
  }

  try {
    if (query.data.since !== undefined) {
      const delta = await wardDelta(query.data.since);

      return Response.json(delta, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const snapshot = await wardSnapshot();

    return Response.json(
      {
        persisted: snapshot.persisted,
        revision: snapshot.revision,
        spectators: snapshot.spectators,
        state: snapshot.state,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Ward storage unavailable" }, { status: 503 });
  }
}
