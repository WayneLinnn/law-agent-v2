"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SavedLine } from "@/components/saved-line";
import { Button } from "@/components/ui/button";
import type { JudgeRecord } from "@/lib/types";

const fieldClass =
  "mt-2 w-full min-w-0 field";

export function JudgeDirectory({ judges }: { judges: JudgeRecord[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [division, setDivision] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch("/api/judges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, division, phone }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有记下这位法官。");
      return;
    }
    setName("");
    setDivision("");
    setPhone("");
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mt-8 flex max-w-3xl flex-col gap-6">
      <form
        onSubmit={create}
        onChange={() => setSaved(false)}
        className="grid grid-cols-1 gap-4 panel px-4 py-4 sm:grid-cols-2"
      >
        <label className="min-w-0 text-xs text-muted">
          姓名
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            className={fieldClass}
          />
        </label>
        <label className="min-w-0 text-xs text-muted">
          庭室
          <input
            value={division}
            onChange={(event) => setDivision(event.target.value)}
            autoComplete="off"
            className={fieldClass}
          />
        </label>
        <label className="min-w-0 text-xs text-muted sm:col-span-2">
          电话
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="off"
            className={fieldClass}
          />
        </label>
        {error ? <p className="text-sm text-seal sm:col-span-2">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "正在记下" : "记下"}
          </Button>
          <SavedLine show={saved} />
        </div>
      </form>
      {judges.length === 0 ? (
        <p className="text-sm text-muted">还没有法官。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {judges.map((judge) => (
            <JudgeRow key={judge.id} judge={judge} />
          ))}
        </ul>
      )}
    </div>
  );
}

function JudgeRow({ judge }: { judge: JudgeRecord }) {
  const router = useRouter();
  const [name, setName] = useState(judge.name);
  const [division, setDivision] = useState(judge.division);
  const [phone, setPhone] = useState(judge.phone);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function send(remove: boolean) {
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/judges/${judge.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(remove ? { remove: true } : { name, division, phone }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有改这位法官。");
      return;
    }
    if (!remove) setSaved(true);
    router.refresh();
  }

  return (
    <li className="grid grid-cols-1 gap-4 panel px-4 py-4 sm:grid-cols-2">
      <label className="min-w-0 text-xs text-muted">
        姓名
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          className={fieldClass}
        />
      </label>
      <label className="min-w-0 text-xs text-muted">
        庭室
        <input
          value={division}
          onChange={(event) => setDivision(event.target.value)}
          autoComplete="off"
          className={fieldClass}
        />
      </label>
      <label className="min-w-0 text-xs text-muted sm:col-span-2">
        电话
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="off"
          className={fieldClass}
        />
      </label>
      {error ? <p className="text-sm text-seal sm:col-span-2">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="button" disabled={pending} onClick={() => send(false)}>
          {pending ? "正在记下" : "改这位"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => send(true)}>
          去掉
        </Button>
        <SavedLine show={saved} />
      </div>
    </li>
  );
}
