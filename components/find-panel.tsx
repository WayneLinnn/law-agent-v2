import Link from "next/link";

import { Button } from "@/components/ui/button";
import { findRecords } from "@/lib/find";

const fieldClass =
  "mt-2 w-full min-w-0 field";

export async function FindPanel({
  query,
  searched,
  year = "",
  cause = "",
  status = "",
  category = "",
  view = "",
  desk = false,
}: {
  query: string;
  searched: boolean;
  year?: string;
  cause?: string;
  status?: string;
  category?: string;
  view?: string;
  desk?: boolean;
}) {
  const result = searched ? await findRecords(query) : null;
  const error = result && "error" in result ? result.error : null;
  const found = result && !("error" in result) ? result : null;
  const empty = found && found.matters.length === 0 && found.materials.length === 0;

  return (
    <section id="find" className={desk ? "flex min-w-0 flex-col gap-4" : "mt-8 flex max-w-3xl scroll-mt-6 flex-col gap-4"}>
      {desk ? (
        <h2 className="font-serif text-xl tracking-tight text-foreground">找出案件</h2>
      ) : (
        <div>
          <h2 className="text-sm text-foreground">找出</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            在已有的案子和材料里找。只读，不新写记录。点结果进入那件案子。
          </p>
        </div>
      )}
      <form action="/" method="get" className="flex flex-col gap-3">
        {year ? <input type="hidden" name="year" value={year} /> : null}
        {cause ? <input type="hidden" name="cause" value={cause} /> : null}
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {category ? <input type="hidden" name="category" value={category} /> : null}
        {view && view !== "today" ? <input type="hidden" name="view" value={view} /> : null}
        <label className="min-w-0 text-xs text-muted">
          <span className={desk ? "sr-only" : undefined}>找出案件</span>
          <input
            name="q"
            defaultValue={query}
            autoComplete="off"
            placeholder="案子或材料"
            className={fieldClass}
          />
        </label>
        <Button type="submit">找出</Button>
      </form>
      {error ? <p className="text-sm text-seal">{error}</p> : null}
      {empty ? <p className="text-sm text-foreground">没有找到。</p> : null}
      {found && found.matters.length > 0 ? (
        <div>
          <p className="text-xs text-muted">案子 {found.matters.length} 件</p>
          <ul className="mt-2 flex flex-col gap-2">
            {found.matters.map((matter) => (
              <li key={matter.id} className="panel px-4 py-3">
                <Link
                  href={`/matters/${matter.id}`}
                  className="block break-words text-sm leading-6 text-foreground underline"
                >
                  {matter.name}
                </Link>
                <p className="mt-1 break-words text-xs leading-5 text-muted">
                  {matter.status} · {matter.hit}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {found && found.materials.length > 0 ? (
        <div>
          <p className="text-xs text-muted">材料 {found.materials.length} 份</p>
          <ul className="mt-2 flex flex-col gap-2">
            {found.materials.map((material) => (
              <li key={material.id} className="panel px-4 py-3">
                <Link
                  href={`/matters/${material.matterId}/materials#${material.id}`}
                  className="block break-words text-sm leading-6 text-foreground underline"
                >
                  {material.filename}
                </Link>
                <p className="mt-1 break-words text-xs leading-5 text-muted">
                  {material.matterName}
                  {material.snippet ? ` · ${material.snippet}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {found?.more ? (
        <p className="text-sm text-muted">还有更多，请写得更具体。</p>
      ) : null}
    </section>
  );
}
