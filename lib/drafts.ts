import { connection } from "next/server";

import { checkDraft } from "@/lib/draft-check";
import { DRAFT_KINDS } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { todayISO } from "@/lib/figures";
import { researchGate } from "@/lib/focuses";
import { getMatter } from "@/lib/matters";
import { ModelError, write } from "@/lib/model";
import { listSources } from "@/lib/research";
import type {
  DraftKind,
  DraftRecord,
  DraftRefs,
  DraftWarning,
  ElementRecord,
  MatterDetail,
  SourceRecord,
} from "@/lib/types";

const BODY_MAX = 30_000;
const SOURCE_TEXT_MAX = 1_500;
export function isDraftKind(value: unknown): value is DraftKind {
  return typeof value === "string" && (DRAFT_KINDS as readonly string[]).includes(value);
}

function stringList(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : null;
}

export function readRefs(input: { sourceIds?: unknown; elementIds?: unknown } | null) {
  const sourceIds = stringList(input?.sourceIds);
  const elementIds = stringList(input?.elementIds);
  return sourceIds && elementIds ? { sourceIds, elementIds } : null;
}

const DRAFT_SYSTEM = `你是中国执业律师的助手，为律师起草文书初稿。律师会逐字修改，再定稿。

规则：
1. 只能使用用户给出的「本案信息」「要素」「争议焦点」和「参考资料」。不得使用参考资料以外的法条、司法解释、案例或案号。
2. 立场以客户为准。意见书写给客户。起诉状、上诉状由客户提出请求。答辩状、二审答辩状由客户作答辩人。不要替对方起草。
3. 按「文书种类」规定的任务写。意见书不下诉讼请求，起诉状和上诉状不写成意见书。
4. 正文每一段末尾标出依据：事实标【E编号】，法律依据和类案标【S编号】，可以连标，例如【E2】【S1】【S3】。标题、小标题、致送对象、声明和落款不用标。没有依据的结论不要写死。
5. 引用法条写《法规全称》第X条。法规全称照抄参考资料标题里的名称，条号用中文数字。类案只说明参考意义，案号照抄；材料没有写明指导性案例的，不要写成应当遵循。
6. 某一段缺少出处时，这一句写「现有出处不足，需律师补充」，不要用原理、习惯或样本里的例子填上。
7. 不编造事实、金额、日期、当事人、证据名称。证据目录只列本案资料里出现过的材料；没有就写「需律师补充」。
8. 诉讼地位、法院、案号、裁判日期，本案资料没有写明的就留空，并写「请律师填写」。落款、签名和日期留空。
9. 只输出指定种类的文书正文，纯文本。不用 Markdown 符号，不用 #、*、表格。`;

const STRUCTURES: Record<DraftKind, string> = {
  意见书:
    "写给客户的法律意见，不递交法院。顺序：致客户；基本事实；按争议焦点逐点写能否成立；结论意见；风险提示；声明。不下诉讼请求，不写此致法院。",
  起诉状:
    "递交一审法院的民事起诉状。顺序：当事人；诉讼请求逐项写明可执行的内容；事实与理由按时间写，并让每项请求对上事实和出处；证据目录；此致法院；落款留空。",
  答辩状:
    "一审民事答辩状。顺序：答辩人；针对对方请求逐项承认或否认；事实与理由；证据目录；此致法院；落款留空。本案资料没有反诉的，不写反诉。",
  上诉状:
    "民事上诉状。针对一审裁判的认定或适用错误，不重写起诉状。顺序：上诉人与被上诉人；一审法院、案号、裁判日期，没有则留空；上诉请求写明撤销或改判哪一项；事实与理由只写不服的点；此致上一级法院；落款留空。",
  二审答辩状:
    "二审民事答辩状。按上诉请求逐项回应。顺序：答辩人与上诉人；答辩请求；事实与理由；此致法院；落款留空。本案资料没有相反记载时，答辩请求写驳回上诉、维持原判。",
};

const SAMPLES: Record<DraftKind, string> = {
  意见书: `法律意见书
致：甲公司
一、基本事实
只写本案要素里的事实。【E1】
二、争议焦点
逐点写该点能否成立，并标出法条或类案。【S1】
三、结论意见
现有出处足以支持的写明；不足的写「现有出处不足，需律师补充」。
四、风险提示
只写本案资料里看得到的风险。没有则写需律师补充。
五、声明
本意见供律师修改，不递交法院。落款和日期留空。`,
  起诉状: `民事起诉状
原告：甲公司
被告：乙公司
诉讼请求：
1. 写明一项可执行的请求。【E1】
事实与理由：
按时间写事实，并让这项请求对上出处。【E2】【S1】
证据目录：
1. 只列本案资料里出现过的材料名称
此致
（法院名称，没有则写请律师填写）
起诉人：
日期：`,
  答辩状: `民事答辩状
答辩人：甲公司
针对对方的诉讼请求，答辩如下：
答辩请求：
驳回对方相应的诉讼请求。
事实与理由：
1. 对第一项请求：承认或否认，并写依据。【E1】【S1】
证据目录：
1. 只列本案资料里出现过的材料名称
此致
（法院名称，没有则写请律师填写）
答辩人：
日期：`,
  上诉状: `民事上诉状
上诉人：甲公司
被上诉人：乙公司
一审法院：请律师填写
一审案号：请律师填写
上诉请求：
1. 撤销一审裁判的某一项，写明改判内容。
事实与理由：
只写不服的那一点，不重述全案。【E1】【S1】
此致
（上一级法院，没有则写请律师填写）
上诉人：
日期：`,
  二审答辩状: `民事答辩状
答辩人：甲公司
上诉人：乙公司
答辩请求：
驳回上诉，维持原判。
事实与理由：
1. 针对第一项上诉请求：写明是否成立及依据。【E1】【S1】
此致
（法院名称，没有则写请律师填写）
答辩人：
日期：`,
};

