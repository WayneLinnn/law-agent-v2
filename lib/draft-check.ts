import "server-only";

import { caseNumberKey, findCase, getArticle, PkulawError } from "@/lib/pkulaw";
import type { DraftWarning, ElementRecord, SourceRecord } from "@/lib/types";

const LOOKUP_MAX = 12;

const TAG_RE = /【([^】]{1,40})】/g;
const TAG_TOKEN_RE = /([SE])(\d+)/g;
const LAW_CITE_RE =
  /《([^》]{2,80})》((?:(?:的|、|和|及|以及|与|，)?第[零〇一二三四五六七八九十百千\d]+条(?:之[一二三四五六七八九十]+)?(?:第[零〇一二三四五六七八九十\d]+款)?(?:第[零〇一二三四五六七八九十\d]+项)?)+)/g;
const ARTICLE_RE = /第([零〇一二三四五六七八九十百千\d]+)条(?:之[一二三四五六七八九十]+)?/g;
const CASE_NUMBER_RE = /[（(]\d{4}[）)][^\s，。；、：:（()）【】《》]{2,24}?\d+号/g;
const HEADING_RE = /^(?:[一二三四五六七八九十]+、|[（(][一二三四五六七八九十]+[）)])/;
const UNSOURCED_MIN = 40;

const DIGITS: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };

function numberOf(text: string) {
  if (/^\d+$/.test(text)) return Number(text);
  let total = 0;
  let digit = 0;
  for (const char of text) {
    if (char in DIGITS) digit = DIGITS[char];
    else if (char in UNITS) {
      total += (digit || 1) * UNITS[char];
      digit = 0;
    } else return NaN;
  }
  return total + digit;
}

function lawKey(name: string) {
  return name
    .replace(/^中华人民共和国/, "")
    .replace(/[（(]/g, "(")
    .replace(/[）)]/g, ")")
    .replace(/\s+/g, "");
}

function articleKey(label: string) {
  const match = label.match(/第([零〇一二三四五六七八九十百千\d]+)条(之[一二三四五六七八九十]+)?/);
  if (!match) return label;
  return `${numberOf(match[1])}${match[2] ?? ""}`;
}

type Lookup = () => Promise<DraftWarning | null>;

export async function checkDraft(
  body: string,
  sources: SourceRecord[],
  elements: ElementRecord[],
) {
  const warnings: DraftWarning[] = [];
  const lookups: { key: string; line: number; quote: string; run: Lookup }[] = [];
  const lawSources = new Set(
    sources
      .filter((source) => source.kind === "law")
      .map((source) => {
        const [law, label = ""] = source.sourceId.split("#");
        return `${lawKey(law)}#${articleKey(label)}`;
      }),
  );
  const caseSources = new Set(
    sources.filter((source) => source.kind === "case").map((source) => caseNumberKey(source.sourceId)),
  );
  const usedSources = new Set<number>();

  let section = "";
  body.split("\n").forEach((raw, line) => {
    const text = raw.trim();
    if (!text) return;
    if (HEADING_RE.test(text) && text.length < 40) section = text;

    let tagged = false;
    for (const tag of text.matchAll(TAG_RE)) {
      const tokens = [...tag[1].matchAll(TAG_TOKEN_RE)];
      if (tokens.length === 0) continue;
      tagged = true;
      for (const token of tokens) {
        const n = Number(token[2]);
        const pool = token[1] === "S" ? sources.length : elements.length;
        if (n < 1 || n > pool) {
          warnings.push({
            level: "block",
            line,
            quote: `${token[1]}${n}`,
            text: token[1] === "S" ? "出处里没有这个编号。" : "要素里没有这个编号。",
          });
        } else if (token[1] === "S") usedSources.add(n - 1);
      }
    }

    if (
      !tagged &&
      text.length >= UNSOURCED_MIN &&
      !HEADING_RE.test(text) &&
      !/声明|落款/.test(section)
    ) {
      warnings.push({ level: "warn", line, quote: text.slice(0, 24), text: "这一段没有标出处。" });
    }

    for (const cite of text.matchAll(LAW_CITE_RE)) {
      const law = cite[1].trim();
      for (const article of cite[2].matchAll(ARTICLE_RE)) {
        const label = article[0];
        const key = `${lawKey(law)}#${articleKey(label)}`;
        if (lawSources.has(key)) continue;
        lookups.push({
          key,
          line,
          quote: `《${law}》${label}`,
          run: async () => {
            const found = await getArticle(law, label);
            return found
              ? {
                  level: "info",
                  line,
                  quote: `《${law}》${label}`,
                  text: "不在勾选的出处里。北大法宝查到了原文，请核对。",
                  url: found.url,
                }
              : {
                  level: "block",
                  line,
                  quote: `《${law}》${label}`,
                  text: "北大法宝没有查到这一条，疑似编造。",
                };
          },
        });
      }
    }

    for (const match of text.matchAll(CASE_NUMBER_RE)) {
      const caseNumber = match[0];
      const key = caseNumberKey(caseNumber);
      if (caseSources.has(key)) continue;
      lookups.push({
        key,
        line,
        quote: caseNumber,
        run: async () => {
          const found = await findCase(caseNumber);
          return found
            ? {
                level: "info",
                line,
                quote: caseNumber,
                text: "不在勾选的出处里。北大法宝查到了这个案号，请核对。",
                url: found.url,
              }
            : {
                level: "block",
                line,
                quote: caseNumber,
                text: "北大法宝没有查到这个案号，疑似编造。",
              };
        },
      });
    }
  });

  for (const index of usedSources) {
    const source = sources[index];
    if (source.kind === "law" && source.status && source.status !== "现行有效") {
      warnings.push({
        level: "warn",
        line: -1,
        quote: `S${index + 1}`,
        text: `这条出处的时效是「${source.status}」。`,
      });
    }
  }

  const seen = new Set<string>();
  const unique = lookups.filter((item) => !seen.has(item.key) && seen.add(item.key));
  const results = await Promise.all(
    unique.map(async (item, index): Promise<DraftWarning | null> => {
      if (index >= LOOKUP_MAX) {
        return { level: "block", line: item.line, quote: item.quote, text: "引用太多，这一条没有核对。" };
      }
      try {
        return await item.run();
      } catch (error) {
        if (!(error instanceof PkulawError)) throw error;
        return {
          level: "block",
          line: item.line,
          quote: item.quote,
          text: `${error.message}这一条没有核对。`,
        };
      }
    }),
  );
  for (const result of results) if (result) warnings.push(result);

  return warnings.sort((a, b) => a.line - b.line);
}
