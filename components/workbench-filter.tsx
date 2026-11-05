import { Button } from "@/components/ui/button";
import { CASE_CATEGORIES, MATTER_STATUSES } from "@/lib/constants";

const fieldClass =
  "mt-2 w-full min-w-0 field";

export function WorkbenchFilter({
  year,
  cause,
  status,
  category,
  query,
  years,
  causes,
}: {
  year: string;
  cause: string;
  status: string;
  category: string;
  query: string;
  years: string[];
  causes: string[];
}) {
  const yearOptions = years.includes(year) || !year ? years : [year, ...years];
  const causeOptions = causes.includes(cause) || !cause ? causes : [cause, ...causes];

  return (
    <form action="/" method="get" className="mt-6 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
      {query ? <input type="hidden" name="q" value={query} /> : null}
      <label className="min-w-0 text-xs text-muted">
        委托年度
        <select name="year" defaultValue={year} className={fieldClass}>
          <option value="">全部</option>
          {yearOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 text-xs text-muted">
        案由
        <select name="cause" defaultValue={cause} className={fieldClass}>
          <option value="">全部</option>
          {causeOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 text-xs text-muted">
        状态
        <select name="status" defaultValue={status} className={fieldClass}>
          <option value="">全部</option>
          {MATTER_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 text-xs text-muted">
        类型
        <select name="category" defaultValue={category} className={fieldClass}>
          <option value="">全部</option>
          {CASE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit">筛选</Button>
        <a href="/" className="text-sm text-foreground underline">
          全部
        </a>
      </div>
    </form>
  );
}
