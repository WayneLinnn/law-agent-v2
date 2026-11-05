import { addMaterial } from "@/lib/matters";

export async function POST(
  request: Request,
  context: RouteContext<"/api/matters/[id]/materials">,
) {
  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "请选择一份材料。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const result = await addMaterial(id, file, {
    kind: text("kind"),
    proves: text("proves"),
    submittedBy: text("submittedBy"),
  });
  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { id: result.id },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
