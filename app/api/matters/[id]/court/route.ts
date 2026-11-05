import { saveCourtOfficer } from "@/lib/court";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/court">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    judge?: unknown;
    assistant?: unknown;
    clerk?: unknown;
    division?: unknown;
    contact?: unknown;
    courtName?: unknown;
  } | null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const result = await saveCourtOfficer(
    id,
    {
      judge: text(body?.judge),
      assistant: text(body?.assistant),
      clerk: text(body?.clerk),
      division: text(body?.division),
      contact: text(body?.contact),
    },
    text(body?.courtName),
  );
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
