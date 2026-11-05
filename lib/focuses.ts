import { connection } from "next/server";

import {
  ELEMENTS_UNCONFIRMED,
  FOCUS_UNCONFIRMED,
  TERMINATED_NOTE,
} from "@/lib/constants";
import { todayISO } from "@/lib/figures";
import { getDb } from "@/lib/db";
import { structureFocuses } from "@/lib/model";

const BODY_MAX = 400;
const LAW_QUERY_MAX = 200;

function matterStatus(id: string) {
  return getDb().prepare("SELECT status FROM matters WHERE id = ?").get(id) as
    | { status: string }
    | undefined;
}

function handlingStop(status: string, idle: string) {
  if (status === "已终止") return { error: TERMINATED_NOTE, status: 409 as const };
  if (status !== "办理中") return { error: idle, status: 409 as const };
  return null;
}

function elementsReady(matterId: string) {
  const rows = getDb()
    .prepare(
      `SELECT confirmed_at AS confirmedAt
       FROM elements
       WHERE matter_id = ?`,
    )
    .all(matterId) as { confirmedAt: string | null }[];
  return rows.length > 0 && rows.every((row) => row.confirmedAt);
}

function normalize(items: { body: string; lawQuery: string }[]) {
  if (items.length === 0) return { error: "请写下争议焦点。", status: 400 as const };
  const bodies = items.map((item) => item.body.trim());
  const queries = items.map((item) => item.lawQuery.trim());
  if (bodies.some((body) => !body)) {
    return { error: "请写下争议焦点。", status: 400 as const };
  }
  if (queries.some((query) => !query)) {
    return { error: "请写下法条检索句。", status: 400 as const };
  }
  if (bodies.some((body) => body.length > BODY_MAX)) {
    return { error: "这一条写得太长。", status: 400 as const };
  }
  if (queries.some((query) => query.length > LAW_QUERY_MAX)) {
    return { error: "法条检索句写得太长。", status: 400 as const };
  }
  if (new Set(bodies).size !== bodies.length) {
    return { error: "这两条焦点写得一样。", status: 400 as const };
  }
  return { bodies, queries, status: 200 as const };
}

