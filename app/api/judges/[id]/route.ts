import { removeJudge, updateJudge } from "@/lib/judges";

export async function POST(
  request: Request,
  context: RouteContext<"/api/judges/[id]">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    remove?: unknown;
    name?: unknown;
    division?: unknown;
    phone?: unknown;
  } | null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const result =
    body?.remove === true
      ? await removeJudge(id)
      : await updateJudge(id, {
          name: text(body?.name),
          division: text(body?.division),
          phone: text(body?.phone),
        });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id },
    { status: result.status, headers: { "Cache-Control": "no-store" } },
  );
}
