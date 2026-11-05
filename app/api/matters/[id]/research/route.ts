import { researchFocus } from "@/lib/research";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/research">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    focusId?: unknown;
    lawQuery?: unknown;
  } | null;
  if (typeof body?.focusId !== "string" || !body.focusId) {
    return Response.json(
      { error: "请选一条焦点。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const lawQuery = typeof body.lawQuery === "string" ? body.lawQuery : null;
  const result = await researchFocus(id, body.focusId, lawQuery);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    {
      searchId: result.searchId,
      lawQuery: result.lawQuery,
      caseQuery: result.caseQuery,
      retrievedAt: result.retrievedAt,
      candidates: result.candidates,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
