import { addHandElement, extractElements } from "@/lib/elements";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/elements">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    body?: unknown;
  } | null;
  const result =
    typeof body?.kind === "string"
      ? await addHandElement(id, {
          kind: body.kind,
          body: typeof body.body === "string" ? body.body : "",
        })
      : await extractElements(id);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    "ids" in result ? { ids: result.ids } : { id: result.id },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
