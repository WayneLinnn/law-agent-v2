import { isIsoDate } from "@/lib/figures";
import type { RulingKind } from "@/lib/constants";

export type RulingDraft = {
  kind: RulingKind;
  caseNumber: string;
  court: string;
  decidedOn: string;
  servedOn: string;
  effectiveOn: string;
  result: string;
};

function toIso(text: string) {
  const match = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!match) return "";
  const iso = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : "";
}

function dateAfter(text: string, label: RegExp) {
  const match = text.match(label);
  if (!match) return "";
  return toIso(text.slice(match.index ?? 0, (match.index ?? 0) + 40));
}

export function readRuling(text: string): RulingDraft {
  const source = text.replace(/\r\n/g, "\n");
  const kind: RulingKind = /调解书/.test(source)
    ? "调解书"
    : /裁定/.test(source)
      ? "裁定"
      : "判决";
  const caseNumber =
    source.match(/[（(]\d{4}[）)][^\s，。,；;]{2,30}号/)?.[0] ?? "";
  const court = source.match(/[\u4e00-\u9fa5]{2,30}(?:人民法院|仲裁委员会)/)?.[0] ?? "";
  const decidedOn =
    dateAfter(source, /(?:判决|裁定|调解|裁判)日期/) ||
    dateAfter(source, /于/) ||
    toIso(source);
  const servedOn = dateAfter(source, /送达/);
  const effectiveOn = dateAfter(source, /生效/);
  const resultMatch = source.match(
    /(?:判决如下|裁定如下|调解协议|协议如下)[：:]?\s*([\s\S]{0,300})/,
  );
  const result = (resultMatch?.[1] ?? "")
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return { kind, caseNumber, court, decidedOn, servedOn, effectiveOn, result };
}
