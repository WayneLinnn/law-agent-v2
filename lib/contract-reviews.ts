import "server-only";

import { connection } from "next/server";

import {
  contractCitations,
  contractKind,
  CONTRACT_KINDS,
  CONTRACT_LEVELS,
  settleContractAnswer,
  type ContractAsk,
  type ContractKind,
  type ContractLevel,
  type ContractPoint,
} from "@/lib/contracts";
import { CONTRACT_ASK_SYSTEM, CONTRACT_GUIDES, REVIEW_SYSTEM } from "@/lib/contract-prompt";
import { getDb } from "@/lib/db";
import { fileExtension, MAX_FILE_BYTES } from "@/lib/file-kinds";
import { todayISO } from "@/lib/figures";
import { ModelError, write } from "@/lib/model";
import { textFromPdf } from "@/lib/pdf-text";
import { getArticle, PkulawError } from "@/lib/pkulaw";

const BODY_MAX = 12_000;
const POINT_MAX = 8;
const LOOKUP_MAX = 12;
const QUESTION_MAX = 500;
const ANSWER_MAX = 4_000;

export type { ContractPoint };

export type ContractReview = {
  id: string;
  filename: string;
  body: string;
  kind: ContractKind;
  stance: string;
  reader: string;
  createdAt: string;
  lawNote: string;
  points: ContractPoint[];
  asks: ContractAsk[];
};

type ReviewRow = {
  id: string;
  filename: string;
  body: string;
  kind: string;
  stance: string;
  reader: string;
  createdAt: string;
  lawNote: string;
};

type PointRow = {
  id: string;
  quote: string;
  issue: string;
  suggestion: string;
  level: string;
  law: string;
  lawText: string;
  lawStatus: string;
  lawUrl: string;
  lawDetail: string;
  lawChecked: number;
  decision: string;
};

type LawHit = {
  text: string;
  status: string;
  url: string;
  detail: string;
};

function listPoints(reviewId: string): ContractPoint[] {
  const rows = getDb()
    .prepare(
      `SELECT id, quote, issue, suggestion, level, law,
              law_text AS lawText, law_status AS lawStatus, law_url AS lawUrl,
              law_detail AS lawDetail, law_checked AS lawChecked, decision
       FROM contract_points WHERE review_id = ? ORDER BY position`,
    )
    .all(reviewId) as PointRow[];
  return rows.flatMap((row) => {
    if (!CONTRACT_LEVELS.includes(row.level as ContractLevel)) return [];
    const law = row.law;
    const checked = row.lawChecked === 1;
    return [
      {
        id: row.id,
        quote: row.quote,
        issue: row.issue,
        suggestion: row.suggestion,
        level: row.level as ContractLevel,
        law,
        verified: Boolean(law) && checked && Boolean(row.lawText),
        lawText: row.lawText,
        lawStatus: row.lawStatus,
        lawUrl: row.lawUrl,
        lawDetail: row.lawDetail,
        checked: checked,
        decision: row.decision === "接受" || row.decision === "跳过" ? row.decision : "",
      },
    ];
  });
}

function toReview(row: ReviewRow): ContractReview {
  const kind = contractKind(row.kind);
  return {
    id: row.id,
    filename: row.filename,
    body: row.body,
    kind: kind.label,
    stance: row.stance,
    reader: row.reader,
    createdAt: row.createdAt,
    lawNote: row.lawNote,
    points: listPoints(row.id),
    asks: listAsks(row.id),
  };
}

function splitLaw(law: string) {
  const match = law.match(/^《([^》]{2,80})》(第.+)$/);
  if (!match) return null;
  return { title: match[1], label: match[2] };
}

async function lookupLaws(laws: string[]) {
  const unique = [...new Set(laws.filter(Boolean))];
  const hits = new Map<string, LawHit | null>();
  let note = "";
  let looked = 0;
  for (const law of unique) {
    if (looked >= LOOKUP_MAX) {
      hits.set(law, null);
      continue;
    }
    const parts = splitLaw(law);
    if (!parts) {
      hits.set(law, null);
      continue;
    }
    looked += 1;
    try {
      const found = await getArticle(parts.title, parts.label);
      hits.set(
        law,
        found
          ? { text: found.text, status: found.status, url: found.url, detail: found.detail }
          : null,
      );
    } catch (error) {
      if (!(error instanceof PkulawError)) throw error;
      note = error.message;
      hits.set(law, null);
      for (const rest of unique) if (!hits.has(rest)) hits.set(rest, null);
      break;
    }
  }
  return { hits, note };
}

