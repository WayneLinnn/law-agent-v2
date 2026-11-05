import { generateDraft, isDraftKind } from "@/lib/drafts";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/draft">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { kind?: unknown } | null;
  if (!isDraftKind(body?.kind)) {
    return Response.json(
      { error: "请选一种文书。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await generateDraft(id, body.kind);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    {
      kind: result.kind,
      body: result.body,
      sourceIds: result.sourceIds,
      elementIds: result.elementIds,
      warnings: result.warnings,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
