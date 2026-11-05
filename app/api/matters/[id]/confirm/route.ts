import { confirmFiling } from "@/lib/matters";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/confirm">,
) {
  const { id } = await context.params;
  const result = await confirmFiling(id);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id, status: "待立案" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