async function attachLaws(reviewId: string, laws: string[]) {
  const { hits, note } = await lookupLaws(laws);
  const db = getDb();
  const update = db.prepare(
    `UPDATE contract_points
     SET law_text = ?, law_status = ?, law_url = ?, law_detail = ?, law_checked = 1
     WHERE review_id = ? AND law = ? AND law_checked = 0`,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [law, hit] of hits) {
      update.run(hit?.text ?? "", hit?.status ?? "", hit?.url ?? "", hit?.detail ?? "", reviewId, law);
    }
    db.prepare("UPDATE contract_reviews SET law_note = ? WHERE id = ?").run(note, reviewId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return hits;
}

function clip(text: string, max: number) {
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function lawCite(value: string) {
  return contractCitations(value)[0] ?? "";
}

function listAsks(reviewId: string): ContractAsk[] {
  const rows = getDb()
    .prepare(
      `SELECT id, question, answer, law_note AS lawNote
       FROM contract_asks WHERE review_id = ? ORDER BY position`,
    )
    .all(reviewId) as { id: string; question: string; answer: string; lawNote: string }[];
  const laws = getDb().prepare(
    `SELECT law, law_text AS text, law_status AS status, law_url AS url, law_detail AS detail
     FROM contract_ask_laws WHERE ask_id = ? ORDER BY position`,
  );
  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    lawNote: row.lawNote,
    laws: (
      laws.all(row.id) as { law: string; text: string; status: string; url: string; detail: string }[]
    ).map((item) => ({
      law: item.law,
      text: item.text,
      status: item.status,
      url: item.url,
      detail: item.detail,
    })),
  }));
}

function parsePoints(raw: string) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as { quote?: unknown; issue?: unknown; suggestion?: unknown; level?: unknown; law?: unknown };
      const issue = typeof record.issue === "string" ? clip(record.issue, 500) : "";
      const suggestion = typeof record.suggestion === "string" ? clip(record.suggestion, 800) : "";
      const level = typeof record.level === "string" ? record.level.trim() : "";
      if (!issue || !suggestion || !CONTRACT_LEVELS.includes(level as ContractLevel)) return [];
      const quote = typeof record.quote === "string" ? clip(record.quote, 500) : "";
      const law = typeof record.law === "string" ? lawCite(record.law) : "";
      return [{ quote, issue, suggestion, level: level as ContractLevel, law }];
    })
    .slice(0, POINT_MAX);
}

async function textFromContract(name: string, bytes: Uint8Array) {
  const ext = fileExtension(name);
  if (ext !== "txt" && ext !== "pdf") {
    return { ok: false as const, error: "请放入 txt 或 pdf。", status: 400 as const };
  }
  if (bytes.byteLength === 0) return { ok: false as const, error: "这份合同是空的。", status: 400 as const };
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { ok: false as const, error: "这份合同太大。", status: 400 as const };
  }
  if (ext === "txt") {
    if (bytes.includes(0)) return { ok: false as const, error: "读不出文字。", status: 400 as const };
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "").trim();
      if (!text) return { ok: false as const, error: "读不出文字。", status: 400 as const };
      return { ok: true as const, text };
    } catch {
      return { ok: false as const, error: "读不出文字。", status: 400 as const };
    }
  }
  try {
    const text = (await textFromPdf(bytes)).trim();
    if (!text) return { ok: false as const, error: "读不出文字。", status: 400 as const };
    return { ok: true as const, text };
  } catch {
    return { ok: false as const, error: "读不出文字。", status: 400 as const };
  }
}

