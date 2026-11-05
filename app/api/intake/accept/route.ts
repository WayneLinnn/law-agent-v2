import { acceptIntake } from "@/lib/intake";

const noStore = { "Cache-Control": "no-store" };

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "请放入一份材料。" }, { status: 400, headers: noStore });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "请放入一份材料。" }, { status: 400, headers: noStore });
  }
  const result = await acceptIntake(
    {
      name: text(form, "name"),
      clientName: text(form, "clientName"),
      opposingName: text(form, "opposingName"),
      courtName: text(form, "courtName"),
      cause: text(form, "cause"),
      facts: text(form, "facts"),
      mandate: text(form, "mandate"),
      category: text(form, "category"),
      feeReceivable: text(form, "feeReceivable"),
    },
    file,
    { contract: text(form, "contract") === "1", extract: text(form, "extract") === "1" },
  );
  if ("error" in result && !("id" in result)) {
    return Response.json({ error: result.error }, { status: result.status, headers: noStore });
  }
  if ("error" in result) {
    return Response.json(
      { id: result.id, error: result.error },
      { status: result.status, headers: noStore },
    );
  }
  return Response.json({ id: result.id }, { status: 201, headers: noStore });
}
