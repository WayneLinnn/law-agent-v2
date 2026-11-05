import { connection } from "next/server";

import { ELEMENTS_UNCONFIRMED, TERMINATED_NOTE, isElementKind } from "@/lib/constants";
import { readElements, type ElementDraft } from "@/lib/element-read";
import { todayISO } from "@/lib/figures";
import { getDb } from "@/lib/db";
import { structureElements } from "@/lib/model";

const BODY_MAX = 800;

function matterStatus(id: string) {
  return getDb()
    .prepare("SELECT status, facts, mandate FROM matters WHERE id = ?")
    .get(id) as
    | { status: string; facts: string; mandate: string }
    | undefined;
}

function handlingStop(status: string, idle: string) {
  if (status === "已终止") return { error: TERMINATED_NOTE, status: 409 as const };
  if (status !== "办理中") return { error: idle, status: 409 as const };
  return null;
}

type MaterialRow = {
  id: string;
  filename: string;
  extractedText: string;
};

async function proposeElements(
  facts: string,
  mandate: string,
  materials: MaterialRow[],
) {
  const packet = [
    facts.trim() ? `基本事实：${facts.trim()}` : "",
    mandate.trim() ? `委托事项：${mandate.trim()}` : "",
    ...materials.map(
      (material) =>
        `材料 ${material.filename}\n${material.extractedText.slice(0, 3000)}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
  const model = packet ? await structureElements(packet) : null;
  const fromModel: ElementDraft[] = [];
  for (const item of model ?? []) {
    if (!isElementKind(item.kind) || !item.body) continue;
    const material = materials.find(
      (row) => row.filename === item.sourceLabel || item.sourceLabel.includes(row.filename),
    );
    fromModel.push({
      kind: item.kind,
      body: item.body.slice(0, BODY_MAX),
      sourceLabel: material?.filename || item.sourceLabel || "本案",
      sourceMaterialId: material?.id ?? null,
    });
  }
  if (fromModel.length > 0) return fromModel;
  return readElements({ facts, mandate, materials });
}

function nextPosition(matterId: string) {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(MAX(position), -1) AS maxPos FROM elements WHERE matter_id = ?`,
    )
    .get(matterId) as { maxPos: number };
  return row.maxPos + 1;
}

export async function extractElements(matterId: string) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = handlingStop(matter.status, "要素在办理中抽出。");
  if (stop) return stop;

  const db = getDb();
  const materials = db
    .prepare(
      `SELECT id, filename, extracted_text AS extractedText
       FROM materials
       WHERE matter_id = ?
       ORDER BY created_at`,
    )
    .all(matterId) as MaterialRow[];
  const drafts = await proposeElements(matter.facts, matter.mandate, materials);
  if (drafts.length === 0) {
    return { error: "材料里没有读出要素。", status: 400 as const };
  }

  const locked = db
    .prepare(
      `SELECT kind, body, source_label AS sourceLabel
       FROM elements
       WHERE matter_id = ? AND confirmed_at IS NOT NULL`,
    )
    .all(matterId) as { kind: string; body: string; sourceLabel: string }[];
  const seen = new Set<string>();
  const fresh = drafts.filter((draft) => {
    const key = `${draft.kind}\n${draft.body}\n${draft.sourceLabel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return !locked.some(
      (row) =>
        row.kind === draft.kind &&
        row.body === draft.body &&
        row.sourceLabel === draft.sourceLabel,
    );
  });
  if (fresh.length === 0 && locked.length > 0) {
    return { error: "没有读出新的要素。已经确认的还留着。", status: 409 as const };
  }
  if (fresh.length === 0) {
    return { error: "材料里没有读出要素。", status: 400 as const };
  }

  const createdAt = todayISO();
  const insert = db.prepare(
    `INSERT INTO elements (
       id, matter_id, kind, body, source_label, source_material_id,
       position, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ids: string[] = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `DELETE FROM elements WHERE matter_id = ? AND confirmed_at IS NULL`,
    ).run(matterId);
    let position = nextPosition(matterId);
    for (const draft of fresh) {
      const id = crypto.randomUUID();
      insert.run(
        id,
        matterId,
        draft.kind,
        draft.body,
        draft.sourceLabel,
        draft.sourceMaterialId,
        position,
        createdAt,
      );
      position += 1;
      ids.push(id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ids, status: 201 as const };
}

export async function addHandElement(
  matterId: string,
  input: { kind: string; body: string },
) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = handlingStop(matter.status, "要素在办理中抽出。");
  if (stop) return stop;
  if (!isElementKind(input.kind)) {
    return { error: "请选择请求、事实、金额或日期。", status: 400 as const };
  }
  const body = input.body.trim();
  if (!body) return { error: "请写下这一条要素。", status: 400 as const };
  if (body.length > BODY_MAX) return { error: "这一条写得太长。", status: 400 as const };

  const id = crypto.randomUUID();
  getDb()
    .prepare(
      `INSERT INTO elements (
         id, matter_id, kind, body, source_label, source_material_id,
         position, created_at
       ) VALUES (?, ?, ?, ?, '律师手写', NULL, ?, ?)`,
    )
    .run(id, matterId, input.kind, body, nextPosition(matterId), todayISO());
  return { id, status: 201 as const };
}

export async function confirmElements(
  matterId: string,
  items: { id: string; body: string }[],
) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = handlingStop(matter.status, "要素在办理中抽出。");
  if (stop) return stop;

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, confirmed_at AS confirmedAt
       FROM elements
       WHERE matter_id = ?
       ORDER BY position`,
    )
    .all(matterId) as { id: string; confirmedAt: string | null }[];
  const open = rows.filter((row) => !row.confirmedAt);
  if (rows.length === 0) {
    return { error: "还没有抽出要素。", status: 409 as const };
  }
  if (open.length === 0) {
    return { error: "要素已经确认。", status: 409 as const };
  }
  const sent = new Set(items.map((item) => item.id));
  if (sent.size !== open.length || open.some((row) => !sent.has(row.id))) {
    return { error: "请确认还没确认的要素。", status: 409 as const };
  }
  for (const item of items) {
    const body = item.body.trim();
    if (!body) return { error: "请填写要素。", status: 400 as const };
    if (body.length > BODY_MAX) {
      return { error: "这一条写得太长。", status: 400 as const };
    }
  }

  const confirmedAt = todayISO();
  const update = db.prepare(
    `UPDATE elements
     SET body = ?, confirmed_at = ?
     WHERE id = ? AND matter_id = ? AND confirmed_at IS NULL`,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const item of items) {
      const result = update.run(item.body.trim(), confirmedAt, item.id, matterId);
      if (result.changes !== 1) {
        db.exec("ROLLBACK");
        return { error: "没有确认要素。", status: 409 as const };
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { confirmedAt, status: 200 as const };
}

export async function focusGate(matterId: string) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = handlingStop(matter.status, "定焦点在办理中进行。");
  if (stop) return stop;

  const rows = getDb()
    .prepare(
      `SELECT confirmed_at AS confirmedAt
       FROM elements
       WHERE matter_id = ?`,
    )
    .all(matterId) as { confirmedAt: string | null }[];
  const ready = rows.length > 0 && rows.every((row) => row.confirmedAt);
  if (!ready) return { error: ELEMENTS_UNCONFIRMED, status: 409 as const };
  return { ready: true, status: 200 as const };
}
