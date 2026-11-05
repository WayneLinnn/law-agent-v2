import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { connection } from "next/server";
import { categoryFromCause } from "@/lib/causes";
import {
  canMoveStatus,
  canTerminate,
  DELETE_HOLD_DAYS,
  isCaseCategory,
  isElementKind,
  isMaterialKind,
  isMatterStatus,
  isPartyRole,
  partyLabel,
  isTaskKind,
  TERMINATED_NOTE,
  type PartyRole,
} from "@/lib/constants";
import { getDb, materialFilePath, removeMatterFiles } from "@/lib/db";
import { textFromFile } from "@/lib/file-text";
import { fileKindError, MAX_FILE_BYTES } from "@/lib/file-kinds";
import { parseAmount, plusDays, todayISO } from "@/lib/figures";
import type {
  MaterialRecord,
  ElementRecord,
  FocusRecord,
  MatterDetail,
  MatterRecord,
  MatterSummary,
  PartyRecord,
  TaskRecord,
} from "@/lib/types";

const matterColumns = `id, name, status, cause, facts, mandate, claim_amount AS claimAmount, fee_receivable AS feeReceivable, fee_received AS feeReceived, limitation_start AS limitationStart, case_number AS caseNumber, category, engaged_on AS engagedOn, instance, procedure, parent_matter_id AS parentMatterId, court_name AS courtName, created_at AS createdAt, deleted_on AS deletedOn`;

type MatterRow = {
  id: string;
  name: string;
  status: string;
  cause: string;
  facts: string;
  mandate: string;
  claimAmount: number | null;
  feeReceivable: number | null;
  feeReceived: number | null;
  limitationStart: string | null;
  caseNumber: string;
  category: string;
  engagedOn: string;
  instance: string;
  procedure: string;
  parentMatterId: string | null;
  courtName: string;
  createdAt: string;
  deletedOn: string;
};

type PartyRow = {
  id: string;
  role: string;
  name: string;
  position: string;
  idNumber: string;
  clientId: string | null;
  matterId: string;
};

type MaterialRow = {
  id: string;
  filename: string;
  extractedText: string;
  kind: string;
  proves: string;
  submittedBy: string | null;
  createdAt: string;
};

type FocusRow = {
  id: string;
  body: string;
  lawQuery: string;
  confirmedAt: string | null;
};

type ElementRow = {
  id: string;
  kind: string;
  body: string;
  sourceLabel: string;
  sourceMaterialId: string | null;
  confirmedAt: string | null;
};

type TaskRow = {
  id: string;
  kind: string;
  customName: string;
  dueOn: string;
  dueTime: string;
  place: string;
  repeat: string;
  repeatUntil: string;
  endOn: string | null;
  startOn: string | null;
  variant: string;
  basisNote: string;
  note: string;
  confirmedAt: string | null;
};

function toMatter(row: MatterRow): MatterRecord {
  if (!isMatterStatus(row.status)) {
    throw new Error(`未知的案件状态：${row.status}`);
  }
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    cause: row.cause,
    facts: row.facts,
    mandate: row.mandate,
    claimAmount: row.claimAmount,
    feeReceivable: row.feeReceivable,
    feeReceived: row.feeReceived,
    limitationStart: row.limitationStart,
    caseNumber: row.caseNumber,
    category: row.category,
    engagedOn: row.engagedOn,
    instance: row.instance,
    procedure: row.procedure,
    parentMatterId: row.parentMatterId,
    courtName: row.courtName,
    createdAt: row.createdAt,
    deletedOn: row.deletedOn,
  };
}

function toParty(row: PartyRow): PartyRecord | null {
  if (!isPartyRole(row.role)) return null;
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    position: row.position,
    idNumber: row.idNumber,
    clientId: row.clientId,
  };
}

export function groupParties(
  parties: Pick<PartyRecord, "role" | "name" | "position">[],
): Record<PartyRole, string[]> {
  const grouped: Record<PartyRole, string[]> = {
    client: [],
    ally: [],
    opposing: [],
    court: [],
  };
  for (const party of parties) grouped[party.role].push(partyLabel(party));
  return grouped;
}

