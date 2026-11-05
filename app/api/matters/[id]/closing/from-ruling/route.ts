import { draftStatementFromRuling } from "@/lib/closing";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/closing/from-ruling">,
) {
  const { id } = await context.params;
  const result = await draftStatementFromRuling(id);
  if ("error" in result && result.error) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { statement: result.statement },
    { headers: { "Cache-Control": "no-store" } },
  );
}
