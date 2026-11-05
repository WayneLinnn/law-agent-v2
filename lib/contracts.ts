export const CONTRACT_KINDS = [
  { label: "买卖", stances: ["买方", "卖方"] },
  { label: "租赁", stances: ["出租人", "承租人"] },
  { label: "服务", stances: ["委托方", "服务方"] },
  { label: "股权转让", stances: ["转让方", "受让方"] },
  { label: "劳动合同", stances: ["劳动者", "用人单位"] },
  { label: "借款", stances: ["出借人", "借款人"] },
  { label: "担保", stances: ["担保人", "债权人"] },
  { label: "保密", stances: ["披露方", "接收方"] },
  { label: "通用", stances: ["甲方", "乙方"] },
] as const;

export type ContractKind = (typeof CONTRACT_KINDS)[number]["label"];

export const CONTRACT_LEVELS = ["红线", "要改", "提示"] as const;

export type ContractLevel = (typeof CONTRACT_LEVELS)[number];

export type ContractPoint = {
  id: string;
  quote: string;
  issue: string;
  suggestion: string;
  level: ContractLevel;
  law: string;
  verified: boolean;
  lawText: string;
  lawStatus: string;
  lawUrl: string;
  lawDetail: string;
  checked: boolean;
  decision: "" | "接受" | "跳过";
};

export function contractOpinion(points: ContractPoint[]) {
  const accepted = points.filter((point) => point.decision === "接受");
  if (accepted.length === 0) return "";
  return accepted
    .map((point, index) => {
      const lines = [`${index + 1}. ${point.level}`, point.issue];
      if (point.quote) lines.push(point.quote);
      lines.push(point.suggestion);
      if (point.verified && point.lawText) {
        const head = [point.law, point.lawStatus].filter(Boolean).join(" · ");
        if (head) lines.push(head);
        lines.push(point.lawText);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export function contractKind(label: string) {
  return CONTRACT_KINDS.find((item) => item.label === label) ?? CONTRACT_KINDS[0];
}

export type ContractAskLaw = {
  law: string;
  text: string;
  status: string;
  url: string;
  detail: string;
};

export type ContractAsk = {
  id: string;
  question: string;
  answer: string;
  lawNote: string;
  laws: ContractAskLaw[];
};

const BOOK = "《[^》]{2,80}》";
const ARTICLE =
  "第[零〇一二三四五六七八九十百千\\d]+条(?:之[一二三四五六七八九十]+)?(?:第[零〇一二三四五六七八九十\\d]+款)?(?:第[零〇一二三四五六七八九十\\d]+项)?";
const LAW_SOURCE = `${BOOK}${ARTICLE}`;

function citesIn(sentence: string) {
  const strict = sentence.match(new RegExp(LAW_SOURCE, "g")) ?? [];
  const found = strict.map((cite) => ({ cite, remove: cite }));
  const books = sentence.match(new RegExp(BOOK, "g")) ?? [];
  if (books.length === 0) return found;
  const used = new Set(strict.map((cite) => cite.match(new RegExp(ARTICLE))?.[0] ?? ""));
  for (const article of sentence.match(new RegExp(ARTICLE, "g")) ?? []) {
    if (used.has(article)) continue;
    used.add(article);
    found.push({ cite: `${books[books.length - 1]}${article}`, remove: article });
  }
  return found;
}

export function contractCitations(value: string) {
  return [...new Set(value.split(/[。！？\n]/).flatMap((sentence) => citesIn(sentence).map((item) => item.cite)))];
}

export function settleContractAnswer(
  answer: string,
  hits: ReadonlyMap<string, { text: string; status: string; url: string; detail: string } | null>,
) {
  const parts = answer.split(/([。！？\n])/);
  const laws: ContractAskLaw[] = [];
  const seen = new Set<string>();
  let text = "";
  for (let index = 0; index < parts.length; index += 2) {
    const sentence = parts[index] ?? "";
    const delim = parts[index + 1] ?? "";
    const cites = citesIn(sentence);
    const missed = cites.some((item) => !hits.get(item.cite)?.text);
    if (!missed) {
      for (const item of cites) {
        const hit = hits.get(item.cite);
        if (!hit?.text || seen.has(item.cite)) continue;
        seen.add(item.cite);
        laws.push({ law: item.cite, text: hit.text, status: hit.status, url: hit.url, detail: hit.detail });
      }
      text += sentence + delim;
      continue;
    }
    let next = sentence;
    const missedBooks = new Set<string>();
    for (const item of cites) {
      const hit = hits.get(item.cite);
      if (hit?.text) {
        if (!seen.has(item.cite)) {
          seen.add(item.cite);
          laws.push({ law: item.cite, text: hit.text, status: hit.status, url: hit.url, detail: hit.detail });
        }
        continue;
      }
      next = next.split(item.remove).join("");
      const book = item.cite.match(new RegExp(`^${BOOK}`))?.[0];
      if (book) missedBooks.add(book);
    }
    for (const book of missedBooks) {
      const kept = cites.some((item) => item.cite.startsWith(book) && hits.get(item.cite)?.text);
      if (!kept) next = next.split(book).join("");
    }
    next = next
      .replace(/[ \t]{2,}/g, " ")
      .replace(/(?:以及|和|或|、|，)\s*$/g, "")
      .trim();
    const tail = delim === "\n" ? "\n" : "。";
    text += `${next ? `${next}。未核上` : "未核上"}${tail}`;
  }
  return { text: text.trim(), laws };
}
