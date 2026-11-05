import { getMatter } from "@/lib/matters";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/matters/[id]">,
) {
  const { id } = await context.params;
  const detail = await getMatter(id);
  if (!detail) {
    return Response.json({ error: "没有这件案子" }, { status: 404 });
  }
  return Response.json(detail, { headers: { "Cache-Control": "no-store" } });
}
