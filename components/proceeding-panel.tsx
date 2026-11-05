"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SavedLine } from "@/components/saved-line";
import { Button } from "@/components/ui/button";
import { categoryFromCause } from "@/lib/causes";
import { CASE_CATEGORIES, INSTANCES, PROCEDURES } from "@/lib/constants";
import type { ProceedingLink } from "@/lib/types";

const fieldClass =
  "mt-2 w-full min-w-0 field";

export function ProceedingPanel({
  matterId,
  caseNumber,
  category,
  cause,
  engagedOn,
  instance,
  procedure,
  editable,
  canOpen,
  parent,
  children,
}: {
  matterId: string;
  caseNumber: string;
  category: string;
  cause: string;
  engagedOn: string;
  instance: string;
  procedure: string;
  editable: boolean;
  canOpen: boolean;
  parent: ProceedingLink | null;
  children: ProceedingLink[];
}) {
  const router = useRouter();
  const [number, setNumber] = useState(caseNumber);
  const [kind, setKind] = useState(category || categoryFromCause(cause));
  const [engaged, setEngaged] = useState(engagedOn);
  const [level, setLevel] = useState(instance);
  const [mode, setMode] = useState(procedure);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/matters/${matterId}/proceeding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseNumber: number,
        category: kind,
        engagedOn: engaged,
        instance: level,
        procedure: mode,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "程序没有记下。");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function openNext(next: "二审" | "再审" | "执行") {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/proceeding/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instance: next }),
    });
    const body = (await response.json().catch(() => null)) as {
      id?: string;
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok || !body?.id) {
      setError(body?.error ?? "没有另开程序。");
      return;
    }
    router.push(`/matters/${body.id}`);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm text-foreground">程序</h2>
      {parent ? (
        <p className="text-sm leading-6 text-foreground">
          来自{" "}
          <a href={`/matters/${parent.id}`} className="underline">
            {parent.name}
          </a>
          {parent.caseNumber ? ` · ${parent.caseNumber}` : ""}
        </p>
      ) : null}
      {editable ? (
        <form
          onSubmit={save}
          onChange={() => setSaved(false)}
          className="flex flex-col gap-4 panel px-4 py-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-xs text-muted">
              类型
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                className={fieldClass}
              >
                <option value="">未填写</option>
                {CASE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-xs text-muted">
              委托日期
              <input
                type="date"
                value={engaged}
                onChange={(event) => setEngaged(event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
          <label className="min-w-0 text-xs text-muted">
            案号
            <input
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              autoComplete="off"
              placeholder="可以先空着"
              className={fieldClass}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-xs text-muted">
              审级
              <select
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                className={fieldClass}
              >
                <option value="">未填写</option>
                {INSTANCES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 text-xs text-muted">
              程序
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value)}
                className={fieldClass}
              >
                <option value="">未填写</option>
                {PROCEDURES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-sm leading-6 text-muted">
            案由能对上时，类型会先填上，可以改。
          </p>
          {error ? <p className="text-sm text-seal">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "正在记下" : "记下程序"}
            </Button>
            <SavedLine show={saved} />
          </div>
        </form>
      ) : (
        <p className="text-sm leading-6 text-foreground">
          {[
            category,
            engagedOn ? `委托 ${engagedOn}` : "",
            instance,
            procedure,
            caseNumber,
          ]
            .filter(Boolean)
            .join(" · ") || "未填写"}
        </p>
      )}
      {canOpen ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-6 text-muted">
            上诉、再审或进入执行时另开一件草稿，原来的案子状态不变。二审和再审的诉讼地位留空，由律师填写。执行沿用原来的诉讼地位。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => openNext("二审")}
            >
              另开二审
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => openNext("再审")}
            >
              另开再审
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => openNext("执行")}
            >
              另开执行
            </Button>
          </div>
          {error && !editable ? (
            <p className="text-sm text-seal">{error}</p>
          ) : null}
        </div>
      ) : null}
      {children.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {children.map((child) => (
            <li key={child.id} className="text-sm text-foreground">
              <a href={`/matters/${child.id}`} className="underline">
                {child.instance || "程序"} · {child.name}
              </a>
              <span className="text-muted"> · {child.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
