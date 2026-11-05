import "server-only";

import { connection } from "next/server";

import { textFromFile } from "@/lib/file-text";
import { structureIntake } from "@/lib/model";
import { addMaterial, createDraft, type DraftInput } from "@/lib/matters";

const ROLE =
  "被申请人|被上诉人|再审申请人|上诉人|申请人|原告|被告|第三人|委托人|发包人|承包人";
const PARTY_RE = new RegExp(
  `^(${ROLE})(?:[（(][^）)]{0,24}[）)])?[0-9０-９一二三四五六七八九十]*[：:]\\s*(.+)$`,
);
const CREDIT_RE =
  /(?:统一社会信用代码|社会信用代码|信用代码)[：:\s]*([0-9A-HJ-NPQRTUWXY]{18})/i;
const CAUSE_RE = /^案由[：:]\s*(.+)$/;
const SECTION_RE =
  /^(诉讼请求|仲裁请求|上诉请求|委托事项|事实与理由|事实和理由)[：:]?\s*(.*)$/;
const COURT_RE = /([\u4e00-\u9fa5]{2,30}(?:人民法院|仲裁委员会))/;

export type IntakeParty = {
  roleLabel: string;
  name: string;
  creditCode: string;
};

export type IntakeRead = {
  filename: string;
  parties: IntakeParty[];
  court: string;
  cause: string;
  facts: string;
  mandate: string;
};

function partyName(rest: string) {
  return rest.split(/[，,。；;]/)[0]?.trim() ?? "";
}

export function parseIntake(text: string): Omit<IntakeRead, "filename"> {
  const parties: IntakeParty[] = [];
  let court = "";
  let cause = "";
  const facts: string[] = [];
  const mandate: string[] = [];
  let section: "facts" | "mandate" | null = null;
  let expectCourt = false;
  let current: IntakeParty | null = null;

  function pushCurrent() {
    if (!current?.name) {
      current = null;
      return;
    }
    if (
      !parties.some(
        (party) =>
          party.name === current?.name && party.roleLabel === current.roleLabel,
      )
    ) {
      parties.push(current);
    }
    current = null;
  }

  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (expectCourt) {
      if (!court) court = line.replace(/[。．]$/, "");
      expectCourt = false;
      section = null;
      continue;
    }

    if (line === "此致" || /^此致[：:]/.test(line)) {
      pushCurrent();
      section = null;
      const rest = line.replace(/^此致[：:]?/, "").trim();
      if (rest && !court) court = rest.replace(/[。．]$/, "");
      else expectCourt = true;
      continue;
    }

    const causeMatch = line.match(CAUSE_RE);
    if (causeMatch) {
      pushCurrent();
      section = null;
      cause = causeMatch[1].trim();
      continue;
    }

    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      pushCurrent();
      section = sectionMatch[1].startsWith("事实") ? "facts" : "mandate";
      if (sectionMatch[2]) {
        (section === "facts" ? facts : mandate).push(sectionMatch[2]);
      }
      continue;
    }

    const partyMatch = section === null ? line.match(PARTY_RE) : null;
    if (partyMatch) {
      pushCurrent();
      const name = partyName(partyMatch[2]);
      if (name) {
        current = {
          roleLabel: partyMatch[1],
          name,
          creditCode: line.match(CREDIT_RE)?.[1]?.toUpperCase() ?? "",
        };
      }
      continue;
    }

    if (current && !current.creditCode) {
      const credit = line.match(CREDIT_RE)?.[1];
      if (credit) current.creditCode = credit.toUpperCase();
    }

    if (!court && section === null) {
      const courtMatch = line.match(COURT_RE);
      if (courtMatch) court = courtMatch[1];
    }

    if (section === "facts") facts.push(line);
    else if (section === "mandate") mandate.push(line);
  }
  pushCurrent();

  return {
    parties,
    court,
    cause,
    facts: facts.join("\n").trim(),
    mandate: mandate.join("\n").trim(),
  };
}

export async function readIntakeFile(file: File) {
  await connection();
  const filename = file.name.trim();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const read = await textFromFile(filename, bytes);
  if ("error" in read && read.error) {
    return { error: read.error, status: read.status ?? 400 };
  }
  if ("unread" in read && read.unread) {
    return {
      filename,
      unread: true as const,
      note: read.note,
      parties: [] as IntakeParty[],
      court: "",
      cause: "",
      facts: "",
      mandate: "",
      status: 200 as const,
    };
  }

  if (!("text" in read) || !read.text) {
    return { error: "没有读出文字。", status: 422 as const };
  }
  const parsed = parseIntake(read.text);
  const model = await structureIntake(read.text);
  const modelFilled =
    model &&
    (model.client || model.opposing || model.court || model.cause || model.facts);
  if (!model || !modelFilled) {
    return { filename, unread: false as const, ...parsed, status: 200 as const };
  }

  const parties: IntakeParty[] = [];
  if (model.client) {
    parties.push({ roleLabel: "委托人", name: model.client, creditCode: "" });
  }
  if (model.opposing) {
    parties.push({ roleLabel: "对方", name: model.opposing, creditCode: "" });
  }
  return {
    filename,
    unread: false as const,
    parties: parties.length > 0 ? parties : parsed.parties,
    court: model.court || parsed.court,
    cause: model.cause || parsed.cause,
    facts: model.facts || parsed.facts,
    mandate: model.mandate || parsed.mandate,
    status: 200 as const,
  };
}

export async function acceptIntake(
  input: DraftInput,
  file: File,
  options: { contract: boolean; extract: boolean },
) {
  if (!input.clientName.trim()) {
    return { error: "请点明谁是客户。", status: 400 as const };
  }
  const created = await createDraft(input);
  if ("error" in created) {
    return { error: created.error, status: 400 as const };
  }
  const material = await addMaterial(created.id, file, {
    kind: options.contract ? "代理合同" : "往来文书",
    extract: options.extract,
  });
  if ("error" in material) {
    return {
      id: created.id,
      error: material.error,
      status: material.status,
    };
  }
  return { id: created.id, status: 201 as const };
}