function clip(text: string) {
  return text.length > SOURCE_TEXT_MAX ? `${text.slice(0, SOURCE_TEXT_MAX)}……` : text;
}

function opinionPrompt(
  detail: MatterDetail,
  elements: ElementRecord[],
  sources: SourceRecord[],
  kind: DraftKind,
) {
  const names = (role: string) =>
    detail.parties.filter((party) => party.role === role).map((party) => party.name).join("、") || "无";
  const { matter, focuses } = detail;
  return [
    `文书种类：${kind}`,
    `建议结构：${STRUCTURES[kind]}`,
    "下面有一份匿名结构参考。只学段落顺序，不要照抄里面的公司、金额和法院。正文必须改用本案资料。",
    "结构参考",
    SAMPLES[kind],
    "只根据本案资料起草。以客户为文书的一方。缺少法院、案号、诉讼地位或裁判日期时留空，并写请律师填写。",
    "",
    "本案信息",
    `案件名称：${matter.name}`,
    `案由：${matter.cause}`,
    `我方（客户）：${names("client")}`,
    `我方（同侧，不是客户）：${names("ally")}`,
    `对方：${names("opposing")}`,
    "同侧当事人与客户同一边，不是对方。文书仍以客户为一方。",
    `法院：${matter.courtName || names("court") || "无"}`,
    `案号：${matter.caseNumber || "未填写"}`,
    `委托事项：${matter.mandate}`,
    `基本事实（背景，事实以要素为准）：${matter.facts}`,
    "",
    "要素",
    ...elements.map((element, index) => `E${index + 1}（${element.kind}）：${element.body}`),
    "",
    "争议焦点",
    ...focuses
      .filter((focus) => focus.confirmedAt)
      .map((focus, index) =>
        focus.lawQuery
          ? `${index + 1}. ${focus.body}\n法条问题：${focus.lawQuery}`
          : `${index + 1}. ${focus.body}`,
      ),
    "",
    "参考资料",
    ...sources.flatMap((source, index) => [
      `S${index + 1}（${source.kind === "law" ? "法条" : "类案"}）${source.title}`,
      [source.status, source.detail].filter(Boolean).join(" · "),
      clip(source.text),
      "",
    ]),
  ].join("\n");
}

function cleanBody(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function confirmedElements(detail: MatterDetail) {
  return detail.elements.filter((element) => element.confirmedAt);
}

async function loadRefs(matterId: string) {
  const [detail, sources] = await Promise.all([getMatter(matterId), listSources(matterId)]);
  if (!detail) return null;
  return { detail, sources, elements: confirmedElements(detail) };
}

function pickRefs(
  refs: DraftRefs,
  sources: SourceRecord[],
  elements: ElementRecord[],
) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const pickedSources = refs.sourceIds.map((id) => sourceById.get(id));
  const pickedElements = refs.elementIds.map((id) => elementById.get(id));
  if (pickedSources.some((item) => !item) || pickedElements.some((item) => !item)) {
    return null;
  }
  return {
    sources: pickedSources as SourceRecord[],
    elements: pickedElements as ElementRecord[],
  };
}

export async function generateDraft(matterId: string, kind: DraftKind) {
  const gate = await researchGate(matterId);
  if (gate.status !== 200) return gate;
  const loaded = await loadRefs(matterId);
  if (!loaded) return { error: "没有这件案子。", status: 404 as const };
  const { detail, sources, elements } = loaded;
  if (sources.length === 0) {
    return { error: "还没有收进出处。先检索，勾选出处，再起草。", status: 409 as const };
  }

  let written: { text: string; cut: boolean };
  try {
    written = await write(DRAFT_SYSTEM, opinionPrompt(detail, elements, sources, kind));
  } catch (error) {
    if (error instanceof ModelError) return { error: error.message, status: 502 as const };
    throw error;
  }
  const body = cleanBody(written.text);
  const warnings = await checkDraft(body, sources, elements);
  if (written.cut) {
    warnings.unshift({ level: "warn", line: -1, quote: "", text: "初稿太长，被截断了。" });
  }
  return {
    kind,
    body,
    sourceIds: sources.map((source) => source.id),
    elementIds: elements.map((element) => element.id),
    warnings,
    status: 200 as const,
  };
}

