"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Fold } from "@/components/fold";
import { Button } from "@/components/ui/button";
import { ELEMENTS_UNCONFIRMED, FOCUS_UNCONFIRMED } from "@/lib/constants";
import type { FocusRecord } from "@/lib/types";

const fieldClass =
  "w-full min-w-0 resize-y field";

type Draft = { key: string; id: string | null; body: string; lawQuery: string };

function rowsFrom(focuses: FocusRecord[]): Draft[] {
  if (focuses.length === 0) return [{ key: "blank", id: null, body: "", lawQuery: "" }];
  return focuses.map((focus) => ({
    key: focus.id,
    id: focus.id,
    body: focus.body,
    lawQuery: focus.lawQuery,
  }));
}

export function FocusPanel({
  matterId,
  focuses,
  elementsConfirmed,
}: {
  matterId: string;
  focuses: FocusRecord[];
  elementsConfirmed: boolean;
}) {
  const router = useRouter();
  const confirmed =
    focuses.length > 0 && focuses.every((focus) => focus.confirmedAt);
  const confirmedAt = confirmed ? focuses[0]?.confirmedAt : null;
  const signature = focuses
    .map((focus) => `${focus.id}:${focus.body}:${focus.lawQuery}:${focus.confirmedAt ?? ""}`)
    .join("|");
  const [seen, setSeen] = useState(signature);
  const [rows, setRows] = useState<Draft[]>(() => rowsFrom(focuses));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"list" | "confirm" | "propose" | "delete" | null>(null);
  if (seen !== signature) {
    setSeen(signature);
    setRows(rowsFrom(focuses));
    setError(null);
  }

  const savedById = new Map(focuses.map((focus) => [focus.id, focus]));
  const dirty = rows.some((row) => {
    if (!row.id) return true;
    const saved = savedById.get(row.id);
    return !saved || saved.body !== row.body || saved.lawQuery !== row.lawQuery;
  });
  const canConfirm =
    !dirty && rows.some((row) => row.id && !savedById.get(row.id)?.confirmedAt);

  async function readJson(response: Response) {
    return (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
  }

  async function list() {
    setPending("list");
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/focuses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: rows.map((row) => ({
          id: row.id ?? undefined,
          body: row.body,
          lawQuery: row.lawQuery,
        })),
      }),
    });
    const body = await readJson(response);
    setPending(null);
    if (!response.ok) {
      setError(body?.error ?? "没有列出焦点。");
      return;
    }
    router.refresh();
  }

  async function confirm() {
    setPending("confirm");
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/focuses/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: rows
          .filter((row) => {
            const saved = focuses.find((focus) => focus.id === row.id);
            return saved && !saved.confirmedAt;
          })
          .map((row) => ({ id: row.id, body: row.body, lawQuery: row.lawQuery })),
      }),
    });
    const body = await readJson(response);
    setPending(null);
    if (!response.ok) {
      setError(body?.error ?? "没有确认焦点。");
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    setPending("delete");
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/focuses/${id}`, {
      method: "DELETE",
    });
    const body = await readJson(response);
    setPending(null);
    if (!response.ok) {
      setError(body?.error ?? "没有删掉这条焦点。");
      return;
    }
    router.refresh();
  }

  async function propose() {
    setPending("propose");
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/focuses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propose: true }),
    });
    const body = await readJson(response);
    setPending(null);
    if (!response.ok) {
      setError(body?.error ?? "没有归纳出焦点。");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm text-foreground">定焦点</h2>
            <p className="text-sm text-muted">
              {focuses.length === 0 ? "还没有" : `${focuses.length} 条`}
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            从已确认的要素和已读材料归纳，一次最多三条，只留和本案请求直接相关的争议。诉讼费承担、程序事项不写进来。每条再配一条不含当事人、不含金额的法条检索句。改完再确认。删除一条时，这条焦点已经收进的出处一并去掉。模型不可用时手写。归纳不会自动检索。
          </p>
        </div>

        {elementsConfirmed ? (
          <Fold limit={220} collapsedClass="max-h-56">
          <ul className="flex flex-col gap-3">
            {rows.map((row, index) => {
              const saved = row.id ? savedById.get(row.id) : undefined;
              return (
                <li
                  key={row.key}
                  id={row.id ?? undefined}
                  className="scroll-mt-6 panel px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor={`focus-${row.key}`} className="text-xs text-muted">
                      焦点 {index + 1}
                      {saved?.confirmedAt ? ` · 已于 ${saved.confirmedAt} 确认` : ""}
                    </label>
                    {row.id ? (
                      <button
                        type="button"
                        className="text-xs text-seal underline-offset-4 hover:underline"
                        disabled={pending !== null}
                        onClick={() => remove(row.id!)}
                      >
                        删除
                      </button>
                    ) : rows.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs text-foreground underline"
                        onClick={() =>
                          setRows((current) =>
                            current.filter((item) => item.key !== row.key),
                          )
                        }
                      >
                        去掉
                      </button>
                    ) : null}
                  </div>
                  <textarea
                    id={`focus-${row.key}`}
                    aria-label={`焦点 ${index + 1}`}
                    aria-required
                    rows={3}
                    value={row.body}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) =>
                          item.key === row.key
                            ? { ...item, body: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className={`${fieldClass} mt-2`}
                  />
                  <label htmlFor={`law-${row.key}`} className="mt-3 block text-xs text-muted">
                    法条检索句
                  </label>
                  <textarea
                    id={`law-${row.key}`}
                    aria-required
                    rows={2}
                    maxLength={200}
                    placeholder="写成法律问题，不要写当事人和金额"
                    value={row.lawQuery}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((item) =>
                          item.key === row.key
                            ? { ...item, lawQuery: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className={`${fieldClass} mt-2`}
                  />
                </li>
              );
            })}
          </ul>
          </Fold>
        ) : focuses.length > 0 ? (
          <Fold>
          <ul className="flex flex-col gap-3">
            {focuses.map((focus, index) => (
              <li
                key={focus.id}
                id={focus.id}
                className="scroll-mt-6 panel px-4 py-4"
              >
                <p className="text-xs text-muted">
                  焦点 {index + 1}
                  {focus.confirmedAt ? ` · 已于 ${focus.confirmedAt} 确认` : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                  {focus.body}
                </p>
                {focus.lawQuery ? (
                  <p className="mt-2 break-words text-sm leading-6 text-muted">
                    法条检索句：{focus.lawQuery}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          </Fold>
        ) : null}
        {!elementsConfirmed ? (
          <p className="text-sm leading-6 text-foreground">{ELEMENTS_UNCONFIRMED}</p>
        ) : null}

        {elementsConfirmed ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" disabled={pending !== null} onClick={propose}>
              {pending === "propose" ? "正在归纳" : "归纳焦点"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending !== null}
              onClick={() =>
                setRows((current) => [
                  ...current,
                  { key: crypto.randomUUID(), id: null, body: "", lawQuery: "" },
                ])
              }
            >
              再加一条
            </Button>
            <Button type="button" disabled={pending !== null} onClick={list}>
              {pending === "list" ? "正在记下" : focuses.length === 0 ? "列出" : "记下"}
            </Button>
            {canConfirm ? (
              <Button type="button" variant="seal" disabled={pending !== null} onClick={confirm}>
                {pending === "confirm" ? "正在确认" : "确认新焦点"}
              </Button>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="text-sm text-seal">{error}</p> : null}
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-sm leading-6 text-foreground">
          {confirmed ? (
            <>
              焦点已于 {confirmedAt} 确认。下面可以检索，然后
              <a href="#drafts" className="underline">
                去起草
              </a>
              。
            </>
          ) : focuses.some((focus) => focus.confirmedAt) ? (
            "新加的焦点确认之后，才能检索这一条。已经确认的焦点仍可检索。"
          ) : (
            FOCUS_UNCONFIRMED
          )}
        </p>
      </section>
    </div>
  );
}
