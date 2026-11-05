import { saveMatterFigures } from "@/lib/matters";



export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/figures">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    claimAmount?: unknown;
    feeReceivable?: unknown;
    feeReceived?: unknown;
  } | null;
  const input: {
    claimAmount?: string;
    feeReceivable?: string;
    feeReceived?: string;
  } = {};
  if (typeof body?.claimAmount === "string") input.claimAmount = body.claimAmount;
  if (typeof body?.feeReceivable === "string") input.feeReceivable = body.feeReceivable;
  if (typeof body?.feeReceived === "string") input.feeReceived = body.feeReceived;
  const result = await saveMatterFigures(id, input);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id },
    { headers: { "Cache-Control": "no-store" } },
  );
}
