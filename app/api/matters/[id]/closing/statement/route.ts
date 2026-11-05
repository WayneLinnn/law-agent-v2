import { saveClosingStatement } from "@/lib/closing";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/closing/statement">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { statement?: unknown } | null;
  const result = await saveClosingStatement(id, body?.statement);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ id: result.id });
}
