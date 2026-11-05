import { confirmFocuses } from "@/lib/focuses";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/focuses/confirm">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    items?: unknown;
  } | null;
  const items = Array.isArray(body?.items)
    ? body.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as { id?: unknown; body?: unknown; lawQuery?: unknown };
        return [
          {
            id: typeof record.id === "string" ? record.id : "",
            body: typeof record.body === "string" ? record.body : "",
            lawQuery: typeof record.lawQuery === "string" ? record.lawQuery : "",
          },
        ];
      })
    : null;
  if (!items) {
    return Response.json(
      { error: "请列出全部焦点。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await confirmFocuses(id, items);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { confirmedAt: result.confirmedAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
