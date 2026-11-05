"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SavedLine } from "@/components/saved-line";
import { Button } from "@/components/ui/button";
import type { CourtOfficer, JudgeRecord } from "@/lib/types";

const fieldClass =
  "mt-2 w-full min-w-0 field";

export function CourtPanel({
  matterId,
  instance,
  courtName,
  officer,
  judges,
  editable,
}: {
  matterId: string;
  instance: string;
  courtName: string;
  officer: CourtOfficer;
  judges: JudgeRecord[];
  editable: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(courtName);
  const [judge, setJudge] = useState(officer.judge);
  const [assistant, setAssistant] = useState(officer.assistant);
  const [clerk, setClerk] = useState(officer.clerk);
  const [division, setDivision] = useState(officer.division);
  const [contact, setContact] = useState(officer.contact);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [directoryPending, setDirectoryPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [directorySaved, setDirectorySaved] = useState(false);
  const filled = [courtName, officer.judge, officer.assistant, officer.clerk, officer.division, officer.contact].some(
    Boolean,
  );

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/matters/${matterId}/court`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courtName: name, judge, assistant, clerk, division, contact }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "法院承办人没有记下。");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  function chooseJudge(id: string) {
    const found = judges.find((item) => item.id === id);
    if (!found) return;
    setJudge(found.name);
    setDivision(found.division);
    setContact(found.phone);
  }

  async function remember() {
    setDirectoryPending(true);
    setError(null);
    setDirectorySaved(false);
    const response = await fetch("/api/judges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: judge, division, phone: contact }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setDirectoryPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有记入通讯录。");
      return;
    }
    setDirectorySaved(true);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm text-foreground">
        法院承办人{instance ? ` · ${instance}` : ""}
      </h2>
      <p className="text-sm leading-6 text-muted">记法院这边的人。另开的审级各自填写。</p>
      {editable ? (
        <form
          onSubmit={save}
          onChange={() => {
            setSaved(false);
            setDirectorySaved(false);
          }}
          className="grid grid-cols-1 gap-4 panel px-4 py-4 sm:grid-cols-2"
        >
          <label className="min-w-0 text-xs text-muted sm:col-span-2">
            法院
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              placeholder="可以先空着"
              className={fieldClass}
            />
          </label>
          <label className="min-w-0 text-xs text-muted sm:col-span-2">
            从通讯录选用
            <select
              value=""
              onChange={(event) => chooseJudge(event.target.value)}
              className={fieldClass}
            >
              <option value="">不选用</option>
              {judges.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.division ? `${item.name} · ${item.division}` : item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-muted">
            承办法官
            <input
              value={judge}
              onChange={(event) => setJudge(event.target.value)}
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          <label className="min-w-0 text-xs text-muted">
            法官助理
            <input
              value={assistant}
              onChange={(event) => setAssistant(event.target.value)}
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          <label className="min-w-0 text-xs text-muted">
            书记员
            <input
              value={clerk}
              onChange={(event) => setClerk(event.target.value)}
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
            联系方式
            <input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          {error ? <p className="text-sm text-seal sm:col-span-2">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={pending || directoryPending}>
              {pending ? "正在记下" : "记下法院"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending || directoryPending}
              onClick={remember}
            >
              {directoryPending ? "正在记下" : "记入通讯录"}
            </Button>
            <SavedLine show={saved || directorySaved} />
          </div>
        </form>
      ) : filled ? (
        <p className="break-words text-sm leading-6 text-foreground">
          {[
            courtName,
            officer.judge ? `承办法官 ${officer.judge}` : "",
            officer.assistant ? `法官助理 ${officer.assistant}` : "",
            officer.clerk ? `书记员 ${officer.clerk}` : "",
            officer.division,
            officer.contact,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : (
        <p className="text-sm text-muted">未填写</p>
      )}
    </section>
  );
}
