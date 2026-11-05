import "server-only";

import { connection } from "next/server";

import {
  canEditRecord,
  isCaseCategory,
  isInstance,
  isMatterStatus,
  isProcedure,
} from "@/lib/constants";
import { getDb } from "@/lib/db";
import { isIsoDate } from "@/lib/figures";
import type { ProceedingLink } from "@/lib/types";

const CASE_NUMBER_MAX = 80;

function locked(status: string) {
  return !isMatterStatus(status) || !canEditRecord(status);
}

export async function saveProceeding(
  matterId: string,
  input: {
    caseNumber: string;
    category: string;
    engagedOn: string;
    instance: string;
    procedure: string;
  },
) {
  await connection();
  const db = getDb();
  const matter = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(matterId) as { status: string } | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (locked(matter.status)) {
    return { error: "这件案子现在不能改程序。", status: 409 as const };
  }

  const caseNumber = input.caseNumber.trim();
  if (caseNumber.length > CASE_NUMBER_MAX) {
    return { error: "案号太长。", status: 400 as const };
  }
  const category = input.category.trim();
  if (category && !isCaseCategory(category)) {
    return { error: "案件类型不对。", status: 400 as const };
  }
  const engagedOn = input.engagedOn.trim();
  if (engagedOn && !isIsoDate(engagedOn)) {
    return { error: "委托日期要写成日期。", status: 400 as const };
  }
  const instance = input.instance.trim();
  if (instance && !isInstance(instance)) {
    return { error: "审级不对。", status: 400 as const };
  }
  const procedure = input.procedure.trim();
  if (procedure && !isProcedure(procedure)) {
    return { error: "程序不对。", status: 400 as const };
  }

  db.prepare(
    `UPDATE matters
     SET case_number = ?, category = ?, engaged_on = ?, instance = ?, procedure = ?
     WHERE id = ?`,
  ).run(caseNumber, category, engagedOn, instance, procedure, matterId);
  return { status: 200 as const };
}

export async function openProceeding(matterId: string, instance: string) {
  await connection();
  const db = getDb();
  if (!isInstance(instance) || instance === "一审") {
    return { error: "请选择二审、再审或执行。", status: 400 as const };
  }
  const parent = db
    .prepare(
      `SELECT name, status, cause, facts, mandate, procedure, category, engaged_on AS engagedOn,
              court_name AS courtName
       FROM matters WHERE id = ?`,
    )
    .get(matterId) as
    | {
        name: string;
        status: string;
        cause: string;
        facts: string;
        mandate: string;
        procedure: string;
        category: string;
        engagedOn: string;
        courtName: string;
      }
    | undefined;
  if (!parent) return { error: "没有这件案子。", status: 404 as const };
  if (parent.status === "已终止") {
    return { error: "已终止的案子不能另开程序。", status: 409 as const };
  }

  const parties = db
    .prepare(
      `SELECT role, name, client_id AS clientId, position, id_number AS idNumber
       FROM parties WHERE matter_id = ?`,
    )
    .all(matterId) as {
    role: string;
    name: string;
    clientId: string | null;
    position: string;
    idNumber: string;
  }[];

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString().slice(0, 10);
  const name = `${parent.name}（${instance}）`.slice(0, 200);
  const clearPosition = instance === "二审" || instance === "再审";

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO matters (
         id, name, status, cause, facts, mandate, case_number, category, engaged_on, instance, procedure, parent_matter_id, created_at, court_name
       ) VALUES (?, ?, '草稿', ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      name,
      parent.cause,
      parent.facts,
      parent.mandate,
      parent.category,
      parent.engagedOn,
      instance,
      parent.procedure,
      matterId,
      createdAt,
      parent.courtName,
    );
    const insert = db.prepare(
      `INSERT INTO parties (id, matter_id, role, name, client_id, position, id_number)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const party of parties) {
      if (party.role === "court") continue;
      insert.run(
        crypto.randomUUID(),
        id,
        party.role,
        party.name,
        party.clientId,
        clearPosition ? "" : party.position,
        party.idNumber,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { id, status: 201 as const };
}

export async function listProceedings(matterId: string): Promise<{
  parent: ProceedingLink | null;
  children: ProceedingLink[];
} | null> {
  await connection();
  const db = getDb();
  const self = db
    .prepare("SELECT parent_matter_id AS parentMatterId FROM matters WHERE id = ?")
    .get(matterId) as { parentMatterId: string | null } | undefined;
  if (!self) return null;

  const columns = `id, name, instance, status, case_number AS caseNumber`;
  const parentRow = self.parentMatterId
    ? (db
        .prepare(`SELECT ${columns} FROM matters WHERE id = ?`)
        .get(self.parentMatterId) as ProceedingLink | undefined)
    : undefined;
  const children = db
    .prepare(
      `SELECT ${columns} FROM matters WHERE parent_matter_id = ? ORDER BY created_at`,
    )
    .all(matterId) as ProceedingLink[];

  return {
    parent: parentRow
      ? {
          id: parentRow.id,
          name: parentRow.name,
          instance: parentRow.instance,
          status: parentRow.status,
          caseNumber: parentRow.caseNumber,
        }
      : null,
    children: children.map((row) => ({
      id: row.id,
      name: row.name,
      instance: row.instance,
      status: row.status,
      caseNumber: row.caseNumber,
    })),
  };
}
