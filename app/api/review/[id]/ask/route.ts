import { askContractReview } from "@/lib/contract-reviews";

export async function POST(request: Request, context: RouteContext<"/api/review/[id]/ask">) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question : "";
  const result = await askContractReview(id, question);
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json({ id: result.id }, { headers: { "Cache-Control": "no-store" } });
}
