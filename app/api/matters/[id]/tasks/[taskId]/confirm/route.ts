import { confirmTask } from "@/lib/tasks";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/tasks/[taskId]/confirm">,
) {
  const { id, taskId } = await context.params;
  const result = await confirmTask(id, taskId);
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
