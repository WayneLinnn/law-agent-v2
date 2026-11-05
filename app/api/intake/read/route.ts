import { readIntakeFile } from "@/lib/intake";

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "请放入一份材料。" }, { status: 400, headers: noStore });
  }
  const result = await readIntakeFile(file);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status, headers: noStore });
  }
  return Response.json(
    {
      filename: result.filename,
      unread: result.unread,
      note: "note" in result ? result.note : "",
      parties: result.parties,
      court: result.court,
      cause: result.cause,
      facts: result.facts,
      mandate: result.mandate,
    },
    { headers: noStore },
  );
}
