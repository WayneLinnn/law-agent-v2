import { connection } from "next/server";

import { todayISO } from "@/lib/figures";
import { getDb } from "@/lib/db";
import { researchGate } from "@/lib/focuses";
import {
  getArticle,
  PkulawError,
  searchCases,
  searchLaws,
} from "@/lib/pkulaw";
import type {
  SourceCandidate,
  SourceKind,
  SourceRecord,
} from "@/lib/types";

const SEARCH_TTL_MS = 30 * 60 * 1000;
const LAW_SIZE = 20;
const LAW_KEEP = 10;
const CASE_SIZE = 6;
const NAMED_MAX = 3;
const LAW_QUERY_MAX = 200;

type Search = {
  matterId: string;
  focusId: string;
  retrievedAt: string;
  candidates: SourceCandidate[];
  at: number;
};

const globalForResearch = globalThis as unknown as {
  researchSearches?: Map<string, Search>;
};
const searches: Map<string, Search> = (globalForResearch.researchSearches ??=
  new Map());

function sweep() {
  const now = Date.now();
  for (const [id, search] of searches) {
    if (now - search.at > SEARCH_TTL_MS) searches.delete(id);
  }
}

const SHORT_LAWS =
  "民法典|民事诉讼法|建筑法|招标投标法|公司法|合伙企业法|劳动合同法|劳动法|保险法|担保法|合同法|物权法|侵权责任法|刑法|行政诉讼法";
const ARTICLE_NO = "第[零〇一二三四五六七八九十百千\\d]+条(?:之[一二三四五六七八九十]+)?";
const NAMED_RE = new RegExp(
  `《([^》]{2,40})》(${ARTICLE_NO})|(${SHORT_LAWS})(${ARTICLE_NO})`,
  "g",
);

function namedArticles(texts: string[]) {
  const found = new Map<string, { law: string; label: string }>();
  for (const text of texts) {
    for (const match of text.matchAll(NAMED_RE)) {
      const law = match[1] ?? match[3];
      const label = match[2] ?? match[4];
      if (law && label) found.set(`${law}#${label}`, { law, label });
    }
  }
  return [...found.values()].slice(0, NAMED_MAX);
}

const ID_RE = /\d{17}[\dXx]/g;
const PHONE_RE = /1[3-9]\d{9}/g;
const COMPANY_RE =
  /[\u4e00-\u9fa5]{2,12}?(?:股份有限公司|有限责任公司|有限公司|集团公司)/g;
const ADDRESS_RE =
  /[\u4e00-\u9fa5]{2,8}(?:省|自治区|市)[\u4e00-\u9fa5\d]{0,12}(?:市|区|县)[\u4e00-\u9fa5\d\-－]{0,30}?(?:路|街|道|巷|村)[\d\-－]+号/g;

function deidentify(text: string, parties: { role: string; name: string }[]) {
  let out = text;
  const named = [...parties].sort((a, b) => b.name.length - a.name.length);
  for (const party of named) {
    if (party.role === "court" || party.name.length < 2) continue;
    out = out.split(party.name).join(party.role === "opposing" ? "对方" : "我方");
  }
  return out
    .replace(ID_RE, "某身份证号")
    .replace(PHONE_RE, "某电话")
    .replace(ADDRESS_RE, "某地")
    .replace(COMPANY_RE, "某公司");
}

function merge(groups: SourceCandidate[][]) {
  const seen = new Set<string>();
  const merged: SourceCandidate[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.sourceId)) continue;
      seen.add(item.sourceId);
      merged.push(item);
    }
  }
  return merged;
}

