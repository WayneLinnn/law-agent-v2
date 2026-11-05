import "server-only";

import { connection } from "next/server";

import {
  canEditRecord,
  isMatterStatus,
  isRulingKind,
  type RulingKind,
} from "@/lib/constants";
import { getDb } from "@/lib/db";
import { isIsoDate } from "@/lib/figures";
import { structureRuling } from "@/lib/model";
import { readRuling } from "@/lib/ruling-read";
import type { RulingRecord } from "@/lib/types";

const RESULT_MAX = 500;

function dateField(value: string, label: string) {
  const text = value.trim();
  if (!text) return { ok: true as const, value: "" };
  if (!isIsoDate(text)) {
    return { ok: false as const, error: `${label}要写成日期。`, status: 400 as const };
  }
  return { ok: true as const, value: text };
}

export async function saveRuling(
  matterId: string,
  input: {
    materialId: string;
    kind: string;
    decidedOn: string;
    servedOn: string;
    effectiveOn: string;
    result: string;
    caseNumber?: string;
    courtName?: string;
  },
) {
  await connection();
  const db = getDb();
  const matter = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(matterId) as { status: string } | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (!isMatterStatus(matter.status) || !canEditRecord(matter.status)) {
    return { error: "这件案子现在不能记裁判。", status: 409 as const };
  }
  if (!isRulingKind(input.kind)) {
    return { error: "请选择判决、裁定或调解书。", status: 400 as const };
  }

  const material = db
    .prepare(
      "SELECT kind FROM materials WHERE id = ? AND matter_id = ?",
    )
    .get(input.materialId, matterId) as { kind: string } | undefined;
  if (!material) return { error: "没有这份材料。", status: 404 as const };
  if (material.kind !== "裁判文书") {
    return { error: "只有裁判文书可以记送达日和生效日。", status: 409 as const };
  }

  const decided = dateField(input.decidedOn, "裁判日期");
  if (!decided.ok) return { error: decided.error, status: decided.status };
  const served = dateField(input.servedOn, "送达日");
  if (!served.ok) return { error: served.error, status: served.status };
  const effective = dateField(input.effectiveOn, "生效日");
  if (!effective.ok) return { error: effective.error, status: effective.status };
  const result = input.result.trim();
  if (result.length > RESULT_MAX) return { error: "裁判结果太长。", status: 400 as const };
  if (!decided.value && !served.value && !effective.value && !result) {
    return { error: "请至少写下日期或裁判结果。", status: 400 as const };
  }
  const caseNumber = (input.caseNumber ?? "").trim();
  const courtName = (input.courtName ?? "").trim();
  if (caseNumber.length > 80) return { error: "案号太长。", status: 400 as const };
  if (courtName.length > 80) return { error: "法院名称太长。", status: 400 as const };

  const existing = db
    .prepare("SELECT id FROM rulings WHERE material_id = ?")
    .get(input.materialId) as { id: string } | undefined;
  const id = existing?.id ?? crypto.randomUUID();
  db.exec("BEGIN IMMEDIATE");
  try {
    if (existing) {
      db.prepare(
        `UPDATE rulings
         SET kind = ?, decided_on = ?, served_on = ?, effective_on = ?, result = ?
         WHERE id = ?`,
      ).run(input.kind, decided.value, served.value, effective.value, result, existing.id);
    } else {
      db.prepare(
        `INSERT INTO rulings (
           id, matter_id, material_id, kind, decided_on, served_on, effective_on, result, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        matterId,
        input.materialId,
        input.kind,
        decided.value,
        served.value,
        effective.value,
        result,
        new Date().toISOString().slice(0, 10),
      );
    }
    if (caseNumber) {
      db.prepare("UPDATE matters SET case_number = ? WHERE id = ?").run(caseNumber, matterId);
    }
    if (courtName) {
      db.prepare("UPDATE matters SET court_name = ? WHERE id = ?").run(courtName, matterId);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { id, status: existing ? (200 as const) : (201 as const) };
}

export async function readRulingDraft(matterId: string, materialId: string) {
  await connection();
  const material = getDb()
    .prepare(
      `SELECT kind, extracted_text AS extractedText
       FROM materials
       WHERE id = ? AND matter_id = ?`,
    )
    .get(materialId, matterId) as { kind: string; extractedText: string } | undefined;
  if (!material) return { error: "没有这份材料。", status: 404 as const };
  if (material.kind !== "裁判文书") {
    return { error: "只有裁判文书可以读取裁判。", status: 409 as const };
  }
  const text = material.extractedText.trim();
  if (!text) return { error: "请先读取这份材料。", status: 409 as const };

  const rules = readRuling(text);
  const model = await structureRuling(text);
  const iso = (value: string) => (isIsoDate(value) ? value : "");
  const kind = model && isRulingKind(model.kind) ? model.kind : rules.kind;
  const result = (model?.result || rules.result).slice(0, RESULT_MAX);
  return {
    kind,
    caseNumber: model?.caseNumber || rules.caseNumber,
    court: model?.court || rules.court,
    decidedOn: (model && iso(model.decidedOn)) || rules.decidedOn,
    servedOn: (model && iso(model.servedOn)) || rules.servedOn,
    effectiveOn: (model && iso(model.effectiveOn)) || rules.effectiveOn,
    result,
    status: 200 as const,
  };
}

export async function listRulings(matterId: string): Promise<RulingRecord[]> {
  await connection();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, material_id AS materialId, kind, decided_on AS decidedOn,
              served_on AS servedOn, effective_on AS effectiveOn, result
       FROM rulings
       WHERE matter_id = ?
       ORDER BY created_at`,
    )
    .all(matterId) as RulingRecord[];
  return rows
    .filter((row): row is RulingRecord & { kind: RulingKind } => isRulingKind(row.kind))
    .map((row) => ({
      id: row.id,
      materialId: row.materialId,
      kind: row.kind,
      decidedOn: row.decidedOn,
      servedOn: row.servedOn,
      effectiveOn: row.effectiveOn,
      result: row.result,
    }));
}
