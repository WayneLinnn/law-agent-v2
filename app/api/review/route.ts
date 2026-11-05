import { createContractReview } from "@/lib/contract-reviews";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "请选择一份合同。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await createContractReview({
    filename: file.name,
    bytes,
    kind: text("kind"),
    stance: text("stance"),
    reader: text("reader"),
  });
  if (!result.ok) {
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