export const listMatters = cache(async (): Promise<MatterSummary[]> => {
  await connection();
  const db = getDb();
  const matters = db
    .prepare(
      `SELECT ${matterColumns}
       FROM matters
       ORDER BY created_at DESC`,
    )
    .all() as MatterRow[];
  const parties = db
    .prepare(
      `SELECT id, matter_id AS matterId, role, name, position, id_number AS idNumber, client_id AS clientId
       FROM parties
       ORDER BY name`,
    )
    .all() as PartyRow[];

  return matters.map((row) => {
    const matterParties = parties
      .filter((party) => party.matterId === row.id)
      .map(toParty)
      .filter((party): party is PartyRecord => party !== null);
    return { ...toMatter(row), parties: groupParties(matterParties) };
  });
});

export const getMatter = cache(
  async (id: string): Promise<MatterDetail | null> => {
    await connection();
    const db = getDb();
    const row = db
      .prepare(
        `SELECT ${matterColumns}
         FROM matters
         WHERE id = ?`,
      )
      .get(id) as MatterRow | undefined;
    if (!row) return null;

    const parties = (
      db
        .prepare(
          `SELECT id, matter_id AS matterId, role, name, position, id_number AS idNumber, client_id AS clientId
           FROM parties
           WHERE matter_id = ?
           ORDER BY name`,
        )
        .all(id) as PartyRow[]
    )
      .map(toParty)
      .filter((party): party is PartyRecord => party !== null);

    const materials = (
      db
        .prepare(
          `SELECT id, filename, extracted_text AS extractedText, kind, proves, submitted_by AS submittedBy, created_at AS createdAt
           FROM materials
           WHERE matter_id = ?
           ORDER BY created_at`,
        )
        .all(id) as MaterialRow[]
    ).map(
      (material): MaterialRecord => ({
        id: material.id,
        filename: material.filename,
        extractedText: material.extractedText,
        kind: isMaterialKind(material.kind) ? material.kind : "往来文书",
        proves: material.proves,
        submittedBy: material.submittedBy,
        createdAt: material.createdAt,
      }),
    );

    const tasks = (
      db
        .prepare(
          `SELECT id, kind, custom_name AS customName, due_on AS dueOn,
                  due_time AS dueTime, place, repeat, repeat_until AS repeatUntil,
                  end_on AS endOn, start_on AS startOn, variant,
                  basis_note AS basisNote, note, confirmed_at AS confirmedAt
           FROM tasks
           WHERE matter_id = ?
           ORDER BY due_on, created_at`,
        )
        .all(id) as TaskRow[]
    )
      .map((task): TaskRecord | null => {
        if (!isTaskKind(task.kind)) return null;
        return {
          id: task.id,
          kind: task.kind,
          customName: task.customName,
          dueOn: task.dueOn,
          dueTime: task.dueTime,
          place: task.place,
          repeat: task.repeat,
          repeatUntil: task.repeatUntil,
          endOn: task.endOn,
          startOn: task.startOn,
          variant: task.variant,
          basisNote: task.basisNote,
          note: task.note,
          confirmedAt: task.confirmedAt,
        };
      })
      .filter((task): task is TaskRecord => task !== null);

    const elements = (
      db
        .prepare(
          `SELECT id, kind, body, source_label AS sourceLabel,
                  source_material_id AS sourceMaterialId,
                  confirmed_at AS confirmedAt
           FROM elements
           WHERE matter_id = ?
           ORDER BY position`,
        )
        .all(id) as ElementRow[]
    )
      .map((element): ElementRecord | null => {
        if (!isElementKind(element.kind)) return null;
        return {
          id: element.id,
          kind: element.kind,
          body: element.body,
          sourceLabel: element.sourceLabel,
          sourceMaterialId: element.sourceMaterialId,
          confirmedAt: element.confirmedAt,
        };
      })
      .filter((element): element is ElementRecord => element !== null);

    const focuses = db
      .prepare(
        `SELECT id, body, law_query AS lawQuery, confirmed_at AS confirmedAt
         FROM focuses
         WHERE matter_id = ?
         ORDER BY position`,
      )
      .all(id) as FocusRow[];

    return {
      matter: toMatter(row),
      parties,
      materials,
      tasks,
      elements,
      focuses: focuses.map(
        (focus): FocusRecord => ({
          id: focus.id,
          body: focus.body,
          lawQuery: focus.lawQuery,
          confirmedAt: focus.confirmedAt,
        }),
      ),
    };
  },
);

