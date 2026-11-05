import { classifyMaterial } from "@/lib/materials";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/materials/[materialId]">,
) {
  const { id, materialId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    proves?: unknown;
    submittedBy?: unknown;
  } | null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const result = await classifyMaterial(id, materialId, {
    kind: text(body?.kind),
    proves: text(body?.proves),
    submittedBy: text(body?.submittedBy),
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
