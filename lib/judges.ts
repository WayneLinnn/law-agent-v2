import "server-only";

import { connection } from "next/server";

import { getDb } from "@/lib/db";
import type { JudgeRecord } from "@/lib/types";

function fields(input: { name: string; division: string; phone: string }) {
  const name = input.name.trim();
  const division = input.division.trim();
  const phone = input.phone.trim();
  if (!name) return { error: "请写下姓名。" };
  if (name.length > 40) return { error: "姓名写得太长。" };
  if (division.length > 80) return { error: "庭室写得太长。" };
  if (phone.length > 40) return { error: "电话写得太长。" };
  return { name, division, phone };
}

export async function listJudges(): Promise<JudgeRecord[]> {
  await connection();
  const rows = getDb()
    .prepare(
      `SELECT id, name, division, phone
       FROM judges
       ORDER BY name, division`,
    )
    .all() as JudgeRecord[];
  return rows.map((row) => ({ ...row }));
}

export async function createJudge(input: {
  name: string;
  division: string;
  phone: string;
}) {
  await connection();
  const parsed = fields(input);
  if ("error" in parsed) return { error: parsed.error, status: 400 as const };
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM judges WHERE name = ? AND division = ?")
    .get(parsed.name, parsed.division) as { id: string } | undefined;
  if (existing) return { error: "通讯录里已经有这位。", status: 409 as const };
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO judges (id, name, division, phone, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, parsed.name, parsed.division, parsed.phone, new Date().toISOString().slice(0, 10));
  return { id, status: 201 as const };
}

export async function updateJudge(
  id: string,
  input: { name: string; division: string; phone: string },
) {
  await connection();
  const parsed = fields(input);
  if ("error" in parsed) return { error: parsed.error, status: 400 as const };
  const db = getDb();
  const current = db.prepare("SELECT id FROM judges WHERE id = ?").get(id) as
    | { id: string }
    | undefined;
  if (!current) return { error: "没有这位法官。", status: 404 as const };
  const existing = db
    .prepare("SELECT id FROM judges WHERE name = ? AND division = ? AND id <> ?")
    .get(parsed.name, parsed.division, id) as { id: string } | undefined;
  if (existing) return { error: "通讯录里已经有这位。", status: 409 as const };
  db.prepare(
    "UPDATE judges SET name = ?, division = ?, phone = ? WHERE id = ?",
  ).run(parsed.name, parsed.division, parsed.phone, id);
  return { id, status: 200 as const };
}

export async function removeJudge(id: string) {
  await connection();
  const result = getDb().prepare("DELETE FROM judges WHERE id = ?").run(id);
  if (result.changes !== 1) return { error: "没有这位法官。", status: 404 as const };
  return { id, status: 200 as const };
}
