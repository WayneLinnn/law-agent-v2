import { setMatterStatus } from "@/lib/matters";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/status">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const next = typeof body?.status === "string" ? body.status : "";
  const result = await setMatterStatus(id, next);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id, status: next },
    { headers: { "Cache-Control": "no-store" } },
  );
}
