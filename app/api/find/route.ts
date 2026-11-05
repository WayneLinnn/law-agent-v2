import { findRecords } from "@/lib/find";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const result = await findRecords(query);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status, headers: noStore });
  }
  return Response.json(
    {
      query: result.query,
      matters: result.matters,
      materials: result.materials,
      more: result.more,
    },
    { headers: noStore },
  );
}
