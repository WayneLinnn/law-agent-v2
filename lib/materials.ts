import "server-only";

import fs from "node:fs";

import { connection } from "next/server";

import {
  canEditRecord,
  isMaterialKind,
  isMatterStatus,
} from "@/lib/constants";
import { getDb, materialFilePath } from "@/lib/db";
import { textFromFile } from "@/lib/file-text";
import { canReadText } from "@/lib/file-kinds";

export async function classifyMaterial(
  matterId: string,
  materialId: string,
  input: { kind: string; proves: string; submittedBy: string },
) {
  await connection();
  const db = getDb();
  const matter = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(matterId) as { status: string } | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (!isMatterStatus(matter.status) || !canEditRecord(matter.status)) {
    return { error: "这件案子现在不能改材料。", status: 409 as const };
  }
  const material = db
    .prepare("SELECT id FROM materials WHERE id = ? AND matter_id = ?")
    .get(materialId, matterId) as { id: string } | undefined;
  if (!material) return { error: "没有这份材料。", status: 404 as const };
  if (!isMaterialKind(input.kind)) {
    return { error: "材料种类不对。", status: 400 as const };
  }

  const proves = input.kind === "证据" ? input.proves.trim().slice(0, 200) : "";
  let submittedBy: string | null = null;
  if (input.kind === "证据" && input.submittedBy.trim()) {
    const party = db
      .prepare("SELECT id FROM parties WHERE id = ? AND matter_id = ?")
      .get(input.submittedBy.trim(), matterId) as { id: string } | undefined;
    if (!party) return { error: "这份证据没有对应的当事人。", status: 400 as const };
    submittedBy = party.id;
  }

  db.prepare(
    `UPDATE materials SET kind = ?, proves = ?, submitted_by = ? WHERE id = ?`,
  ).run(input.kind, proves, submittedBy, materialId);
  if (input.kind !== "裁判文书") {
    db.prepare("DELETE FROM rulings WHERE material_id = ?").run(materialId);
  }
  return { status: 200 as const };
}

export async function readMaterialText(matterId: string, materialId: string) {
  await connection();
  const db = getDb();
  const matter = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(matterId) as { status: string } | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (!isMatterStatus(matter.status) || !canEditRecord(matter.status)) {
    return { error: "这件案子现在不能读材料。", status: 409 as const };
  }
  const material = db
    .prepare("SELECT filename FROM materials WHERE id = ? AND matter_id = ?")
    .get(materialId, matterId) as { filename: string } | undefined;
  if (!material) return { error: "没有这份材料。", status: 404 as const };
  if (!canReadText(material.filename)) {
    return {
      error: "图片、录音和录像先存放。读取文字只处理 txt 和带文字的 PDF。",
      status: 400 as const,
    };
  }
  const full = materialFilePath(matterId, material.filename);
  if (!fs.existsSync(full)) return { error: "找不到这份材料的文件。", status: 404 as const };
  const read = await textFromFile(material.filename, new Uint8Array(fs.readFileSync(full)));
  if ("error" in read && read.error) {
    return { error: read.error, status: read.status ?? 400 };
  }
  if ("unread" in read && read.unread) {
    return { error: read.note ?? "没有读出文字。", status: 422 as const };
  }
  if (!("text" in read) || !read.text) {
    return { error: "没有读出文字。", status: 422 as const };
  }
  db.prepare("UPDATE materials SET extracted_text = ? WHERE id = ?").run(read.text, materialId);
  return { ok: true as const };
}
