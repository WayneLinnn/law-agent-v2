import { acceptDraft, isDraftKind, readRefs } from "@/lib/drafts";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/drafts">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    body?: unknown;
    sourceIds?: unknown;
    elementIds?: unknown;
    basedOn?: unknown;
  } | null;
  const refs = readRefs(body);
  if (!isDraftKind(body?.kind) || !refs) {
    return Response.json(
      { error: "请先起草。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await acceptDraft(id, {
    kind: body.kind,
    body: body.body,
    refs,
    basedOn: typeof body.basedOn === "number" ? body.basedOn : null,
  });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id, version: result.version, warnings: result.warnings },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
