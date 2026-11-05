import { saveProceeding } from "@/lib/proceedings";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/proceeding">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    caseNumber?: unknown;
    category?: unknown;
    engagedOn?: unknown;
    instance?: unknown;
    procedure?: unknown;
  } | null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const result = await saveProceeding(id, {
    caseNumber: text(body?.caseNumber),
    category: text(body?.category),
    engagedOn: text(body?.engagedOn),
    instance: text(body?.instance),
    procedure: text(body?.procedure),
  });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
