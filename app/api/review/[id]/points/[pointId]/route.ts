import { decideContractPoint } from "@/lib/contract-reviews";

export async function POST(
  request: Request,
  context: RouteContext<"/api/review/[id]/points/[pointId]">,
) {
  const { id, pointId } = await context.params;
  const body = (await request.json().catch(() => null)) as { decision?: unknown } | null;
  const decision = typeof body?.decision === "string" ? body.decision : "";
  const result = await decideContractPoint(id, pointId, decision);
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json({ id: pointId }, { headers: { "Cache-Control": "no-store" } });
}
