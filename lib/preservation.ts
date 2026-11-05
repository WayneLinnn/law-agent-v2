import "server-only";

import { connection } from "next/server";

import { canEditRecord, isMatterStatus } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { isIsoDate } from "@/lib/figures";

export type PreservationRecord = {
  status: "" | "未保全" | "已保全";
  subject: string;
  court: string;
  preservedOn: string;
};

const empty: PreservationRecord = {
  status: "",
  subject: "",
  court: "",
  preservedOn: "",
};

export async function getPreservation(matterId: string): Promise<PreservationRecord> {
  await connection();
  const row = getDb()
    .prepare(
      `SELECT status, subject, court, preserved_on AS preservedOn
       FROM preservations WHERE matter_id = ?`,
    )
    .get(matterId) as Omit<PreservationRecord, "status"> & { status: string } | undefined;
  if (!row) return empty;
  const status = row.status === "未保全" || row.status === "已保全" ? row.status : "";
  return { status, subject: row.subject, court: row.court, preservedOn: row.preservedOn };
}

export async function savePreservation(
  matterId: string,
  input: { status: string; subject: string; court: string; preservedOn: string },
) {
  await connection();
  const db = getDb();
  const matter = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(matterId) as { status: string } | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (!isMatterStatus(matter.status) || !canEditRecord(matter.status)) {
    return { error: "这件案子现在不能改保全。", status: 409 as const };
  }

  const status = input.status.trim();
  if (status !== "未保全" && status !== "已保全") {
    return { error: "请选择未保全或已保全。", status: 400 as const };
  }
  const subject = input.subject.trim();
  const court = input.court.trim();
  const preservedOn = input.preservedOn.trim();
  if (subject.length > 200 || court.length > 80) {
    return { error: "写得太长。", status: 400 as const };
  }
  if (status === "已保全" && !subject) {
    return { error: "请写下保全了什么。", status: 400 as const };
  }
  if (preservedOn && !isIsoDate(preservedOn)) {
    return { error: "保全日期不对。", status: 400 as const };
  }

  db.prepare(
    `INSERT INTO preservations (matter_id, status, subject, court, preserved_on)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(matter_id) DO UPDATE SET
       status = excluded.status,
       subject = excluded.subject,
       court = excluded.court,
       preserved_on = excluded.preserved_on`,
  ).run(matterId, status, subject, court, preservedOn);
  return { ok: true as const };
}