export type DraftInput = {
  name: string;
  clientName: string;
  opposingName: string;
  courtName: string;
  cause: string;
  facts: string;
  mandate: string;
  category?: string;
  feeReceivable?: string;
};

function textField(value: string) {
  return value.trim();
}

export async function createDraft(input: DraftInput) {
  await connection();
  const name = textField(input.name);
  const clientName = textField(input.clientName);
  const opposingName = textField(input.opposingName);
  const courtName = textField(input.courtName);
  const cause = textField(input.cause);
  const facts = textField(input.facts);
  const mandate = textField(input.mandate);
  const chosen = textField(input.category ?? "");
  const category = isCaseCategory(chosen) ? chosen : categoryFromCause(cause);
  const feeText = textField(input.feeReceivable ?? "");
  let feeReceivable: number | null = null;
  if (feeText) {
    const fee = parseAmount(feeText);
    if (fee === null) return { error: "请填写应收金额。" };
    feeReceivable = fee;
  }
  const required = [name, clientName, opposingName, cause, facts, mandate];
  if (required.some((field) => field.length === 0)) {
    return {
      error: "请填写案件名称、客户、对方、案由、基本事实和委托事项。",
    };
  }
  if ([...required, courtName].some((field) => field.length > 4000)) {
    return { error: "某一项写得太长。" };
  }

  const db = getDb();
  const matterId = crypto.randomUUID();
  const createdAt = new Date().toISOString().slice(0, 10);
  db.exec("BEGIN IMMEDIATE");
  try {
    const existingClient = db
      .prepare("SELECT id FROM clients WHERE name = ?")
      .get(clientName) as { id: string } | undefined;
    const clientId = existingClient?.id ?? crypto.randomUUID();
    if (!existingClient) {
      db.prepare("INSERT INTO clients (id, name) VALUES (?, ?)").run(
        clientId,
        clientName,
      );
    }
    db.prepare(
      `INSERT INTO matters (
         id, name, status, cause, facts, mandate, created_at, court_name, category, fee_receivable
       ) VALUES (?, ?, '草稿', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      matterId,
      name,
      cause,
      facts,
      mandate,
      createdAt,
      courtName,
      category,
      feeReceivable,
    );
    const insertParty = db.prepare(
      `INSERT INTO parties (id, matter_id, role, name, client_id)
       VALUES (?, ?, ?, ?, ?)`,
    );
    insertParty.run(crypto.randomUUID(), matterId, "client", clientName, clientId);
    insertParty.run(
      crypto.randomUUID(),
      matterId,
      "opposing",
      opposingName,
      null,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { id: matterId };
}

export async function confirmFiling(id: string) {
  await connection();
  const db = getDb();
  const row = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(id) as { status: string } | undefined;
  if (!row) return { error: "没有这件案子。", status: 404 };
  if (row.status !== "草稿") {
    return { error: "只有草稿可以确认建档。", status: 409 };
  }
  const result = db
    .prepare(
      `UPDATE matters SET status = '待立案' WHERE id = ? AND status = '草稿'`,
    )
    .run(id);
  if (result.changes !== 1) {
    return { error: "没有确认建档。", status: 409 };
  }
  return { id, status: 200 as const };
}

const MATERIAL_STATUSES = new Set(["草稿", "待立案", "办理中"]);

function safeFilename(name: string) {
  const base = path
    .basename(name)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim();
  return base;
}

export async function addMaterial(
  matterId: string,
  file: File,
  meta: { kind?: string; proves?: string; submittedBy?: string; extract?: boolean } = {},
) {
  await connection();
  if (!/^[\w-]+$/.test(matterId)) {
    return { error: "没有这件案子。", status: 404 as const };
  }
  const db = getDb();
  const matter = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(matterId) as { status: string } | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (!MATERIAL_STATUSES.has(matter.status)) {
    return { error: "这件案子现在不能放入材料。", status: 409 as const };
  }

  const filename = safeFilename(file.name);
  if (!filename || fileKindError(filename)) {
    return {
      error: fileKindError(filename) ?? "请放入一份材料。",
      status: 400 as const,
    };
  }
  if (filename.length > 120) {
    return { error: "文件名太长。", status: 400 as const };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return { error: "这份材料是空的。", status: 400 as const };
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { error: "这份材料太大。", status: 400 as const };
  }

  let extractedText = "";
  if (meta.extract) {
    const read = await textFromFile(filename, bytes);
    if ("error" in read && read.error) {
      return { error: read.error, status: read.status ?? 400 };
    }
    if ("text" in read && read.text) extractedText = read.text;
  }

  const duplicate = db
    .prepare(
      `SELECT id FROM materials WHERE matter_id = ? AND filename = ?`,
    )
    .get(matterId, filename) as { id: string } | undefined;
  if (duplicate) {
    return { error: "本案已经有同名材料。", status: 409 as const };
  }

  const kind = meta.kind?.trim() || "往来文书";
  if (!isMaterialKind(kind)) {
    return { error: "材料种类不对。", status: 400 as const };
  }
  const proves = kind === "证据" ? (meta.proves?.trim() ?? "").slice(0, 200) : "";
  let submittedBy: string | null = null;
  if (kind === "证据" && meta.submittedBy?.trim()) {
    const party = db
      .prepare("SELECT id FROM parties WHERE id = ? AND matter_id = ?")
      .get(meta.submittedBy.trim(), matterId) as { id: string } | undefined;
    if (!party) return { error: "这份证据没有对应的当事人。", status: 400 as const };
    submittedBy = party.id;
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString().slice(0, 10);
  const full = materialFilePath(matterId, filename);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  try {
    fs.writeFileSync(full, bytes, { flag: "wx" });
  } catch {
    return { error: "这份材料没有放进去。", status: 409 as const };
  }

  try {
    db.prepare(
      `INSERT INTO materials (id, matter_id, filename, extracted_text, kind, proves, submitted_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, matterId, filename, extractedText, kind, proves, submittedBy, createdAt);
  } catch (error) {
    fs.rmSync(full, { force: true });
    throw error;
  }

  return { id, status: 201 as const };
}

export async function startHandling(id: string) {
  await connection();
  const db = getDb();
  const row = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(id) as { status: string } | undefined;
  if (!row) return { error: "没有这件案子。", status: 404 as const };
  if (row.status !== "待立案") {
    return { error: "只有待立案可以进入办理中。", status: 409 as const };
  }
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM materials WHERE matter_id = ?")
    .get(id) as { n: number };
  if (count.n < 1) {
    return {
      error: "本案还没有已入库的材料，不能进入办理中。",
      status: 409 as const,
    };
  }
  const result = db
    .prepare(
      `UPDATE matters SET status = '办理中' WHERE id = ? AND status = '待立案'`,
    )
    .run(id);
  if (result.changes !== 1) {
    return { error: "没有进入办理中。", status: 409 as const };
  }
  return { id, status: 200 as const };
}

export async function terminateMatter(id: string) {
  await connection();
  const db = getDb();
  const row = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(id) as { status: string } | undefined;
  if (!row) return { error: "没有这件案子。", status: 404 as const };
  if (!isMatterStatus(row.status) || !canTerminate(row.status)) {
    return {
      error: "只有草稿、待立案或办理中可以改为已终止。",
      status: 409 as const,
    };
  }
  const result = db
    .prepare(
      `UPDATE matters SET status = '已终止'
       WHERE id = ? AND status IN ('草稿', '待立案', '办理中')`,
    )
    .run(id);
  if (result.changes !== 1) {
    return { error: "没有改为已终止。", status: 409 as const };
  }
  return { id, status: 200 as const };
}

export async function deleteMatter(id: string) {
  await connection();
  const db = getDb();
  const row = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(id) as { status: string } | undefined;
  if (!row) return { error: "没有这件案子。", status: 404 as const };
  if (row.status === "已删除") {
    return { error: "这件案子已经在已删除。", status: 409 as const };
  }
  const deletedOn = todayISO();
  const result = db
    .prepare(
      `UPDATE matters SET status = '已删除', deleted_on = ? WHERE id = ? AND status != '已删除'`,
    )
    .run(deletedOn, id);
  if (result.changes !== 1) {
    return { error: "没有删掉这件案子。", status: 409 as const };
  }
  return { id, deletedOn, purgeOn: plusDays(deletedOn, DELETE_HOLD_DAYS), status: 200 as const };
}

export async function purgeMatter(id: string) {
  await connection();
  const db = getDb();
  const row = db
    .prepare("SELECT status, deleted_on AS deletedOn FROM matters WHERE id = ?")
    .get(id) as { status: string; deletedOn: string } | undefined;
  if (!row) return { error: "没有这件案子。", status: 404 as const };
  if (row.status !== "已删除") {
    return { error: "先把这件案子放进已删除。", status: 409 as const };
  }
  const purgeOn = plusDays(row.deletedOn, DELETE_HOLD_DAYS);
  if (!purgeOn || todayISO() < purgeOn) {
    return {
      error: purgeOn
        ? `还在保留期内，${purgeOn} 之后可以彻底删除。`
        : "还没有记下删除日期。",
      status: 409 as const,
    };
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const childTables = [
      "sources",
      "closing_task_resolutions",
      "rulings",
      "drafts",
      "focuses",
      "elements",
      "tasks",
      "materials",
      "parties",
      "matter_asks",
      "dossier_items",
      "closing_records",
      "court_officers",
      "preservations",
    ];
    for (const table of childTables) {
      db.prepare(`DELETE FROM ${table} WHERE matter_id = ?`).run(id);
    }
    db.prepare("UPDATE matters SET parent_matter_id = NULL WHERE parent_matter_id = ?").run(id);
    const removed = db.prepare("DELETE FROM matters WHERE id = ? AND status = '已删除'").run(id);
    if (removed.changes !== 1) {
      db.exec("ROLLBACK");
      return { error: "没有彻底删除。", status: 409 as const };
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  removeMatterFiles(id);
  return { id, status: 200 as const };
}

export async function setMatterStatus(id: string, next: string) {
  await connection();
  if (!canMoveStatus(next)) {
    return { error: "已结案和已归档仍走原来的确认。", status: 400 as const };
  }
  const row = getDb()
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(id) as { status: string } | undefined;
  if (!row) return { error: "没有这件案子。", status: 404 as const };
  if (!canMoveStatus(row.status)) {
    return { error: "已结案、已归档、已终止和已删除不在这里改。", status: 409 as const };
  }
  if (row.status === next) return { id, status: 200 as const };
  const changed = getDb()
    .prepare(
      `UPDATE matters SET status = ?
       WHERE id = ? AND status IN ('草稿', '待立案', '办理中', '结案中')`,
    )
    .run(next, id);
  if (changed.changes !== 1) {
    return { error: "没有改状态。", status: 409 as const };
  }
  return { id, status: 200 as const };
}

export async function saveMatterFigures(
  id: string,
  input: {
    claimAmount?: string;
    feeReceivable?: string;
    feeReceived?: string;
  },
) {
  await connection();
  const db = getDb();
  const row = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(id) as { status: string } | undefined;
  if (!row) return { error: "没有这件案子。", status: 404 as const };
  if (!isMatterStatus(row.status) || !canTerminate(row.status)) {
    return {
      error:
        row.status === "已终止" ? TERMINATED_NOTE : "这件案子现在不能改。",
      status: 409 as const,
    };
  }

  const sets: string[] = [];
  const values: Array<string | number | null> = [];
  if (input.claimAmount !== undefined) {
    const amount = parseAmount(input.claimAmount);
    if (amount === null) return { error: "请填写标的额。", status: 400 as const };
    sets.push("claim_amount = ?");
    values.push(amount);
  }
  if (input.feeReceivable !== undefined) {
    const amount = parseAmount(input.feeReceivable, { allowZero: true });
    if (amount === null) return { error: "请填写应收律师费。", status: 400 as const };
    sets.push("fee_receivable = ?");
    values.push(amount);
  }
  if (input.feeReceived !== undefined) {
    const amount = parseAmount(input.feeReceived, { allowZero: true });
    if (amount === null) return { error: "请填写实收律师费。", status: 400 as const };
    sets.push("fee_received = ?");
    values.push(amount);
  }
  if (sets.length === 0) return { error: "没有要记下的内容。", status: 400 as const };

  values.push(id);
  db.prepare(`UPDATE matters SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return { id, status: 200 as const };
}

export async function readMaterialFile(matterId: string, materialId: string) {
  await connection();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT filename
       FROM materials
       WHERE id = ? AND matter_id = ?`,
    )
    .get(materialId, matterId) as { filename: string } | undefined;
  if (!row) return null;

  const full = materialFilePath(matterId, row.filename);
  if (!fs.existsSync(full)) return null;
  const bytes = fs.readFileSync(full);
  return { filename: row.filename, bytes: new Uint8Array(bytes) };
}