export async function listFocuses(
  matterId: string,
  items: { id?: string; body: string; lawQuery: string }[],
) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = handlingStop(matter.status, "焦点在办理中列出。");
  if (stop) return stop;
  if (!elementsReady(matterId)) {
    return { error: ELEMENTS_UNCONFIRMED, status: 409 as const };
  }

  const normalized = normalize(items);
  if (normalized.status !== 200) return normalized;

  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id, body, confirmed_at AS confirmedAt
       FROM focuses
       WHERE matter_id = ?`,
    )
    .all(matterId) as { id: string; body: string; confirmedAt: string | null }[];
  const byId = new Map(existing.map((row) => [row.id, row]));
  const payloadIds = items.map((item) => item.id).filter((id): id is string => Boolean(id));
  const kept = existing.filter(
    (row) => row.confirmedAt && !payloadIds.includes(row.id),
  );
  const bodies = [...kept.map((row) => row.body), ...normalized.bodies];
  if (new Set(bodies).size !== bodies.length) {
    return { error: "这两条焦点写得一样。", status: 400 as const };
  }

  const createdAt = todayISO();
  const insert = db.prepare(
    `INSERT INTO focuses (id, matter_id, body, law_query, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const update = db.prepare(
    `UPDATE focuses SET body = ?, law_query = ?, position = ? WHERE id = ? AND matter_id = ?`,
  );
  const ids: string[] = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    const keepIds = payloadIds.filter((id) => byId.has(id));
    if (keepIds.length === 0) {
      db.prepare(
        `DELETE FROM focuses WHERE matter_id = ? AND confirmed_at IS NULL`,
      ).run(matterId);
    } else {
      db.prepare(
        `DELETE FROM focuses
         WHERE matter_id = ? AND confirmed_at IS NULL AND id NOT IN (${keepIds.map(() => "?").join(", ")})`,
      ).run(matterId, ...keepIds);
    }
    normalized.bodies.forEach((body, position) => {
      const id = items[position]?.id;
      const query = normalized.queries[position];
      const row = id ? byId.get(id) : undefined;
      if (row) {
        update.run(body, query, position, row.id, matterId);
        ids.push(row.id);
        return;
      }
      const created = crypto.randomUUID();
      insert.run(created, matterId, body, query, position, createdAt);
      ids.push(created);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ids, status: 201 as const };
}

export async function confirmFocuses(
  matterId: string,
  items: { id: string; body: string; lawQuery: string }[],
) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = handlingStop(matter.status, "焦点在办理中列出。");
  if (stop) return stop;
  if (!elementsReady(matterId)) {
    return { error: ELEMENTS_UNCONFIRMED, status: 409 as const };
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, body, confirmed_at AS confirmedAt
       FROM focuses
       WHERE matter_id = ?
       ORDER BY position`,
    )
    .all(matterId) as { id: string; body: string; confirmedAt: string | null }[];
  const open = rows.filter((row) => !row.confirmedAt);
  if (rows.length === 0) {
    return { error: "先列出争议焦点。", status: 409 as const };
  }
  if (open.length === 0) {
    return { error: "焦点已经确认。", status: 409 as const };
  }
  const sent = new Set(items.map((item) => item.id));
  if (sent.size !== open.length || open.some((row) => !sent.has(row.id))) {
    return { error: "请确认新加的焦点。", status: 409 as const };
  }
  const normalized = normalize(items);
  if (normalized.status !== 200) return normalized;
  const confirmedBodies = rows
    .filter((row) => row.confirmedAt)
    .map((row) => row.body);
  const combined = [...confirmedBodies, ...normalized.bodies];
  if (new Set(combined).size !== combined.length) {
    return { error: "这两条焦点写得一样。", status: 400 as const };
  }

  const confirmedAt = todayISO();
  const update = db.prepare(
    `UPDATE focuses
     SET body = ?, law_query = ?, confirmed_at = ?
     WHERE id = ? AND matter_id = ? AND confirmed_at IS NULL`,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    items.forEach((item, index) => {
      const result = update.run(
        normalized.bodies[index],
        normalized.queries[index],
        confirmedAt,
        item.id,
        matterId,
      );
      if (result.changes !== 1) {
        db.exec("ROLLBACK");
        throw new Error("confirm focus missed a row");
      }
    });
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The missed-row path already rolled back.
    }
    if (error instanceof Error && error.message === "confirm focus missed a row") {
      return { error: "没有确认焦点。", status: 409 as const };
    }
    throw error;
  }
  return { confirmedAt, status: 200 as const };
}

export async function deleteFocus(matterId: string, focusId: string) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = handlingStop(matter.status, "焦点在办理中删除。");
  if (stop) return stop;
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM focuses WHERE id = ? AND matter_id = ?")
    .get(focusId, matterId) as { id: string } | undefined;
  if (!row) return { error: "没有这条焦点。", status: 404 as const };
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM sources WHERE focus_id = ? AND matter_id = ?").run(focusId, matterId);
    const removed = db
      .prepare("DELETE FROM focuses WHERE id = ? AND matter_id = ?")
      .run(focusId, matterId);
    if (removed.changes !== 1) {
      db.exec("ROLLBACK");
      return { error: "没有删掉这条焦点。", status: 409 as const };
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { id: focusId, status: 200 as const };
}

export async function researchGate(matterId: string) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = handlingStop(matter.status, "检索和起草在办理中进行。");
  if (stop) return stop;

  const rows = getDb()
    .prepare(
      `SELECT confirmed_at AS confirmedAt
       FROM focuses
       WHERE matter_id = ?`,
    )
    .all(matterId) as { confirmedAt: string | null }[];
  const ready = rows.some((row) => row.confirmedAt);
  if (!ready) return { error: FOCUS_UNCONFIRMED, status: 409 as const };
  return { ready: true, status: 200 as const };
}

export async function proposeFocuses(matterId: string) {
  await connection();
  const matter = getDb()
    .prepare("SELECT status, cause, facts, mandate FROM matters WHERE id = ?")
    .get(matterId) as
    | { status: string; cause: string; facts: string; mandate: string }
    | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = handlingStop(matter.status, "焦点在办理中列出。");
  if (stop) return stop;
  if (!elementsReady(matterId)) {
    return { error: ELEMENTS_UNCONFIRMED, status: 409 as const };
  }

  const db = getDb();
  const elements = db
    .prepare(
      `SELECT kind, body FROM elements
       WHERE matter_id = ? AND confirmed_at IS NOT NULL
       ORDER BY position`,
    )
    .all(matterId) as { kind: string; body: string }[];
  const materials = db
    .prepare(
      `SELECT filename, extracted_text AS extractedText
       FROM materials
       WHERE matter_id = ? AND trim(extracted_text) != ''
       ORDER BY created_at`,
    )
    .all(matterId) as { filename: string; extractedText: string }[];
  const packet = [
    matter.cause ? `案由：${matter.cause}` : "",
    matter.facts.trim() ? `基本事实：${matter.facts.trim()}` : "",
    matter.mandate.trim() ? `委托事项：${matter.mandate.trim()}` : "",
    ...elements.map((element) => `要素 ${element.kind}：${element.body}`),
    ...materials.map(
      (material) => `材料 ${material.filename}\n${material.extractedText.slice(0, 2500)}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
  const proposed = packet ? await structureFocuses(packet) : null;
  const peripheral = /诉讼费|受理费|律师费|鉴定费|保全费|执行费/;
  const drafts = (proposed ?? [])
    .map((item) => ({
      body: item.body.slice(0, BODY_MAX),
      lawQuery: item.lawQuery.slice(0, LAW_QUERY_MAX),
    }))
    .filter((item) => item.body && item.lawQuery)
    .filter((item) => !peripheral.test(`${item.body}${item.lawQuery}`))
    .slice(0, 3);
  if (drafts.length === 0) {
    return {
      error: "没有归纳出焦点。请手写争议焦点和法条检索句。",
      status: 400 as const,
    };
  }

  const existing = db
    .prepare("SELECT body FROM focuses WHERE matter_id = ?")
    .all(matterId) as { body: string }[];
  const seen = new Set(existing.map((row) => row.body));
  const fresh = drafts.filter((item) => {
    if (seen.has(item.body)) return false;
    seen.add(item.body);
    return true;
  });
  if (fresh.length === 0) {
    return { error: "归纳出的焦点已经在列表里。", status: 409 as const };
  }

  const positionRow = db
    .prepare("SELECT COALESCE(MAX(position), -1) AS maxPos FROM focuses WHERE matter_id = ?")
    .get(matterId) as { maxPos: number };
  const createdAt = todayISO();
  const insert = db.prepare(
    `INSERT INTO focuses (id, matter_id, body, law_query, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const ids: string[] = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    fresh.forEach((item, index) => {
      const id = crypto.randomUUID();
      insert.run(id, matterId, item.body, item.lawQuery, positionRow.maxPos + 1 + index, createdAt);
      ids.push(id);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ids, status: 201 as const };
}
