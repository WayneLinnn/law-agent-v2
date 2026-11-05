import "server-only";

import { connection } from "next/server";

import {
  canEditRecord,
  isMatterStatus,
  isPartyPosition,
  isPartyRole,
} from "@/lib/constants";
import { getDb } from "@/lib/db";

const NAME_MAX = 200;
const ID_MAX = 40;

function locked(status: string) {
  return !isMatterStatus(status) || !canEditRecord(status);
}

function readParty(
  input: { role: string; name: string; position: string; idNumber: string },
) {
  if (input.role === "court") {
    return {
      ok: false as const,
      error: "法院写在法院一栏，不作为当事人。",
      status: 400 as const,
    };
  }
  if (!isPartyRole(input.role)) {
    return { ok: false as const, error: "请选择客户、我方或对方。", status: 400 as const };
  }
  const name = input.name.trim();
  if (!name) {
    return { ok: false as const, error: "请写下姓名或名称。", status: 400 as const };
  }
  if (name.length > NAME_MAX) {
    return { ok: false as const, error: "姓名太长。", status: 400 as const };
  }
  const position = input.position.trim();
  if (position && !isPartyPosition(position)) {
    return { ok: false as const, error: "诉讼地位不对。", status: 400 as const };
  }
  const idNumber = input.idNumber.trim();
  if (idNumber.length > ID_MAX) {
    return { ok: false as const, error: "证件号码太长。", status: 400 as const };
  }
  return {
    ok: true as const,
    role: input.role,
    name,
    position,
    idNumber,
  };
}

function clientIdFor(name: string) {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM clients WHERE name = ?").get(name) as
    | { id: string }
    | undefined;
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO clients (id, name) VALUES (?, ?)").run(id, name);
  return id;
}

export async function addParty(
  matterId: string,
  input: { role: string; name: string; position: string; idNumber: string },
) {
  await connection();
  const db = getDb();
  const matter = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(matterId) as { status: string } | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (locked(matter.status)) {
    return { error: "这件案子现在不能改当事人。", status: 409 as const };
  }
  const party = readParty(input);
  if (!party.ok) return { error: party.error, status: party.status };

  const id = crypto.randomUUID();
  const clientId = party.role === "client" ? clientIdFor(party.name) : null;
  db.prepare(
    `INSERT INTO parties (id, matter_id, role, name, client_id, position, id_number)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, matterId, party.role, party.name, clientId, party.position, party.idNumber);
  return { id, status: 201 as const };
}

export async function updateParty(
  matterId: string,
  partyId: string,
  input: { role: string; name: string; position: string; idNumber: string },
) {
  await connection();
  const db = getDb();
  const matter = db
    .prepare("SELECT status FROM matters WHERE id = ?")
    .get(matterId) as { status: string } | undefined;
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  if (locked(matter.status)) {
    return { error: "这件案子现在不能改当事人。", status: 409 as const };
  }
  const current = db
    .prepare("SELECT id FROM parties WHERE id = ? AND matter_id = ?")
    .get(partyId, matterId) as { id: string } | undefined;
  if (!current) return { error: "没有这位当事人。", status: 404 as const };

  const party = readParty(input);
  if (!party.ok) return { error: party.error, status: party.status };
  const clientId = party.role === "client" ? clientIdFor(party.name) : null;
  db.prepare(
    `UPDATE parties
     SET role = ?, name = ?, client_id = ?, position = ?, id_number = ?
     WHERE id = ?`,
  ).run(party.role, party.name, clientId, party.position, party.idNumber, partyId);
  return { id: partyId, status: 200 as const };
}
