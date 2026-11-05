import { readRulingDraft } from "@/lib/rulings";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/materials/[materialId]/ruling-read">,
) {
  const { id, materialId } = await context.params;
  const result = await readRulingDraft(id, materialId);
  if ("error" in result && result.error) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    {
      kind: result.kind,
      caseNumber: result.caseNumber,
      court: result.court,
      decidedOn: result.decidedOn,
      servedOn: result.servedOn,
      effectiveOn: result.effectiveOn,
      result: result.result,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
