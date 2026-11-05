import "server-only";

import { connection } from "next/server";

import { askLaw, lookupLaw } from "@/lib/ask";
import { getDb } from "@/lib/db";
import { todayISO } from "@/lib/figures";
import type { AskHit, MatterAskRecord } from "@/lib/types";

function stamp(now = new Date()) {
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${todayISO(now)} ${hours}:${minutes}`;
}

function hits(value: string): AskHit[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      if (typeof record.title !== "string" || typeof record.text !== "string") return [];
      return [
        {
          title: record.title,
          text: record.text,
          url: typeof record.url === "string" ? record.url : "",
          detail: typeof record.detail === "string" ? record.detail : "",
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function listMatterAsks(matterId: string): Promise<MatterAskRecord[] | null> {
  await connection();
  const db = getDb();
  const matter = db.prepare("SELECT id FROM matters WHERE id = ?").get(matterId);
  if (!matter) return null;
  const rows = db
    .prepare(
      `SELECT id, question, mode, answer, laws_json AS lawsJson, cases_json AS casesJson, created_at AS createdAt
       FROM matter_asks
       WHERE matter_id = ?
       ORDER BY created_at DESC, id DESC`,
    )
    .all(matterId) as {
    id: string;
    question: string;
    mode: string;
    answer: string;
    lawsJson: string;
    casesJson: string;
    createdAt: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    mode: row.mode === "answer" ? "answer" : "lookup",
    answer: row.answer,
    laws: hits(row.lawsJson),
    cases: hits(row.casesJson),
    createdAt: row.createdAt,
  }));
}

export async function recordMatterAsk(matterId: string, question: string, lookup: boolean) {
  await connection();
  const db = getDb();
  const matter = db.prepare("SELECT id FROM matters WHERE id = ?").get(matterId);
  if (!matter) {
    return { ok: false as const, error: "没有这件案子。", status: 404 as const, laws: [] as AskHit[], cases: [] as AskHit[] };
  }
  const result = lookup ? await lookupLaw(question) : await askLaw(question);
  if (!result.ok) return result;
  const record: MatterAskRecord = {
    id: crypto.randomUUID(),
    question: question.trim(),
    mode: lookup ? "lookup" : "answer",
    answer: "answer" in result && typeof result.answer === "string" ? result.answer : "",
    laws: result.laws,
    cases: result.cases,
    createdAt: stamp(),
  };
  db.prepare(
    `INSERT INTO matter_asks (id, matter_id, question, mode, answer, laws_json, cases_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id,
    matterId,
    record.question,
    record.mode,
    record.answer,
    JSON.stringify(record.laws),
    JSON.stringify(record.cases),
    record.createdAt,
  );
  return { ok: true as const, record };
}
