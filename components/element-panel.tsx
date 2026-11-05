"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Fold } from "@/components/fold";
import { Button } from "@/components/ui/button";
import { ELEMENT_KINDS } from "@/lib/constants";
import type { ElementRecord } from "@/lib/types";

const fieldClass =
  "w-full min-w-0 resize-y field";

export function ElementPanel({
  matterId,
  elements,
}: {
  matterId: string;
  elements: ElementRecord[];
}) {
  const router = useRouter();
  const confirmed =
    elements.length > 0 && elements.every((element) => element.confirmedAt);
  const [bodies, setBodies] = useState(() =>
    Object.fromEntries(elements.map((element) => [element.id, element.body])),
  );
  const [handKind, setHandKind] = useState<(typeof ELEMENT_KINDS)[number]>("事实");
  const [handBody, setHandBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"extract" | "confirm" | "hand" | null>(null);
  const open = elements.filter((element) => !element.confirmedAt);

  async function readJson(response: Response) {
    return (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
  }

  async function extract() {
    setPending("extract");
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/elements`, {
      method: "POST",
    });
    const body = await readJson(response);
    setPending(null);
    if (!response.ok) {
      setError(body?.error ?? "没有抽出要素。");
      return;
    }
    router.refresh();
  }

  async function confirm() {
    setPending("confirm");
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/elements/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: open.map((element) => ({
          id: element.id,
          body: bodies[element.id] ?? element.body,
        })),
      }),
    });
    const body = await readJson(response);
    setPending(null);
    if (!response.ok) {
      setError(body?.error ?? "没有确认要素。");
      return;
    }
    router.refresh();
  }

  async function addHand() {
    setPending("hand");
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/elements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: handKind, body: handBody }),
    });
    const body = await readJson(response);
    setPending(null);
    if (!response.ok) {
      setError(body?.error ?? "没有加上。");
      return;
    }
    setHandBody("");
    router.refresh();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm text-foreground">要素</h2>
            <p className="text-sm text-muted">
              {elements.length === 0 ? "还没有" : `${elements.length} 条`}
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            用小模型读本案已经入库的材料，以及记下的基本事实和委托事项。字段是请求、事实、金额、日期。已经确认的留着。再读会在旁边加上还没确认的新要素。模型读不出来时，仍按原文规则抽，也可以手写。
          </p>
        </div>

        {elements.length === 0 ? (
          <p className="text-sm text-muted">本案还没有要素。</p>
        ) : (
          <Fold>
            <div className="flex flex-col gap-6">
          {ELEMENT_KINDS.map((kind) => {
            const rows = elements.filter((element) => element.kind === kind);
            if (rows.length === 0) return null;
            return (
              <section key={kind} className="flex flex-col gap-3">
                <h3 className="text-sm text-foreground">{kind}</h3>
                <ul className="flex flex-col gap-3">
                  {rows.map((element) => (
                    <li
                      key={element.id}
                      id={element.id}
                      className="scroll-mt-6 panel px-4 py-4"
                    >
                      {element.confirmedAt ? (
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                          {element.body}
                        </p>
                      ) : (
                        <textarea
                          aria-label={`${kind}，来自${element.sourceLabel}`}
                          aria-required
                          rows={3}
                          value={bodies[element.id] ?? element.body}
                          onChange={(event) =>
                            setBodies((current) => ({
                              ...current,
                              [element.id]: event.target.value,
                            }))
                          }
                          className={fieldClass}
                        />
                      )}
                      <p className="mt-2 break-words text-xs text-muted">
                        来自
                        {element.sourceMaterialId ? (
                          <Link
                            href={`/matters/${matterId}/materials#${element.sourceMaterialId}`}
                            className="ml-1 text-foreground underline"
                          >
                            {element.sourceLabel}
                          </Link>
                        ) : (
                          <span className="ml-1">{element.sourceLabel}</span>
                        )}
                        {element.confirmedAt ? ` · 已于 ${element.confirmedAt} 确认` : " · 还没确认"}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
            </div>
          </Fold>
        )}

        <div className="flex flex-col gap-3 panel px-4 py-4">
          <p className="text-sm text-foreground">手写一条</p>
          <label className="min-w-0 text-xs text-muted">
            种类
            <select
              value={handKind}
              onChange={(event) =>
                setHandKind(event.target.value as (typeof ELEMENT_KINDS)[number])
              }
              className="mt-2 w-full min-w-0 field"
            >
              {ELEMENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </label>
          <textarea
            aria-label="手写要素"
            rows={3}
            value={handBody}
            onChange={(event) => setHandBody(event.target.value)}
            className={fieldClass}
          />
          <Button type="button" variant="outline" disabled={pending !== null} onClick={addHand}>
            {pending === "hand" ? "正在加上" : "加上"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={pending !== null} onClick={extract}>
            {pending === "extract"
              ? "正在读"
              : elements.length === 0
                ? "抽出要素"
                : confirmed
                  ? "再读新材料"
                  : "再读一次"}
          </Button>
          {open.length > 0 ? (
            <Button type="button" variant="seal" disabled={pending !== null} onClick={confirm}>
              {pending === "confirm" ? "正在确认" : "确认还没确认的"}
            </Button>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-muted">
          再读一次会换掉还没确认的要素。已经确认的留在原处。全部确认之后，才可以新加焦点。
        </p>
        {error ? <p className="text-sm text-seal">{error}</p> : null}
      </section>
    </div>
  );
}
