import { finalizeDraft } from "@/lib/drafts";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/drafts/[draftId]/final">,
) {
  const { id, draftId } = await context.params;
  const result = await finalizeDraft(id, draftId);
  if ("error" in result) {
    return Response.json(
      { error: result.error, warnings: "warnings" in result ? result.warnings : undefined },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id, version: result.version, createdAt: result.createdAt },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
