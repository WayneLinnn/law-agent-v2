"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Fold } from "@/components/fold";
import { Button } from "@/components/ui/button";
import type { AskHit, MatterAskRecord } from "@/lib/types";

const fieldClass =
  "mt-2 w-full min-w-0 field";

function HitList({ label, items }: { label: string; items: AskHit[] }) {
  return (
    <div>
      <h3 className="text-sm text-foreground">
        {label}
        <span className="ml-2 text-muted">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">没有。</p>
      ) : (
        <Fold className="mt-2" fade="from-background">
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <li key={`${item.url}-${index}`} className="panel px-4 py-3">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block break-words text-sm leading-6 text-foreground underline"
              >
                {item.title}
              </a>
              {item.detail ? (
                <p className="mt-1 break-words text-xs leading-5 text-muted">{item.detail}</p>
              ) : null}
              <Fold className="mt-2" fade="from-surface">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                  {item.text}
                </p>
              </Fold>
            </li>
          ))}
        </ul>
        </Fold>
      )}
    </div>
  );
}

export function AskPanel({ desk = false, matterId }: { desk?: boolean; matterId?: string }) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<"lookup" | "answer" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [laws, setLaws] = useState<AskHit[]>([]);
  const [cases, setCases] = useState<AskHit[]>([]);
  const [lookedUp, setLookedUp] = useState(false);
  const [saved, setSaved] = useState<MatterAskRecord[]>([]);

  useEffect(() => {
    if (!matterId) return;
    let cancel = false;
    void fetch(`/api/matters/${matterId}/asks`)
      .then((response) => response.json())
      .then((result: { items?: MatterAskRecord[] }) => {
        if (!cancel) setSaved(result.items ?? []);
      })
      .catch(() => {
        if (!cancel) setSaved([]);
      });
    return () => {
      cancel = true;
    };
  }, [matterId]);

  async function run(lookup: boolean) {
    setPending(lookup ? "lookup" : "answer");
    setError(null);
    setAnswer(null);
    setLookedUp(false);
    const response = await fetch(matterId ? `/api/matters/${matterId}/asks` : "/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, lookup }),
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
      answer?: string | null;
      laws?: AskHit[];
      cases?: AskHit[];
      id?: string;
      question?: string;
      mode?: "lookup" | "answer";
      createdAt?: string;
    } | null;
    setPending(null);
    if (!response.ok || !result) {
      setLaws(result?.laws ?? []);
      setCases(result?.cases ?? []);
      setError(result?.error ?? "没有检索到。");
      return;
    }
    if (matterId && result.id && result.question && result.mode && result.createdAt) {
      const record: MatterAskRecord = {
        id: result.id,
        question: result.question,
        mode: result.mode,
        answer: result.answer ?? "",
        laws: result.laws ?? [],
        cases: result.cases ?? [],
        createdAt: result.createdAt,
      };
      setSaved((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setQuestion("");
      return;
    }
    setLaws(result.laws ?? []);
    setCases(result.cases ?? []);
    if (lookup) {
      setLookedUp(true);
      return;
    }
    setAnswer(result.answer ?? "");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const lookup = submitter instanceof HTMLButtonElement && submitter.value === "lookup";
    void run(lookup);
  }

  const shown = answer !== null || laws.length > 0 || cases.length > 0;

  return (
    <section className={matterId || desk ? "flex min-w-0 flex-col gap-4" : "mt-8 flex max-w-3xl flex-col gap-4"}>
      <div>
        <h2 className="font-serif text-xl tracking-tight text-foreground">法律问题</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {matterId
            ? "查法条案例只列出北大法宝的法条和案例，不经过模型。检索回答会再据此写一段话。两次结果都记在本案。发出前会去掉身份证号、电话、地址和公司名。不要把当事人姓名写进问题。"
            : "查法条案例只列出北大法宝的法条和案例，不经过模型。检索回答会再据此写一段话。不写入任何案子。发出前会去掉身份证号、电话、地址和公司名。不要把当事人姓名写进问题。"}
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="min-w-0 text-xs text-muted">
          问题
          <textarea
            value={question}
            rows={matterId ? 4 : desk ? 6 : 3}
            disabled={pending !== null}
            onChange={(event) => setQuestion(event.target.value)}
            className={fieldClass}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="mode" value="lookup" variant="outline" disabled={pending !== null}>
            {pending === "lookup" ? "正在检索" : "查法条案例"}
          </Button>
          <Button type="submit" name="mode" value="answer" disabled={pending !== null}>
            {pending === "answer" ? "正在回答" : "检索回答"}
          </Button>
        </div>
      </form>
      {error ? <p className="text-sm text-seal">{error}</p> : null}
      {lookedUp && laws.length === 0 && cases.length === 0 ? (
        <p className="text-sm text-foreground">没有检索到现行有效的法条或案例。</p>
      ) : null}
      {answer ? (
        <Fold>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {answer}
          </p>
        </Fold>
      ) : null}
      {shown ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <HitList label="法条" items={laws} />
          <HitList label="案例" items={cases} />
        </div>
      ) : null}
      {matterId ? (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <h3 className="text-sm font-medium text-foreground">本案已记下</h3>
          {saved.length === 0 ? (
            <p className="text-sm text-muted">还没有。</p>
          ) : (
            saved.map((item) => (
              <article key={item.id} className="flex flex-col gap-2">
                <p className="text-xs text-muted">
                  {item.createdAt} · {item.mode === "lookup" ? "查法条案例" : "检索回答"}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{item.question}</p>
                {item.answer ? (
                  <Fold>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{item.answer}</p>
                  </Fold>
                ) : null}
                {item.mode === "lookup" && item.laws.length === 0 && item.cases.length === 0 ? (
                  <p className="text-sm text-foreground">没有检索到现行有效的法条或案例。</p>
                ) : null}
                {item.laws.length > 0 || item.cases.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    <HitList label="法条" items={item.laws} />
                    <HitList label="案例" items={item.cases} />
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
