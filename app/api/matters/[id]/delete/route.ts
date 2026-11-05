import { deleteMatter } from "@/lib/matters";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/delete">,
) {
  const { id } = await context.params;
  const result = await deleteMatter(id);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id, status: "已删除", purgeOn: result.purgeOn },
    { headers: { "Cache-Control": "no-store" } },
  );
}
