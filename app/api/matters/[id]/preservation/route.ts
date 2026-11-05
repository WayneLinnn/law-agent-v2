import { savePreservation } from "@/lib/preservation";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/preservation">,
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    subject?: unknown;
    court?: unknown;
    preservedOn?: unknown;
  } | null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const result = await savePreservation(id, {
    status: text(body?.status),
    subject: text(body?.subject),
    court: text(body?.court),
    preservedOn: text(body?.preservedOn),
  });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
