import { openProceeding } from "@/lib/proceedings";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/proceeding/open">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    instance?: unknown;
  } | null;
  const instance = typeof body?.instance === "string" ? body.instance : "";
  const result = await openProceeding(id, instance);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