export async function researchFocus(
  matterId: string,
  focusId: string,
  lawQueryInput: string | null,
) {
  const gate = await researchGate(matterId);
  if (gate.status !== 200) return gate;
  const lawInput = lawQueryInput?.trim() ?? "";
  if (!lawInput) return { error: "请写下法条检索句。", status: 400 as const };
  if (lawInput.length > LAW_QUERY_MAX) {
    return { error: "法条检索句写得太长。", status: 400 as const };
  }

  const db = getDb();
  const focus = db
    .prepare(
      `SELECT body, confirmed_at AS confirmedAt FROM focuses
       WHERE id = ? AND matter_id = ?`,
    )
    .get(focusId, matterId) as { body: string; confirmedAt: string | null } | undefined;
  if (!focus) return { error: "没有这条焦点。", status: 404 as const };
  if (!focus.confirmedAt) return { error: "这条焦点还没确认。", status: 409 as const };

  const matter = db
    .prepare("SELECT cause FROM matters WHERE id = ?")
    .get(matterId) as { cause: string };
  const elements = db
    .prepare(
      `SELECT body FROM elements
       WHERE matter_id = ? AND confirmed_at IS NOT NULL
       ORDER BY position`,
    )
    .all(matterId) as { body: string }[];
  const parties = db
    .prepare("SELECT role, name FROM parties WHERE matter_id = ?")
    .all(matterId) as { role: string; name: string }[];

  const named = namedArticles([
    focus.body,
    lawInput,
    ...elements.map((row) => row.body),
  ]);
  const lawQuery = deidentify(lawInput, parties);
  const caseQuery = deidentify(
    [matter.cause, focus.body].filter(Boolean).join("。"),
    parties,
  );

  let groups: SourceCandidate[][];
  try {
    const [articles, laws, cases] = await Promise.all([
      Promise.all(
        named.map((item) =>
          getArticle(item.law, item.label).catch((error) => {
            if (error instanceof PkulawError) throw error;
            return null;
          }),
        ),
      ),
      searchLaws(lawQuery, LAW_SIZE),
      searchCases(caseQuery, CASE_SIZE),
    ]);
    groups = [
      articles.filter((item): item is SourceCandidate => item !== null),
      laws.slice(0, LAW_KEEP),
      cases,
    ];
  } catch (error) {
    if (error instanceof PkulawError) {
      return { error: error.message, status: 502 as const };
    }
    throw error;
  }

  const candidates = merge(groups);
  const retrievedAt = todayISO();
  sweep();
  const searchId = crypto.randomUUID();
  searches.set(searchId, {
    matterId,
    focusId,
    retrievedAt,
    candidates,
    at: Date.now(),
  });
  return {
    searchId,
    lawQuery,
    caseQuery,
    retrievedAt,
    candidates,
    status: 200 as const,
  };
}

export async function acceptSources(
  matterId: string,
  searchId: string,
  sourceIds: string[],
) {
  const gate = await researchGate(matterId);
  if (gate.status !== 200) return gate;

  sweep();
  const search = searches.get(searchId);
  if (!search || search.matterId !== matterId) {
    return { error: "检索结果已经过期，请再查一次。", status: 409 as const };
  }
  const wanted = new Set(sourceIds);
  if (wanted.size === 0) return { error: "请勾选出处。", status: 400 as const };
  const picked = search.candidates.filter((item) => wanted.has(item.sourceId));
  if (picked.length !== wanted.size) {
    return { error: "勾选的出处不在这次检索里。", status: 409 as const };
  }

  const db = getDb();
  const focus = db
    .prepare(
      `SELECT 1 AS ok FROM focuses
       WHERE id = ? AND matter_id = ? AND confirmed_at IS NOT NULL`,
    )
    .get(search.focusId, matterId);
  if (!focus) return { error: "没有这条焦点。", status: 404 as const };

  const acceptedAt = todayISO();
  const insert = db.prepare(
    `INSERT INTO sources (
       id, matter_id, focus_id, kind, source_id, title, text, url, status,
       detail, retrieved_at, accepted_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (focus_id, source_id) DO NOTHING`,
  );
  let added = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const item of picked) {
      const result = insert.run(
        crypto.randomUUID(),
        matterId,
        search.focusId,
        item.kind,
        item.sourceId,
        item.title,
        item.text,
        item.url,
        item.status,
        item.detail,
        search.retrievedAt,
        acceptedAt,
      );
      added += Number(result.changes);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { added, acceptedAt, status: 201 as const };
}

type SourceRow = {
  id: string;
  focusId: string;
  kind: SourceKind;
  sourceId: string;
  title: string;
  text: string;
  url: string;
  status: string;
  detail: string;
  retrievedAt: string;
  acceptedAt: string;
};

export async function listSources(matterId: string): Promise<SourceRecord[]> {
  await connection();
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.focus_id AS focusId, s.kind, s.source_id AS sourceId,
              s.title, s.text, s.url, s.status, s.detail,
              s.retrieved_at AS retrievedAt, s.accepted_at AS acceptedAt
       FROM sources s
       JOIN focuses f ON f.id = s.focus_id
       WHERE s.matter_id = ?
       ORDER BY f.position, s.accepted_at, s.kind DESC, s.rowid`,
    )
    .all(matterId) as SourceRow[];
  return rows.map(
    (row): SourceRecord => ({
      id: row.id,
      focusId: row.focusId,
      kind: row.kind,
      sourceId: row.sourceId,
      title: row.title,
      text: row.text,
      url: row.url,
      status: row.status,
      detail: row.detail,
      retrievedAt: row.retrievedAt,
      acceptedAt: row.acceptedAt,
    }),
  );
}
