import { purgeMatter } from "@/lib/matters";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/purge">,
) {
  const { id } = await context.params;
  const result = await purgeMatter(id);
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
