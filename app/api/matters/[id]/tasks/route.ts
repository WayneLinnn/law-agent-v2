import { createTask } from "@/lib/tasks";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/tasks">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    customName?: unknown;
    dueOn?: unknown;
    dueTime?: unknown;
    place?: unknown;
    repeat?: unknown;
    repeatUntil?: unknown;
    startOn?: unknown;
    variant?: unknown;
    note?: unknown;
  } | null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const result = await createTask(id, {
    kind: text(body?.kind),
    customName: text(body?.customName),
    dueOn: text(body?.dueOn),
    dueTime: text(body?.dueTime),
    place: text(body?.place),
    repeat: text(body?.repeat),
    repeatUntil: text(body?.repeatUntil),
    startOn: text(body?.startOn),
    variant: text(body?.variant),
    note: text(body?.note),
  });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
