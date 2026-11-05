import { updateParty } from "@/lib/parties";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/parties/[partyId]">,
) {
  const { id, partyId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    role?: unknown;
    name?: unknown;
    position?: unknown;
    idNumber?: unknown;
  } | null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const result = await updateParty(id, partyId, {
    role: text(body?.role),
    name: text(body?.name),
    position: text(body?.position),
    idNumber: text(body?.idNumber),
  });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
