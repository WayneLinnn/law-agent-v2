import { readMaterialText } from "@/lib/materials";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/materials/[materialId]/read">,
) {
  const { id, materialId } = await context.params;
  const result = await readMaterialText(id, materialId);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
