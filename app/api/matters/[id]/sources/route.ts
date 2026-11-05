import { acceptSources } from "@/lib/research";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/sources">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    searchId?: unknown;
    sourceIds?: unknown;
  } | null;
  if (
    typeof body?.searchId !== "string" ||
    !Array.isArray(body.sourceIds) ||
    body.sourceIds.some((item) => typeof item !== "string")
  ) {
    return Response.json(
      { error: "请勾选出处。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await acceptSources(
    id,
    body.searchId,
    body.sourceIds as string[],
  );
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { added: result.added, acceptedAt: result.acceptedAt },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
