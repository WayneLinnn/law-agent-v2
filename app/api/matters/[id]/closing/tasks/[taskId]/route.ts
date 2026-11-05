import { resolveClosingTask } from "@/lib/closing";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/closing/tasks/[taskId]">,
) {
  const { id, taskId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    result?: unknown;
    note?: unknown;
  } | null;
  const result = await resolveClosingTask(id, taskId, {
    result: body?.result,
    note: body?.note,
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ id: result.id });
}
