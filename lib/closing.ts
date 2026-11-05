import { connection } from "next/server";

import { statementFromRulings } from "@/lib/closing-read";
import { OUTCOME_KINDS, type OutcomeKind } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { isIsoDate, todayISO } from "@/lib/figures";
import type { ClosingRecord, ClosingTaskResolution, DossierItem } from "@/lib/types";

function matterStatus(matterId: string) {
  return getDb().prepare("SELECT status FROM matters WHERE id = ?").get(matterId) as
    | { status: string }
    | undefined;
}

function validatedOutcome(input: { outcomeKind: unknown; outcomeOn: unknown; outcomeNote: unknown }) {
  const kind = input.outcomeKind;
  const date = input.outcomeOn;
  const note = typeof input.outcomeNote === "string" ? input.outcomeNote.trim() : "";
  if (!OUTCOME_KINDS.includes(kind as OutcomeKind) || typeof date !== "string" || !isIsoDate(date) || note.length < 8 || note.length > 2000) {
    return null;
  }
  return { kind: kind as OutcomeKind, date, note };
}

export async function getClosing(matterId: string) {
  await connection();
  const db = getDb();
  const record = db.prepare(
    `SELECT outcome_kind AS outcomeKind, outcome_on AS outcomeOn,
            outcome_note AS outcomeNote, statement,
            confirmed_at AS confirmedAt, archived_at AS archivedAt
     FROM closing_records WHERE matter_id = ?`,
  ).get(matterId) as ClosingRecord | undefined;
  const resolutions = db.prepare(
    `SELECT task_id AS taskId, result, note, resolved_at AS resolvedAt
     FROM closing_task_resolutions WHERE matter_id = ?`,
  ).all(matterId) as ClosingTaskResolution[];
  const dossier = db.prepare(
    `SELECT id, section, label, ref_id AS refId, position
     FROM dossier_items WHERE matter_id = ? ORDER BY position`,
  ).all(matterId) as DossierItem[];
  return {
    record: record ? { ...record } : null,
    resolutions: resolutions.map((item) => ({ ...item })),
    dossier: dossier.map((item) => ({ ...item })),
  };
}

export async function beginClosing(
  matterId: string,
  input: { outcomeKind: unknown; outcomeOn: unknown; outcomeNote: unknown },
) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (matter.status !== "办理中" && matter.status !== "结案中") {
    return { error: "只有办理中可以进入结案中。", status: 409 as const };
  }
  const outcome = validatedOutcome(input);
  if (!outcome) {
    return { error: "请选择办结结果、填写日期，并说明具体情况（至少 8 字）。", status: 400 as const };
  }
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db.prepare("SELECT 1 FROM closing_records WHERE matter_id = ?").get(matterId);
    if (existing) {
      if (matter.status !== "办理中") {
        db.exec("ROLLBACK");
        return { error: "本案已经进入结案流程。", status: 409 as const };
      }
      const changed = db
        .prepare("UPDATE matters SET status = '结案中' WHERE id = ? AND status = '办理中'")
        .run(matterId);
      if (changed.changes !== 1) {
        db.exec("ROLLBACK");
        return { error: "没有进入结案中。", status: 409 as const };
      }
      db.exec("COMMIT");
      return { id: matterId, status: 200 as const };
    }
    if (matter.status === "办理中") {
      const changed = db.prepare(
        "UPDATE matters SET status = '结案中' WHERE id = ? AND status = '办理中'",
      ).run(matterId);
      if (changed.changes !== 1) {
        db.exec("ROLLBACK");
        return { error: "没有进入结案中。", status: 409 as const };
      }
    }
    db.prepare(
      `INSERT INTO closing_records (matter_id, outcome_kind, outcome_on, outcome_note)
       VALUES (?, ?, ?, ?)`,
    ).run(matterId, outcome.kind, outcome.date, outcome.note);
    db.exec("COMMIT");
    return { id: matterId, status: 200 as const };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function updateClosingOutcome(
  matterId: string,
  input: { outcomeKind: unknown; outcomeOn: unknown; outcomeNote: unknown },
) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (matter.status !== "已结案") {
    return { error: "只有已结案且未归档时可以更正办结结果。", status: 409 as const };
  }
  const outcome = validatedOutcome(input);
  if (!outcome) {
    return { error: "请选择办结结果、填写日期，并说明具体情况（至少 8 字）。", status: 400 as const };
  }
  const changed = getDb().prepare(
    `UPDATE closing_records
     SET outcome_kind = ?, outcome_on = ?, outcome_note = ?, confirmed_at = ?
     WHERE matter_id = ? AND confirmed_at IS NOT NULL AND archived_at IS NULL`,
  ).run(outcome.kind, outcome.date, outcome.note, todayISO(), matterId);
  if (changed.changes !== 1) {
    return { error: "结案记录尚未确认，不能更正。", status: 409 as const };
  }
  return { id: matterId, status: 200 as const };
}

