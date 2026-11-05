import "server-only";

import { connection } from "next/server";

import { ModelError, write } from "@/lib/model";
import { PkulawError, searchCases, searchLaws } from "@/lib/pkulaw";
import type { AskHit, SourceCandidate } from "@/lib/types";

const QUESTION_MAX = 500;
const LAW_SIZE = 8;
const LAW_KEEP = 6;
const CASE_SIZE = 5;
const PROMPT_TEXT_MAX = 1_500;
const SHOWN_TEXT_MAX = 4_000;

const ID_RE = /\d{17}[\dXx]/g;
const PHONE_RE = /1[3-9]\d{9}/g;
const COMPANY_RE =
  /[\u4e00-\u9fa5]{2,12}?(?:股份有限公司|有限责任公司|有限公司|集团公司)/g;
const ADDRESS_RE =
  /[\u4e00-\u9fa5]{2,8}(?:省|自治区|市)[\u4e00-\u9fa5\d]{0,12}(?:市|区|县)[\u4e00-\u9fa5\d\-－]{0,30}?(?:路|街|道|巷|村)[\d\-－]+号/g;

const ASK_SYSTEM = `你是中国执业律师的检索助手。读者是律师。只根据给出的法条和案例原文回答这个问题。

规则：
1. 第一句直接回答问题。后面只写支撑这句话的材料，不要把每条检索结果都复述一遍。
2. 不得使用这些材料以外的法条、司法解释、案例或案号。名称、条号、案号照抄材料。法条写《法规全称》第X条。
3. 先写能回答问题的法条，再写案例说明法院如何适用。案例不能替代法条。材料写明指导性案例或公报案例的，照实写明；没有写明的，不要升格。
4. 材料里的效力状态照抄。失效或尚未生效的，不要当作现行依据。
5. 法条和案例不一致，或几条法条指向不同结论时，并列写明差异，不要合成一个没有出处的结论。
6. 材料没有写到的部分，写「这些材料里没有写明」，不要补法理、金额、日期或办案建议。
7. 纯文本。不用 Markdown 符号，不用 #、*、表格。不写成起诉状或给当事人的信。`;

function deidentify(text: string) {
  return text
    .replace(ID_RE, "某身份证号")
    .replace(PHONE_RE, "某电话")
    .replace(ADDRESS_RE, "某地")
    .replace(COMPANY_RE, "某公司");
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}……` : text;
}

function hit(item: SourceCandidate): AskHit {
  return {
    title: item.title,
    text: clip(item.text, SHOWN_TEXT_MAX),
    url: item.url,
    detail: item.detail,
  };
}

function packet(label: string, items: AskHit[]) {
  if (items.length === 0) return `${label}：\n无`;
  return [
    `${label}：`,
    ...items.map(
      (item, index) =>
        `[${index + 1}] ${item.title}\n${item.detail}\n${clip(item.text, PROMPT_TEXT_MAX)}`,
    ),
  ].join("\n\n");
}

async function retrieve(question: string) {
  await connection();
  const trimmed = question.trim();
  if (!trimmed) return { ok: false as const, error: "请写下法律问题。", status: 400 as const, laws: [] as AskHit[], cases: [] as AskHit[] };
  if (trimmed.length > QUESTION_MAX) {
    return { ok: false as const, error: "法律问题写得太长。", status: 400 as const, laws: [] as AskHit[], cases: [] as AskHit[] };
  }
  const cleaned = deidentify(trimmed);

  try {
    const [lawHits, caseHits] = await Promise.all([
      searchLaws(cleaned, LAW_SIZE),
      searchCases(cleaned, CASE_SIZE),
    ]);
    return {
      ok: true as const,
      cleaned,
      laws: lawHits.slice(0, LAW_KEEP).map(hit),
      cases: caseHits.map(hit),
    };
  } catch (error) {
    if (error instanceof PkulawError) {
      return { ok: false as const, error: error.message, status: 502 as const, laws: [] as AskHit[], cases: [] as AskHit[] };
    }
    throw error;
  }
}

export async function lookupLaw(question: string) {
  const found = await retrieve(question);
  if (!found.ok) return found;
  return { ok: true as const, laws: found.laws, cases: found.cases };
}

export async function askLaw(question: string) {
  const found = await retrieve(question);
  if (!found.ok) return found;
  const { cleaned, laws, cases } = found;

  if (laws.length === 0 && cases.length === 0) {
    return {
      ok: true as const,
      answer: "没有检索到现行有效的法条或案例。",
      laws,
      cases,
    };
  }

  try {
    const written = await write(
      ASK_SYSTEM,
      ["法律问题：", cleaned, "", packet("法条", laws), "", packet("案例", cases)].join("\n"),
    );
    return { ok: true as const, answer: written.text, laws, cases };
  } catch (error) {
    if (error instanceof ModelError) {
      return { ok: false as const, error: error.message, status: 502 as const, laws, cases };
    }
    throw error;
  }
}
