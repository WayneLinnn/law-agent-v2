import { beginClosing, updateClosingOutcome } from "@/lib/closing";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/closing">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    outcomeKind?: unknown;
    outcomeOn?: unknown;
    outcomeNote?: unknown;
  } | null;
  const result = await beginClosing(id, {
    outcomeKind: body?.outcomeKind,
    outcomeOn: body?.outcomeOn,
    outcomeNote: body?.outcomeNote,
  });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/matters/[id]/closing">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    outcomeKind?: unknown;
    outcomeOn?: unknown;
    outcomeNote?: unknown;
  } | null;
  const result = await updateClosingOutcome(id, {
    outcomeKind: body?.outcomeKind,
    outcomeOn: body?.outcomeOn,
    outcomeNote: body?.outcomeNote,
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ id: result.id });
}
