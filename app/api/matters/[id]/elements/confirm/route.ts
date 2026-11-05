import { confirmElements } from "@/lib/elements";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/elements/confirm">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    items?: unknown;
  } | null;
  const items = Array.isArray(body?.items)
    ? body.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as { id?: unknown; body?: unknown };
        return [
          {
            id: typeof record.id === "string" ? record.id : "",
            body: typeof record.body === "string" ? record.body : "",
          },
        ];
      })
    : null;
  if (!items) {
    return Response.json(
      { error: "请确认抽出的全部要素。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = await confirmElements(id, items);
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
