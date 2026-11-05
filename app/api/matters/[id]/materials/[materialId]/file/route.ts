import { contentType } from "@/lib/file-kinds";
import { readMaterialFile } from "@/lib/matters";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/matters/[id]/materials/[materialId]/file">,
) {
  const { id, materialId } = await context.params;
  const file = await readMaterialFile(id, materialId);
  if (!file) {
    return Response.json({ error: "没有这份材料" }, { status: 404 });
  }

  return new Response(file.bytes, {
    headers: {
      "Content-Type": contentType(file.filename),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
