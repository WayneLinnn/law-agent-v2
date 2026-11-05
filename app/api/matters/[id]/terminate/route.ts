import { terminateMatter } from "@/lib/matters";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/terminate">,
) {
  const { id } = await context.params;
  const result = await terminateMatter(id);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id, status: "已终止" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
