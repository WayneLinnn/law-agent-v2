import "server-only";

import { connection } from "next/server";

import { canEditRecord, isMatterStatus } from "@/lib/constants";
import { getDb } from "@/lib/db";
import type { CourtOfficer } from "@/lib/types";

const empty: CourtOfficer = {
  judge: "",
  assistant: "",
  clerk: "",
  division: "",
  contact: "",
};

function clip(value: string, max: number) {
  const text = value.trim();
  if (text.length > max) return { error: "写得太长。" as const };
  return { value: text };
}

export async function getCourtOfficer(matterId: string): Promise<CourtOfficer> {
  await connection();
  const row = getDb()
    .prepare(
      `SELECT judge, assistant, clerk, division, contact
       FROM court_officers
       WHERE matter_id = ?`,
    )
    .get(matterId) as CourtOfficer | undefined;
  return row ? { ...row } : empty;
}

export async function saveCourtOfficer(
  matterId: string,
  input: CourtOfficer,
  courtName: string,
) {
  await connection();
  const db = getDb();
  const matter = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(matterId) as { status: string } | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (!isMatterStatus(matter.status) || !canEditRecord(matter.status)) {
    return { error: "这件案子不能再改法院承办人。", status: 409 as const };
  }

  const judge = clip(input.judge, 40);
  const assistant = clip(input.assistant, 40);
  const clerk = clip(input.clerk, 40);
  const division = clip(input.division, 80);
  const contact = clip(input.contact, 40);
  if ("error" in judge) return { error: "承办法官写得太长。", status: 400 as const };
  if ("error" in assistant) {
    return { error: "法官助理写得太长。", status: 400 as const };
  }
  if ("error" in clerk) return { error: "书记员写得太长。", status: 400 as const };
  if ("error" in division) return { error: "庭室写得太长。", status: 400 as const };
  if ("error" in contact) return { error: "联系方式写得太长。", status: 400 as const };

  const name = clip(courtName, 80);
  if ("error" in name) return { error: "法院名称写得太长。", status: 400 as const };
  db.prepare("UPDATE matters SET court_name = ? WHERE id = ?").run(name.value, matterId);

  const fields = [judge.value, assistant.value, clerk.value, division.value, contact.value];
  if (fields.every((field) => field === "")) {
    db.prepare("DELETE FROM court_officers WHERE matter_id = ?").run(matterId);
    return { ok: true as const };
  }

  db.prepare(
    `INSERT INTO court_officers (matter_id, judge, assistant, clerk, division, contact)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(matter_id) DO UPDATE SET
       judge = excluded.judge,
       assistant = excluded.assistant,
       clerk = excluded.clerk,
       division = excluded.division,
       contact = excluded.contact`,
  ).run(matterId, ...fields);
  return { ok: true as const };
}
