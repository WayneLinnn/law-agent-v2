import { listFocuses, proposeFocuses } from "@/lib/focuses";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/focuses">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    propose?: unknown;
    items?: unknown;
  } | null;
  if (body?.propose === true) {
    const proposed = await proposeFocuses(id);
    if ("error" in proposed) {
      return Response.json(
        { error: proposed.error },
        { status: proposed.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { ids: proposed.ids },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  }
  const items = Array.isArray(body?.items)
    ? body.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as { id?: unknown; body?: unknown; lawQuery?: unknown };
        return [
          {
            id: typeof record.id === "string" ? record.id : undefined,
            body: typeof record.body === "string" ? record.body : "",
            lawQuery: typeof record.lawQuery === "string" ? record.lawQuery : "",
          },
        ];
      })
    : null;
  if (!items) {
    return Response.json(
      { error: "请写下争议焦点。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await listFocuses(id, items);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { ids: result.ids },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
