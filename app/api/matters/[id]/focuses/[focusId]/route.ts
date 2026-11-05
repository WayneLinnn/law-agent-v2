import { deleteFocus } from "@/lib/focuses";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/focuses/[focusId]">,
) {
  const { id, focusId } = await context.params;
  const result = await deleteFocus(id, focusId);
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id },
    { headers: { "Cache-Control": "no-store" } },
  );
}
