import { startContractReview } from "@/lib/contract-reviews";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/review/[id]/start">,
) {
  const { id } = await context.params;
  const result = await startContractReview(id);
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { count: result.count },
    { headers: { "Cache-Control": "no-store" } },
  );
}