export async function resolveClosingTask(
  matterId: string,
  taskId: string,
  input: { result: unknown; note: unknown },
) {
  await connection();
  const result = input.result;
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if ((result !== "已完成" && result !== "不再适用") || note.length > 500 || (result === "不再适用" && !note)) {
    return { error: "请选择处理结果；不再适用时请写明原因。", status: 400 as const };
  }
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const matter = db.prepare("SELECT status FROM matters WHERE id = ?").get(matterId) as
      | { status: string }
      | undefined;
    if (!matter) {
      db.exec("ROLLBACK");
      return { error: "没有这件案子。", status: 404 as const };
    }
    if (matter.status !== "结案中" && matter.status !== "已结案") {
      db.exec("ROLLBACK");
      return { error: "只有结案中或已结案且未归档时可以处理待办。", status: 409 as const };
    }
    const task = db.prepare("SELECT id FROM tasks WHERE id = ? AND matter_id = ?").get(taskId, matterId);
    if (!task) {
      db.exec("ROLLBACK");
      return { error: "没有这条待办。", status: 404 as const };
    }
    db.prepare(
      `INSERT INTO closing_task_resolutions (task_id, matter_id, result, note, resolved_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(task_id) DO UPDATE SET result = excluded.result,
         note = excluded.note, resolved_at = excluded.resolved_at`,
    ).run(taskId, matterId, result, note, todayISO());
    if (matter.status === "已结案") {
      db.prepare("UPDATE closing_records SET confirmed_at = ? WHERE matter_id = ? AND archived_at IS NULL")
        .run(todayISO(), matterId);
    }
    db.exec("COMMIT");
    return { id: taskId, status: 200 as const };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function draftStatementFromRuling(matterId: string) {
  await connection();
  const matter = getDb()
    .prepare(
      `SELECT status, instance, case_number AS caseNumber, court_name AS courtName
       FROM matters WHERE id = ?`,
    )
    .get(matterId) as
    | { status: string; instance: string; caseNumber: string; courtName: string }
    | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (matter.status !== "结案中" && matter.status !== "已结案") {
    return { error: "结案说明在结案中填写。", status: 409 as const };
  }
  const rulings = getDb()
    .prepare(
      `SELECT materials.filename AS filename, rulings.kind AS kind,
              rulings.decided_on AS decidedOn, rulings.served_on AS servedOn,
              rulings.effective_on AS effectiveOn, rulings.result AS result,
              materials.extracted_text AS text
       FROM rulings
       JOIN materials ON materials.id = rulings.material_id
       WHERE rulings.matter_id = ?
       ORDER BY rulings.created_at`,
    )
    .all(matterId) as {
    filename: string;
    kind: string;
    decidedOn: string;
    servedOn: string;
    effectiveOn: string;
    result: string;
    text: string;
  }[];
  if (rulings.length === 0) {
    return {
      error: "本案还没有记下裁判。请先在材料里读取裁判文书并记下。",
      status: 409 as const,
    };
  }
  return {
    statement: statementFromRulings({
      instance: matter.instance,
      caseNumber: matter.caseNumber,
      courtName: matter.courtName,
      rulings,
    }),
    status: 200 as const,
  };
}

export async function saveClosingStatement(matterId: string, value: unknown) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (matter.status !== "结案中" && matter.status !== "已结案") {
    return { error: "只有结案中或已结案且未归档时可以修改结案说明。", status: 409 as const };
  }
  const statement = typeof value === "string" ? value.trim() : "";
  if (!statement || statement.length > 10000) {
    return { error: "请填写结案说明（不超过 10000 字）。", status: 400 as const };
  }
  const changed = matter.status === "已结案"
    ? getDb().prepare(
      `UPDATE closing_records SET statement = ?, confirmed_at = ?
       WHERE matter_id = ? AND confirmed_at IS NOT NULL AND archived_at IS NULL`,
    ).run(statement, todayISO(), matterId)
    : getDb().prepare(
      "UPDATE closing_records SET statement = ? WHERE matter_id = ? AND confirmed_at IS NULL",
    ).run(statement, matterId);
  if (changed.changes !== 1) {
    return { error: "请先记录办结结果。", status: 409 as const };
  }
  return { id: matterId, status: 200 as const };
}

