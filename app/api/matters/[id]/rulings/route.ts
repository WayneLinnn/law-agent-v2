import { saveRuling } from "@/lib/rulings";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/rulings">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    materialId?: unknown;
    kind?: unknown;
    decidedOn?: unknown;
    servedOn?: unknown;
    effectiveOn?: unknown;
    result?: unknown;
    caseNumber?: unknown;
    courtName?: unknown;
  } | null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const result = await saveRuling(id, {
    materialId: text(body?.materialId),
    kind: text(body?.kind),
    decidedOn: text(body?.decidedOn),
    servedOn: text(body?.servedOn),
    effectiveOn: text(body?.effectiveOn),
    result: text(body?.result),
    caseNumber: text(body?.caseNumber),
    courtName: text(body?.courtName),
  });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id },
    { status: result.status, headers: { "Cache-Control": "no-store" } },
  );
}
