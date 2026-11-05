import { archiveMatter } from "@/lib/closing";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/archive">,
) {
  const { id } = await context.params;
  const result = await archiveMatter(id);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ id: result.id, count: result.count });
}