export async function unarchiveMatter(matterId: string) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (matter.status !== "已归档") {
    return { error: "只有已归档的案件可以解档。", status: 409 as const };
  }
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const closing = db.prepare(
      "SELECT confirmed_at AS confirmedAt, archived_at AS archivedAt FROM closing_records WHERE matter_id = ?",
    ).get(matterId) as { confirmedAt: string | null; archivedAt: string | null } | undefined;
    if (!closing?.confirmedAt || !closing.archivedAt) {
      db.exec("ROLLBACK");
      return { error: "归档记录不完整，不能解档。", status: 409 as const };
    }
    const changed = db.prepare(
      "UPDATE matters SET status = '已结案' WHERE id = ? AND status = '已归档'",
    ).run(matterId);
    if (changed.changes !== 1) {
      db.exec("ROLLBACK");
      return { error: "没有解档。", status: 409 as const };
    }
    db.prepare("UPDATE closing_records SET archived_at = NULL WHERE matter_id = ?").run(matterId);
    db.prepare("DELETE FROM dossier_items WHERE matter_id = ?").run(matterId);
    db.exec("COMMIT");
    return { id: matterId, status: 200 as const };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function confirmClosing(matterId: string) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (matter.status !== "结案中") {
    return { error: "只有结案中可以确认结案。", status: 409 as const };
  }
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const record = db.prepare(
      "SELECT statement FROM closing_records WHERE matter_id = ?",
    ).get(matterId) as { statement: string } | undefined;
    if (!record?.statement.trim()) {
      db.exec("ROLLBACK");
      return { error: "请先写好结案说明。", status: 409 as const };
    }
    const pending = db.prepare(
      `SELECT COUNT(*) AS n FROM tasks t
       LEFT JOIN closing_task_resolutions r ON r.task_id = t.id
       WHERE t.matter_id = ? AND r.task_id IS NULL`,
    ).get(matterId) as { n: number };
    if (pending.n > 0) {
      db.exec("ROLLBACK");
      return { error: `还有 ${pending.n} 条待办没有处理。`, status: 409 as const };
    }
    const changed = db.prepare(
      "UPDATE matters SET status = '已结案' WHERE id = ? AND status = '结案中'",
    ).run(matterId);
    if (changed.changes !== 1) {
      db.exec("ROLLBACK");
      return { error: "没有确认结案。", status: 409 as const };
    }
    db.prepare("UPDATE closing_records SET confirmed_at = ? WHERE matter_id = ?")
      .run(todayISO(), matterId);
    db.exec("COMMIT");
    return { id: matterId, status: 200 as const };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function archiveMatter(matterId: string) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (matter.status !== "已结案") {
    return { error: "只有已结案可以归档。", status: 409 as const };
  }
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const closing = db.prepare(
      "SELECT confirmed_at AS confirmedAt FROM closing_records WHERE matter_id = ?",
    ).get(matterId) as { confirmedAt: string | null } | undefined;
    if (!closing?.confirmedAt) {
      db.exec("ROLLBACK");
      return { error: "结案说明还没有确认，不能归档。", status: 409 as const };
    }
    const items: Array<{ section: string; label: string; refId: string | null }> = [];
    const collect = (section: string, sql: string) => {
      const rows = db.prepare(sql).all(matterId) as Array<{ id: string; label: string }>;
      rows.forEach((row) => items.push({ section, label: row.label, refId: row.id }));
    };
    collect("材料", "SELECT id, filename AS label FROM materials WHERE matter_id = ? ORDER BY created_at, id");
    collect("检索出处", "SELECT id, title AS label FROM sources WHERE matter_id = ? ORDER BY accepted_at, id");
    collect("文书版本", "SELECT id, kind || ' 第 ' || version || ' 版' || CASE WHEN final = 1 THEN ' · 律师定稿' ELSE '' END AS label FROM drafts WHERE matter_id = ? ORDER BY version");
    collect("待办", "SELECT id, kind || ' · ' || due_on AS label FROM tasks WHERE matter_id = ? ORDER BY due_on, id");
    items.push({ section: "结案", label: "结案说明", refId: null });
    db.prepare("DELETE FROM dossier_items WHERE matter_id = ?").run(matterId);
    const insert = db.prepare(
      "INSERT INTO dossier_items (id, matter_id, section, label, ref_id, position) VALUES (?, ?, ?, ?, ?, ?)",
    );
    items.forEach((item, index) => insert.run(crypto.randomUUID(), matterId, item.section, item.label, item.refId, index));
    const changed = db.prepare(
      "UPDATE matters SET status = '已归档' WHERE id = ? AND status = '已结案'",
    ).run(matterId);
    if (changed.changes !== 1) {
      db.exec("ROLLBACK");
      return { error: "没有归档。", status: 409 as const };
    }
    db.prepare("UPDATE closing_records SET archived_at = ? WHERE matter_id = ?")
      .run(todayISO(), matterId);
    db.exec("COMMIT");
    return { id: matterId, count: items.length, status: 200 as const };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
