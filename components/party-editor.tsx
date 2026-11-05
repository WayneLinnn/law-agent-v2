"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SavedLine } from "@/components/saved-line";
import { Button } from "@/components/ui/button";
import {
  PARTY_POSITIONS,
  PARTY_ROLE_LABEL,
  PARTY_ROLES,
  type PartyRole,
} from "@/lib/constants";
import type { PartyRecord } from "@/lib/types";

const fieldClass =
  "mt-2 w-full min-w-0 field";

function PartyFields({
  role,
  name,
  position,
  idNumber,
  onRole,
  onName,
  onPosition,
  onIdNumber,
}: {
  role: string;
  name: string;
  position: string;
  idNumber: string;
  onRole: (value: string) => void;
  onName: (value: string) => void;
  onPosition: (value: string) => void;
  onIdNumber: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="min-w-0 text-xs text-muted">
        哪一方
        <select
          value={role}
          onChange={(event) => onRole(event.target.value)}
          className={fieldClass}
        >
          {PARTY_ROLES.filter((item) => item !== "court").map((item) => (
            <option key={item} value={item}>
              {PARTY_ROLE_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 text-xs text-muted">
        诉讼地位
        <select
          value={position}
          onChange={(event) => onPosition(event.target.value)}
          className={fieldClass}
        >
          <option value="">未填写</option>
          {PARTY_POSITIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 text-xs text-muted sm:col-span-2">
        姓名或名称
        <input
          value={name}
          onChange={(event) => onName(event.target.value)}
          autoComplete="off"
          className={fieldClass}
        />
      </label>
      <label className="min-w-0 text-xs text-muted sm:col-span-2">
        统一社会信用代码或证件号
        <input
          value={idNumber}
          onChange={(event) => onIdNumber(event.target.value)}
          autoComplete="off"
          className={fieldClass}
        />
      </label>
    </div>
  );
}

function ExistingParty({
  matterId,
  party,
}: {
  matterId: string;
  party: PartyRecord;
}) {
  const router = useRouter();
  const [role, setRole] = useState(party.role);
  const [name, setName] = useState(party.name);
  const [position, setPosition] = useState(party.position);
  const [idNumber, setIdNumber] = useState(party.idNumber);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(
      `/api/matters/${matterId}/parties/${party.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, name, position, idNumber }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "这位当事人没有记下。");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      onChange={() => setSaved(false)}
      className="flex flex-col gap-4 panel px-4 py-4"
    >
      <PartyFields
        role={role}
        name={name}
        position={position}
        idNumber={idNumber}
        onRole={(value) => {
          if (value === "client" || value === "ally" || value === "opposing") setRole(value);
        }}
        onName={setName}
        onPosition={setPosition}
        onIdNumber={setIdNumber}
      />
      {error ? <p className="text-sm text-seal">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "正在记下" : "记下这位"}
        </Button>
        <SavedLine show={saved} />
      </div>
    </form>
  );
}

export function PartyEditor({
  matterId,
  parties,
  editable,
}: {
  matterId: string;
  parties: PartyRecord[];
  editable: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<PartyRole>("opposing");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const people = parties.filter((party) => party.role !== "court");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/matters/${matterId}/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, name, position, idNumber }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有加上这位当事人。");
      return;
    }
    setName("");
    setPosition("");
    setIdNumber("");
    setSaved(true);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm text-foreground">当事人</h2>
      <p className="text-sm leading-6 text-muted">
        一人一行。客户是委托人。和客户同一边、但不是委托人的，记我方，例如另一名原告。对侧记对方。法院只记名称。证件号只留在这台电脑上。
      </p>
      {editable ? (
        people.map((party) => (
          <ExistingParty key={party.id} matterId={matterId} party={party} />
        ))
      ) : (
        <ul className="flex flex-col gap-2">
          {people.map((party) => (
            <li key={party.id} className="text-sm text-foreground">
              {PARTY_ROLE_LABEL[party.role]} · {party.name}
              {party.position ? ` · ${party.position}` : ""}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <form
          onSubmit={onSubmit}
          onChange={() => setSaved(false)}
          className="flex flex-col gap-4 panel px-4 py-4"
        >
          <p className="text-sm text-foreground">加上一位</p>
          <PartyFields
            role={role}
            name={name}
            position={position}
            idNumber={idNumber}
            onRole={(value) => {
              if (value === "client" || value === "ally" || value === "opposing") setRole(value);
            }}
            onName={setName}
            onPosition={setPosition}
            onIdNumber={setIdNumber}
          />
          {error ? <p className="text-sm text-seal">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "正在加上" : "加上"}
            </Button>
            <SavedLine show={saved} />
          </div>
        </form>
      ) : null}
    </section>
  );
}
