import { ELEMENT_KINDS, type ElementKind } from "@/lib/constants";

export type ElementDraft = {
  kind: ElementKind;
  body: string;
  sourceLabel: string;
  sourceMaterialId: string | null;
};

const DATE_RE = /\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/;
const MONEY_RE = /人民币|[\d,，]+\s*元|\d+\s*%/;
const FACT_LABEL_RE = /^(工程名称|项目|签证事项|签证编号)[：:]/;

function kindOf(line: string): ElementKind | null {
  if (/^委托事项[：:]/.test(line)) return "请求";
  const money = MONEY_RE.test(line);
  const date = DATE_RE.test(line);
  if (date && !money) return "日期";
  if (money) return "金额";
  if (FACT_LABEL_RE.test(line)) return "事实";
  if (/[。．]$/.test(line)) return "事实";
  return null;
}

export function readElements(input: {
  facts: string;
  mandate: string;
  materials: { id: string; filename: string; extractedText: string }[];
}): ElementDraft[] {
  const drafts: ElementDraft[] = [];

  function push(
    kind: ElementKind,
    body: string,
    sourceLabel: string,
    sourceMaterialId: string | null,
  ) {
    const text = body.replace(/\s+/g, " ").trim();
    if (!text) return;
    if (
      drafts.some(
        (draft) =>
          draft.kind === kind &&
          draft.body === text &&
          draft.sourceLabel === sourceLabel,
      )
    ) {
      return;
    }
    drafts.push({
      kind,
      body: text,
      sourceLabel,
      sourceMaterialId,
    });
  }

  const mandate = input.mandate.trim();
  if (mandate) push("请求", mandate, "本案", null);
  const facts = input.facts.trim();
  if (facts) push("事实", facts, "本案", null);

  for (const material of input.materials) {
    for (const line of material.extractedText.split(/\r?\n/)) {
      const text = line.trim();
      if (!text) continue;
      const kind = kindOf(text);
      if (!kind) continue;
      push(kind, text, material.filename, material.id);
    }
  }

  const rank = new Map(ELEMENT_KINDS.map((kind, index) => [kind, index]));
  return drafts
    .map((draft, index) => ({ draft, index }))
    .sort(
      (left, right) =>
        (rank.get(left.draft.kind) ?? 0) - (rank.get(right.draft.kind) ?? 0) ||
        left.index - right.index,
    )
    .map((item) => item.draft);
}
