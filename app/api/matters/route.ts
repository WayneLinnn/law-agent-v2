import { createDraft, listMatters } from "@/lib/matters";

export async function GET() {
  const matters = await listMatters();
  return Response.json(
    { matters },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const result = await createDraft({
    name: text(body?.name),
    clientName: text(body?.clientName),
    opposingName: text(body?.opposingName),
    courtName: text(body?.courtName),
    cause: text(body?.cause),
    facts: text(body?.facts),
    mandate: text(body?.mandate),
    category: text(body?.category),
    feeReceivable: text(body?.feeReceivable),
  });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(result, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
