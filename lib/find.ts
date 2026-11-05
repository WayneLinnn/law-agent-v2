import { connection } from "next/server";

import { getDb } from "@/lib/db";

const QUERY_MAX = 80;
const LIMIT = 20;

export type MatterHit = {
  id: string;
  name: string;
  status: string;
  hit: string;
};

export type MaterialHit = {
  id: string;
  matterId: string;
  matterName: string;
  filename: string;
  snippet: string;
};

function includes(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle);
}

function snippet(text: string, needle: string) {
  const index = text.toLowerCase().indexOf(needle);
  if (index < 0) return "";
  const start = Math.max(0, index - 16);
  const end = Math.min(text.length, index + needle.length + 28);
  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

export async function findRecords(query: string) {
  await connection();
  const q = query.trim();
  if (!q) return { error: "请写下要找的案子或材料。", status: 400 as const };
  if (q.length > QUERY_MAX) {
    return { error: "这句话太长。", status: 400 as const };
  }
  const needle = q.toLowerCase();
  const db = getDb();
  const matters = db
    .prepare(
      `SELECT id, name, status, cause, facts, mandate
       FROM matters
       ORDER BY created_at DESC`,
    )
    .all() as {
    id: string;
    name: string;
    status: string;
    cause: string;
    facts: string;
    mandate: string;
  }[];
  const parties = db
    .prepare(`SELECT matter_id AS matterId, name FROM parties`)
    .all() as { matterId: string; name: string }[];
  const materials = db
    .prepare(
      `SELECT id, matter_id AS matterId, filename, extracted_text AS extractedText
       FROM materials`,
    )
    .all() as {
    id: string;
    matterId: string;
    filename: string;
    extractedText: string;
  }[];

  const partiesByMatter = new Map<string, string[]>();
  for (const party of parties) {
    const list = partiesByMatter.get(party.matterId) ?? [];
    list.push(party.name);
    partiesByMatter.set(party.matterId, list);
  }
  const matterName = new Map(matters.map((matter) => [matter.id, matter.name]));

  const matterHits: MatterHit[] = [];
  let matterMore = false;
  for (const matter of matters) {
    const partyHit = (partiesByMatter.get(matter.id) ?? []).find((name) =>
      includes(name, needle),
    );
    const hit = includes(matter.name, needle)
      ? "案件名称"
      : partyHit
        ? `当事人 ${partyHit}`
        : includes(matter.cause, needle)
          ? "案由"
          : includes(matter.facts, needle)
            ? "基本事实"
            : includes(matter.mandate, needle)
              ? "委托事项"
              : "";
    if (matter.status === "已删除") continue;
    if (!hit) continue;
    if (matterHits.length >= LIMIT) {
      matterMore = true;
      break;
    }
    matterHits.push({
      id: matter.id,
      name: matter.name,
      status: matter.status,
      hit,
    });
  }

  const materialHits: MaterialHit[] = [];
  let materialMore = false;
  for (const material of materials) {
    if ((matters.find((item) => item.id === material.matterId)?.status ?? "") === "已删除") {
      continue;
    }
    const inName = includes(material.filename, needle);
    const inText = includes(material.extractedText, needle);
    if (!inName && !inText) continue;
    if (materialHits.length >= LIMIT) {
      materialMore = true;
      break;
    }
    materialHits.push({
      id: material.id,
      matterId: material.matterId,
      matterName: matterName.get(material.matterId) ?? "",
      filename: material.filename,
      snippet: inName ? "" : snippet(material.extractedText, needle),
    });
  }

  return {
    query: q,
    matters: matterHits.map((hit) => ({ ...hit })),
    materials: materialHits.map((hit) => ({ ...hit })),
    more: matterMore || materialMore,
    status: 200 as const,
  };
}
