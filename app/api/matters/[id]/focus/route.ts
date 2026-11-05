import { focusGate } from "@/lib/elements";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/focus">,
) {
  const { id } = await context.params;
  const result = await focusGate(id);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { ready: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
