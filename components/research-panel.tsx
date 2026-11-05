"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Fold, Release } from "@/components/fold";
import { Button } from "@/components/ui/button";
import type {
  FocusRecord,
  SourceCandidate,
  SourceKind,
  SourceRecord,
} from "@/lib/types";

const KIND_LABEL: Record<SourceKind, string> = { law: "法条", case: "类案" };

const fieldClass =
  "w-full min-w-0 resize-y field";

type Result = {
  searchId: string;
  lawQuery: string;
  caseQuery: string;
  retrievedAt: string;
  candidates: SourceCandidate[];
  picked: string[];
};

export function ResearchPanel({
  matterId,
  focuses,
  sources,
}: {
  matterId: string;
  focuses: FocusRecord[];
  sources: SourceRecord[];
}) {
  const router = useRouter();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [lawQueries, setLawQueries] = useState<Record<string, string>>({});
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});

  function toggleBlock(key: string) {
    setOpenBlocks((current) => ({ ...current, [key]: !current[key] }));
  }

  function setError(focusId: string, message: string | null) {
    setErrors((current) => {
      const next = { ...current };
      if (message) next[focusId] = message;
      else delete next[focusId];
      return next;
    });
  }

  async function search(focusId: string, lawQuery: string) {
    if (!lawQuery.trim()) {
      setError(focusId, "请写下法条检索句。");
      return;
    }
    setPending(`search:${focusId}`);
    setError(focusId, null);
    const response = await fetch(`/api/matters/${matterId}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focusId, lawQuery }),
    });
    const body = (await response.json().catch(() => null)) as
      | (Omit<Result, "picked"> & { error?: string })
      | null;
    setPending(null);
    if (!response.ok || !body) {
      setError(focusId, body?.error ?? "法宝暂不可用。");
      return;
    }
    setResults((current) => ({
      ...current,
      [focusId]: { ...body, picked: [] },
    }));
  }

  function toggle(focusId: string, sourceId: string) {
    setResults((current) => {
      const result = current[focusId];
      if (!result) return current;
      const picked = result.picked.includes(sourceId)
        ? result.picked.filter((id) => id !== sourceId)
        : [...result.picked, sourceId];
      return { ...current, [focusId]: { ...result, picked } };
    });
  }

  async function accept(focusId: string) {
    const result = results[focusId];
    if (!result) return;
    setPending(`accept:${focusId}`);
    setError(focusId, null);
    const response = await fetch(`/api/matters/${matterId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchId: result.searchId,
        sourceIds: result.picked,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(null);
    if (!response.ok) {
      setError(focusId, body?.error ?? "没有收进本案。");
      return;
    }
    setResults((current) => ({
      ...current,
      [focusId]: { ...result, picked: [] },
    }));
    router.refresh();
  }

  return (
    <section id="sources" className="flex max-w-3xl scroll-mt-6 flex-col gap-4">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm text-foreground">检索</h2>
          <p className="text-sm text-muted">
            {sources.length === 0 ? "还没有出处" : `出处 ${sources.length} 条`}
          </p>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          按一条焦点查北大法宝的法条和类案。法条检索句由律师写成一个法律问题，例如「建设工程优先权什么时候可以主张」。类案按案由和焦点自动查。检索句去掉当事人名称后发出。候选不入库，勾选后才收进本案。
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {focuses.map((focus, index) => {
          const result = results[focus.id];
          const accepted = sources.filter((item) => item.focusId === focus.id);
          const acceptedIds = new Set(accepted.map((item) => item.sourceId));
          const error = errors[focus.id];
          const searching = pending === `search:${focus.id}`;
          const accepting = pending === `accept:${focus.id}`;
          const lawQuery = lawQueries[focus.id] ?? focus.lawQuery;
          const queryId = `law-query-${focus.id}`;
          return (
            <li
              key={focus.id}
              className="flex min-w-0 flex-col gap-4 panel px-4 py-4"
            >
              <div className="min-w-0">
                <p className="text-xs text-muted">焦点 {index + 1}</p>
                <p className="mt-1 break-words text-sm leading-6 text-foreground">
                  {focus.body}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor={queryId} className="text-xs text-muted">
                  法条检索句
                </label>
                <textarea
                  id={queryId}
                  rows={2}
                  maxLength={200}
                  placeholder="写成法律问题，不要写当事人和金额"
                  value={lawQuery}
                  onChange={(event) =>
                    setLawQueries((current) => ({
                      ...current,
                      [focus.id]: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
                <div>
                  <Button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => search(focus.id, lawQuery)}
                  >
                    {searching ? "正在检索" : result ? "再查一次" : "检索"}
                  </Button>
                </div>
              </div>

              {error ? <p className="text-sm text-seal">{error}</p> : null}

              {result ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted">查到 {result.candidates.length} 条</p>
                    <button
                      type="button"
                      className="text-xs font-medium text-muted hover:text-foreground"
                      onClick={() => toggleBlock(`result:${focus.id}`)}
                    >
                      {openBlocks[`result:${focus.id}`] ? "收起" : "展开"}
                    </button>
                  </div>
                  <Release open={Boolean(openBlocks[`result:${focus.id}`])}>
                  <div className="flex flex-col gap-3">
                  <div className="break-words text-xs leading-5 text-muted">
                    <p>
                      {result.retrievedAt} 检索。法条：{result.lawQuery}
                    </p>
                    <p>类案：{result.caseQuery}</p>
                  </div>
                  {!result.candidates.some((item) => item.kind === "law") ? (
                    <p className="text-sm leading-6 text-foreground">
                      没有查到具体法条。试着把法条检索句写成一个法律问题。
                    </p>
                  ) : null}
                  {result.candidates.length === 0 ? (
                    <p className="text-sm text-foreground">北大法宝没有查到。</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {result.candidates.map((item) => {
                        const already = acceptedIds.has(item.sourceId);
                        const inputId = `${focus.id}-${item.sourceId}`;
                        return (
                          <li
                            key={item.sourceId}
                            className="flex min-w-0 gap-3 border border-line bg-background px-3 py-3"
                          >
                            <input
                              id={inputId}
                              type="checkbox"
                              className="mt-1 size-4 shrink-0"
                              disabled={already || pending !== null}
                              checked={already || result.picked.includes(item.sourceId)}
                              onChange={() => toggle(focus.id, item.sourceId)}
                            />
                            <div className="min-w-0 flex-1">
                              <label
                                htmlFor={inputId}
                                className="block break-words text-sm leading-6 text-foreground"
                              >
                                <span className="text-muted">
                                  {KIND_LABEL[item.kind]}
                                </span>{" "}
                                {item.title}
                              </label>
                              <p className="break-words text-xs leading-5 text-muted">
                                {[item.status, item.detail, already ? "已收进本案" : ""]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              <Fold className="mt-2">
                                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                                  {item.text}
                                </p>
                              </Fold>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-block text-xs text-foreground underline"
                              >
                                在北大法宝打开
                              </a>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {result.candidates.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="seal"
                        disabled={pending !== null || result.picked.length === 0}
                        onClick={() => accept(focus.id)}
                      >
                        {accepting
                          ? "正在收进"
                          : `收进本案${result.picked.length ? ` ${result.picked.length} 条` : ""}`}
                      </Button>
                    </div>
                  ) : null}
                  </div>
                  </Release>
                </div>
              ) : null}

              {accepted.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted">本焦点的出处 {accepted.length} 条</p>
                    <button
                      type="button"
                      className="text-xs font-medium text-muted hover:text-foreground"
                      onClick={() => toggleBlock(`accepted:${focus.id}`)}
                    >
                      {openBlocks[`accepted:${focus.id}`] ? "收起" : "展开"}
                    </button>
                  </div>
                  <Release open={Boolean(openBlocks[`accepted:${focus.id}`])}>
                  <ul className="flex flex-col gap-2">
                    {accepted.map((item) => (
                      <li
                        key={item.id}
                        id={item.id}
                        className="scroll-mt-6 border border-line bg-background px-3 py-2"
                      >
                        <details>
                          <summary className="cursor-pointer break-words text-sm leading-6 text-foreground">
                            <span className="text-muted">{KIND_LABEL[item.kind]}</span>{" "}
                            {item.title}
                          </summary>
                          <p className="mt-1 break-words text-xs leading-5 text-muted">
                            {[item.status, item.detail, `${item.retrievedAt} 检索`, `${item.acceptedAt} 收进`]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <Fold className="mt-2">
                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                              {item.text}
                            </p>
                          </Fold>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs text-foreground underline"
                          >
                            在北大法宝打开
                          </a>
                        </details>
                      </li>
                    ))}
                  </ul>
                  </Release>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
