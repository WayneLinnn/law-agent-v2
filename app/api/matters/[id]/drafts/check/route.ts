import { readRefs, recheckDraft } from "@/lib/drafts";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/drafts/check">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    body?: unknown;
    sourceIds?: unknown;
    elementIds?: unknown;
  } | null;
  const refs = readRefs(body);
  if (!refs) {
    return Response.json(
      { error: "请先起草。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await recheckDraft(id, body?.body, refs);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { warnings: result.warnings },
    { headers: { "Cache-Control": "no-store" } },
  );
}
