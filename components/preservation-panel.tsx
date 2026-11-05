"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SavedLine } from "@/components/saved-line";
import { Button } from "@/components/ui/button";

type PreservationRecord = {
  status: "" | "未保全" | "已保全";
  subject: string;
  court: string;
  preservedOn: string;
};

const fieldClass =
  "mt-2 w-full min-w-0 field";

export function PreservationPanel({
  matterId,
  record,
  editable,
}: {
  matterId: string;
  record: PreservationRecord;
  editable: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(record.status);
  const [subject, setSubject] = useState(record.subject);
  const [court, setCourt] = useState(record.court);
  const [preservedOn, setPreservedOn] = useState(record.preservedOn);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/matters/${matterId}/preservation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, subject, court, preservedOn }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "保全没有记下。");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const summary = [
    record.status,
    record.subject,
    record.court,
    record.preservedOn,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm text-foreground">保全</h2>
      <p className="text-sm leading-6 text-muted">
        记现在有没有保全。有日期的保全仍可以另记一条待办。
      </p>
      {editable ? (
        <form
          onSubmit={save}
          onChange={() => setSaved(false)}
          className="flex flex-col gap-4 panel px-4 py-4"
        >
          <label className="min-w-0 text-xs text-muted">
            状态
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as PreservationRecord["status"])}
              className={fieldClass}
            >
              <option value="">未填写</option>
              <option value="未保全">未保全</option>
              <option value="已保全">已保全</option>
            </select>
          </label>
          {status === "已保全" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="min-w-0 text-xs text-muted sm:col-span-2">
                保全了什么
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  autoComplete="off"
                  className={fieldClass}
                />
              </label>
              <label className="min-w-0 text-xs text-muted">
                哪个法院
                <input
                  value={court}
                  onChange={(event) => setCourt(event.target.value)}
                  autoComplete="off"
                  className={fieldClass}
                />
              </label>
              <label className="min-w-0 text-xs text-muted">
                日期
                <input
                  type="date"
                  value={preservedOn}
                  onChange={(event) => setPreservedOn(event.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>
          ) : null}
          {error ? <p className="text-sm text-seal">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending || !status}>
              {pending ? "正在记下" : "记下保全"}
            </Button>
            <SavedLine show={saved} />
          </div>
        </form>
      ) : (
        <p className="text-sm text-foreground">{summary || "未填写"}</p>
      )}
    </section>
  );
}