export async function createContractReview(input: {
  filename: string;
  bytes: Uint8Array;
  kind: string;
  stance: string;
  reader: string;
}) {
  await connection();
  const kind = CONTRACT_KINDS.find((item) => item.label === input.kind.trim());
  if (!kind) return { ok: false as const, error: "请选择合同类型。", status: 400 as const };
  const stance = input.stance.trim();
  if (!(kind.stances as readonly string[]).includes(stance)) {
    return { ok: false as const, error: "请选择审查立场。", status: 400 as const };
  }
  const reader = input.reader.trim();
  if (reader.length > 10) return { ok: false as const, error: "审阅人最多 10 个字。", status: 400 as const };
  const read = await textFromContract(input.filename, input.bytes);
  if (!read.ok) return read;

  const id = crypto.randomUUID();
  const createdAt = todayISO();
  getDb()
    .prepare(
      `INSERT INTO contract_reviews (id, filename, body, kind, stance, reader, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.filename.trim() || "合同", read.text, kind.label, stance, reader, createdAt);
  return { ok: true as const, id };
}

export async function startContractReview(id: string) {
  await connection();
  const review = await getContractReview(id);
  if (!review) return { ok: false as const, error: "没有这次审查。", status: 404 as const };
  if (review.points.length > 0) {
    const pending = review.points.some((point) => point.law && !point.checked);
    if (!pending) return { ok: false as const, error: "这次审查已经有审查点。", status: 409 as const };
    await attachLaws(
      review.id,
      review.points.filter((point) => point.law && !point.checked).map((point) => point.law),
    );
    return { ok: true as const, count: review.points.length };
  }
  const body = review.body.length > BODY_MAX ? `${review.body.slice(0, BODY_MAX)}……` : review.body;
  const prompt = [
    `合同类型：${review.kind}`,
    `审查立场：${review.stance}`,
    "审查指南：",
    CONTRACT_GUIDES[review.kind],
    "",
    "合同正文：",
    body,
  ].join("\n");

  let written: { text: string };
  try {
    written = await write(REVIEW_SYSTEM, prompt);
  } catch (error) {
    if (error instanceof ModelError) return { ok: false as const, error: error.message, status: 502 as const };
    throw error;
  }
  const points = parsePoints(written.text);
  if (points.length === 0) {
    return { ok: false as const, error: "没有审查出问题。", status: 400 as const };
  }
  const { hits, note } = await lookupLaws(points.map((point) => point.law));

  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO contract_points
       (id, review_id, position, quote, issue, suggestion, level, law, law_text, law_status, law_url, law_detail, law_checked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    points.forEach((point, index) => {
      const hit = point.law ? hits.get(point.law) : null;
      insert.run(
        crypto.randomUUID(),
        review.id,
        index,
        point.quote,
        point.issue,
        point.suggestion,
        point.level,
        point.law,
        hit?.text ?? "",
        hit?.status ?? "",
        hit?.url ?? "",
        hit?.detail ?? "",
      );
    });
    db.prepare("UPDATE contract_reviews SET law_note = ? WHERE id = ?").run(note, review.id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true as const, count: points.length };
}

export async function decideContractPoint(reviewId: string, pointId: string, decision: string) {
  await connection();
  if (decision !== "接受" && decision !== "跳过") {
    return { ok: false as const, error: "请选择接受或跳过。", status: 400 as const };
  }
  const db = getDb();
  const review = db.prepare("SELECT id FROM contract_reviews WHERE id = ?").get(reviewId);
  if (!review) return { ok: false as const, error: "没有这次审查。", status: 404 as const };
  const changed = db
    .prepare("UPDATE contract_points SET decision = ? WHERE id = ? AND review_id = ?")
    .run(decision, pointId, reviewId);
  if (changed.changes !== 1) return { ok: false as const, error: "没有这张卡片。", status: 404 as const };
  return { ok: true as const };
}

export async function askContractReview(id: string, question: string) {
  await connection();
  const trimmed = question.trim();
  if (!trimmed) return { ok: false as const, error: "请写下问题。", status: 400 as const };
  if (trimmed.length > QUESTION_MAX) {
    return { ok: false as const, error: "问题最多 500 个字。", status: 400 as const };
  }
  const review = await getContractReview(id);
  if (!review) return { ok: false as const, error: "没有这次审查。", status: 404 as const };
  if (review.points.length === 0) {
    return { ok: false as const, error: "审查点出来之后才能问。", status: 409 as const };
  }
  const body = review.body.length > BODY_MAX ? `${review.body.slice(0, BODY_MAX)}……` : review.body;
  const cards = review.points
    .map((point, index) => {
      const lines = [`${index + 1}. ${point.level}`, `问题：${point.issue}`];
      if (point.quote) lines.push(`原句：${point.quote}`);
      lines.push(`建议：${point.suggestion}`);
      if (point.verified && point.lawText) {
        lines.push(`已核法条：${point.law}`);
        lines.push(point.lawText);
      }
      return lines.join("\n");
    })
    .join("\n\n");
  const prompt = ["合同正文：", body, "", "审查点：", cards, "", "问题：", trimmed].join("\n");

  let written: { text: string };
  try {
    written = await write(CONTRACT_ASK_SYSTEM, prompt);
  } catch (error) {
    if (error instanceof ModelError) return { ok: false as const, error: error.message, status: 502 as const };
    throw error;
  }

  const { hits, note } = await answerHits(review, contractCitations(written.text));
  const settled = settleContractAnswer(written.text, hits);
  const answer = clip(settled.text, ANSWER_MAX);
  const laws = settled.laws.filter((item) => answer.includes(item.law));
  const askId = crypto.randomUUID();
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS n FROM contract_asks WHERE review_id = ?").get(id) as { n: number };
  const insertLaw = db.prepare(
    `INSERT INTO contract_ask_laws
       (id, ask_id, position, law, law_text, law_status, law_url, law_detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO contract_asks (id, review_id, position, question, answer, law_note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(askId, id, Number(count.n), trimmed, answer, note, todayISO());
    laws.forEach((item, index) => {
      insertLaw.run(crypto.randomUUID(), askId, index, item.law, item.text, item.status, item.url, item.detail);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true as const, id: askId };
}

async function answerHits(review: ContractReview, cites: string[]) {
  const hits = new Map<string, LawHit | null>();
  const fresh: string[] = [];
  for (const cite of cites) {
    const known = review.points.find((point) => point.law === cite && point.checked);
    if (!known) {
      fresh.push(cite);
      continue;
    }
    hits.set(
      cite,
      known.lawText
        ? { text: known.lawText, status: known.lawStatus, url: known.lawUrl, detail: known.lawDetail }
        : null,
    );
  }
  const looked = await lookupLaws(fresh);
  for (const [law, hit] of looked.hits) hits.set(law, hit);
  return { hits, note: looked.note };
}

export async function getContractReview(id: string) {
  await connection();
  const row = getDb()
    .prepare(
      `SELECT id, filename, body, kind, stance, reader, created_at AS createdAt, law_note AS lawNote
       FROM contract_reviews WHERE id = ?`,
    )
    .get(id) as ReviewRow | undefined;
  if (!row) return null;
  return toReview({ ...row });
}