function readBody(body: unknown) {
  if (typeof body !== "string" || !body.trim()) {
    return { error: "正文是空的。", status: 400 as const };
  }
  if (body.length > BODY_MAX) return { error: "正文太长。", status: 400 as const };
  return { body: body.replace(/\r\n/g, "\n").trim(), status: 200 as const };
}

export async function recheckDraft(matterId: string, body: unknown, refs: DraftRefs) {
  const gate = await researchGate(matterId);
  if (gate.status !== 200) return gate;
  const read = readBody(body);
  if (read.status !== 200) return read;
  const loaded = await loadRefs(matterId);
  if (!loaded) return { error: "没有这件案子。", status: 404 as const };
  const picked = pickRefs(refs, loaded.sources, loaded.elements);
  if (!picked) return { error: "出处已经变了，请重新起草。", status: 409 as const };
  const warnings = await checkDraft(read.body, picked.sources, picked.elements);
  return { warnings, status: 200 as const };
}

function insertVersion(
  matterId: string,
  input: {
    kind: DraftKind;
    body: string;
    refs: DraftRefs;
    warnings: DraftWarning[];
    final: boolean;
    basedOn: number | null;
  },
) {
  const db = getDb();
  const id = crypto.randomUUID();
  const createdAt = todayISO();
  db.exec("BEGIN IMMEDIATE");
  try {
    const last = db
      .prepare("SELECT COALESCE(MAX(version), 0) AS n FROM drafts WHERE matter_id = ?")
      .get(matterId) as { n: number };
    const version = last.n + 1;
    db.prepare(
      `INSERT INTO drafts (
         id, matter_id, kind, version, body, source_ids, element_ids,
         warnings, final, based_on, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      matterId,
      input.kind,
      version,
      input.body,
      JSON.stringify(input.refs.sourceIds),
      JSON.stringify(input.refs.elementIds),
      JSON.stringify(input.warnings),
      input.final ? 1 : 0,
      input.basedOn,
      createdAt,
    );
    db.exec("COMMIT");
    return { id, version, createdAt };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function acceptDraft(
  matterId: string,
  input: { kind: DraftKind; body: unknown; refs: DraftRefs; basedOn: number | null },
) {
  const checked = await recheckDraft(matterId, input.body, input.refs);
  if (checked.status !== 200) return checked;
  const read = readBody(input.body);
  if (read.status !== 200) return read;
  const saved = insertVersion(matterId, {
    kind: input.kind,
    body: read.body,
    refs: input.refs,
    warnings: checked.warnings,
    final: false,
    basedOn: input.basedOn,
  });
  return { ...saved, warnings: checked.warnings, status: 201 as const };
}

export async function finalizeDraft(matterId: string, draftId: string) {
  const gate = await researchGate(matterId);
  if (gate.status !== 200) return gate;
  const draft = (await listDrafts(matterId)).find((item) => item.id === draftId);
  if (!draft) return { error: "没有这一版。", status: 404 as const };
  if (draft.final) return { error: "这一版已经由律师定稿。", status: 409 as const };

  const checked = await recheckDraft(matterId, draft.body, draft);
  if (checked.status !== 200) return checked;
  if (checked.warnings.some((warning) => warning.level === "block")) {
    return {
      error: "这一版还有疑似编造或没有核对的引用，不能定稿。",
      warnings: checked.warnings,
      status: 409 as const,
    };
  }
  const saved = insertVersion(matterId, {
    kind: draft.kind,
    body: draft.body,
    refs: draft,
    warnings: checked.warnings,
    final: true,
    basedOn: draft.version,
  });
  return { ...saved, status: 201 as const };
}

type DraftRow = {
  id: string;
  kind: DraftKind;
  version: number;
  body: string;
  sourceIds: string;
  elementIds: string;
  warnings: string;
  final: number;
  basedOn: number | null;
  createdAt: string;
};

export async function listDrafts(matterId: string): Promise<DraftRecord[]> {
  await connection();
  const rows = getDb()
    .prepare(
      `SELECT id, kind, version, body, source_ids AS sourceIds,
              element_ids AS elementIds, warnings, final,
              based_on AS basedOn, created_at AS createdAt
       FROM drafts
       WHERE matter_id = ?
       ORDER BY version DESC`,
    )
    .all(matterId) as DraftRow[];
  return rows.map(
    (row): DraftRecord => ({
      id: row.id,
      kind: row.kind,
      version: row.version,
      body: row.body,
      sourceIds: JSON.parse(row.sourceIds) as string[],
      elementIds: JSON.parse(row.elementIds) as string[],
      warnings: JSON.parse(row.warnings) as DraftWarning[],
      final: row.final === 1,
      basedOn: row.basedOn,
      createdAt: row.createdAt,
    }),
  );
}

export async function hasFinalDraft(matterId: string) {
  await connection();
  const row = getDb()
    .prepare("SELECT 1 AS ok FROM drafts WHERE matter_id = ? AND final = 1 LIMIT 1")
    .get(matterId);
  return Boolean(row);
}
