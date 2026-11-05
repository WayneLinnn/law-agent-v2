import { type CaseCategory } from "@/lib/constants";

export function categoryFromCause(cause: string): CaseCategory | "" {
  const text = cause.trim();
  if (!text) return "";
  if (text.includes("法律顾问")) return "法律顾问";
  if (text.includes("刑事") || /罪$/.test(text)) return "刑事";
  if (/行政|政府信息公开|行政复议|国家赔偿/.test(text)) return "行政诉讼";
  if (/(纠纷|争议)$/.test(text)) return "民事";
  return "";
}
