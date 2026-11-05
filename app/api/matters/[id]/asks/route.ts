import { listMatterAsks, recordMatterAsk } from "@/lib/matter-asks";

export async function GET(_request: Request, context: RouteContext<"/api/matters/[id]/asks">) {
  const { id } = await context.params;
  const items = await listMatterAsks(id);
  if (!items) {
    return Response.json(
      { error: "没有这件案子。" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext<"/api/matters/[id]/asks">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    question?: unknown;
    lookup?: unknown;
  } | null;
  const question = typeof body?.question === "string" ? body.question : "";
  const result = await recordMatterAsk(id, question, body?.lookup === true);
  if (!result.ok) {
    return Response.json(
      { error: result.error, laws: result.laws, cases: result.cases },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(result.record, { headers: { "Cache-Control": "no-store" } });
}
