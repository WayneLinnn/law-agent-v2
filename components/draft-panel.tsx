"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Fold, Release } from "@/components/fold";
import { Button } from "@/components/ui/button";
import { DRAFT_KINDS, type MatterStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  DraftKind,
  DraftRecord,
  DraftWarning,
  ElementRecord,
  SourceRecord,
} from "@/lib/types";

const fieldClass =
  "w-full min-w-0 resize-y field";

const LEVEL: Record<DraftWarning["level"], { label: string; className: string }> = {
  block: { label: "要改", className: "text-seal" },
  warn: { label: "提示", className: "text-foreground" },
  info: { label: "参考", className: "text-muted" },
};

const TAG_SPLIT_RE = /(【[^】]{1,40}】)/;
const TAG_TOKEN_RE = /([SE])(\d+)/g;

type Work = {
  kind: DraftKind;
  body: string;
  sourceIds: string[];
  elementIds: string[];
  warnings: DraftWarning[];
  checkedBody: string;
  basedOn: number | null;
  readOnly: boolean;
};

function workFrom(draft: DraftRecord, readOnly: boolean): Work {
  return {
    kind: draft.kind,
    body: draft.body,
    sourceIds: draft.sourceIds,
    elementIds: draft.elementIds,
    warnings: draft.warnings,
    checkedBody: draft.body,
    basedOn: draft.version,
    readOnly,
  };
}

function WarningLine({ warning }: { warning: DraftWarning }) {
  const level = LEVEL[warning.level];
  return (
    <p className={`break-words text-xs leading-5 ${level.className}`}>
      {level.label}
      {warning.quote ? `：${warning.quote}` : ""}。{warning.text}
      {warning.url ? (
        <>
          {" "}
          <a href={warning.url} target="_blank" rel="noreferrer" className="underline">
            在北大法宝打开
          </a>
        </>
      ) : null}
    </p>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 text-sm text-muted transition-transform duration-300",
        open && "rotate-90",
      )}
    >
      ›
    </span>
  );
}

export function DraftPanel({
  matterId,
  status,
  sources,
  elements,
  drafts,
}: {
  matterId: string;
  status: MatterStatus;
  sources: SourceRecord[];
  elements: ElementRecord[];
  drafts: DraftRecord[];
}) {
  const router = useRouter();
  const editable = status === "办理中";
  const finalDraft = drafts.find((draft) => draft.final) ?? null;
  const [kind, setKind] = useState<DraftKind>("意见书");
  const [work, setWork] = useState<Work | null>(null);
  const [view, setView] = useState<"edit" | "compare">("edit");
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const refSources = (work?.sourceIds ?? []).map((id) => sourceById.get(id));
  const refElements = (work?.elementIds ?? []).map((id) => elementById.get(id));
  const blocks = work?.warnings.filter((warning) => warning.level === "block").length ?? 0;
  const stale = work !== null && work.body !== work.checkedBody;

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function reveal(next: Work, mode: "edit" | "compare") {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setWork(next);
    setView(mode);
    setPanelOpen(false);
    requestAnimationFrame(() => setPanelOpen(true));
  }

  function hide() {
    setPanelOpen(false);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setWork(null);
      setPanelOpen(false);
      closeTimer.current = null;
    }, 540);
  }

  async function post(path: string, payload?: unknown) {
    const response = await fetch(`/api/matters/${matterId}${path}`, {
      method: "POST",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: response.ok, body };
  }

  async function generate() {
    if (work && !work.readOnly && work.body !== work.checkedBody) {
      if (!window.confirm("正文改过还没有接受。重新起草会丢掉这些修改。")) return;
    }
    setPending("generate");
    setError(null);
    setNote(null);
    const { ok, body } = await post("/draft", { kind });
    setPending(null);
    if (!ok || !body) {
      setError((body?.error as string) ?? "起草模型暂不可用。");
      return;
    }
    const text = body.body as string;
    reveal(
      {
        kind,
        body: text,
        sourceIds: body.sourceIds as string[],
        elementIds: body.elementIds as string[],
        warnings: body.warnings as DraftWarning[],
        checkedBody: text,
        basedOn: null,
        readOnly: false,
      },
      "compare",
    );
  }

  async function recheck() {
    if (!work) return;
    setPending("check");
    setError(null);
    setNote(null);
    const sent = work.body;
    const { ok, body } = await post("/drafts/check", {
      body: sent,
      sourceIds: work.sourceIds,
      elementIds: work.elementIds,
    });
    setPending(null);
    if (!ok || !body) {
      setError((body?.error as string) ?? "没有核对。");
      return;
    }
    setWork((current) =>
      current && { ...current, warnings: body.warnings as DraftWarning[], checkedBody: sent },
    );
  }

  async function accept() {
    if (!work) return;
    setPending("accept");
    setError(null);
    setNote(null);
    const { ok, body } = await post("/drafts", {
      kind: work.kind,
      body: work.body,
      sourceIds: work.sourceIds,
      elementIds: work.elementIds,
      basedOn: work.basedOn,
    });
    setPending(null);
    if (!ok || !body) {
      setError((body?.error as string) ?? "没有接受。");
      return;
    }
    setWork(null);
    setPanelOpen(false);
    setNote(`已存为第 ${body.version as number} 版。`);
    router.refresh();
  }

  async function finalize(draft: DraftRecord) {
    setPending(`final:${draft.id}`);
    setError(null);
    setNote(null);
    const { ok, body } = await post(`/drafts/${draft.id}/final`);
    setPending(null);
    if (!ok || !body) {
      setError((body?.error as string) ?? "没有定稿。");
      if (Array.isArray(body?.warnings)) {
        reveal({ ...workFrom(draft, false), warnings: body.warnings as DraftWarning[] }, "compare");
      }
      return;
    }
    setWork(null);
    setPanelOpen(false);
    setNote(`第 ${draft.version} 版已由律师定稿，存为第 ${body.version as number} 版。`);
    router.refresh();
  }

  function showRef(key: string) {
    setOpenRef(key);
    requestAnimationFrame(() =>
      document.getElementById(`ref-${key}`)?.scrollIntoView({ block: "nearest" }),
    );
  }

  function renderLine(text: string, line: number) {
    const parts = text.split(TAG_SPLIT_RE);
    return parts.map((part, index) => {
      if (index % 2 === 0) return part;
      const tokens = [...part.matchAll(TAG_TOKEN_RE)];
      if (tokens.length === 0) return part;
      return tokens.map((token) => {
        const key = `${token[1]}${token[2]}`;
        return (
          <button
            key={`${line}-${index}-${key}`}
            type="button"
            onClick={() => showRef(key)}
            className={`mx-0.5 border px-1 text-xs leading-5 ${
              openRef === key ? "border-foreground text-foreground" : "border-line text-muted"
            }`}
          >
            {key}
          </button>
        );
      });
    });
  }

  return (
    <section id="drafts" className="flex scroll-mt-6 flex-col gap-4">
      <div className="max-w-3xl">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm text-foreground">起草</h2>
          <p className="text-sm text-muted">
            {finalDraft
              ? `律师定稿 第 ${finalDraft.version} 版 ${finalDraft.createdAt}`
              : drafts.length === 0
                ? "还没有版本"
                : `${drafts.length} 版`}
          </p>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          文书由模型按本案要素、焦点和收进的出处写初稿，起草时不再检索。每段末尾标出依据：E 是要素，S 是出处。核对时查北大法宝，查不到的条号和案号标为疑似编造，不能定稿。律师改完接受，成为新的一版；律师定稿单独存一版。定稿后案件仍在办理中。
        </p>
      </div>

      {editable ? (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted">文书种类
            <select className="ml-2 panel px-2 py-2 text-sm text-foreground" value={kind} onChange={(event) => setKind(event.target.value as DraftKind)} disabled={pending !== null}>
              {DRAFT_KINDS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <Button type="button" disabled={pending !== null} onClick={generate}>
            {pending === "generate" ? "正在起草" : work && !work.readOnly ? "重新起草" : `起草${kind}`}
          </Button>
          {pending === "generate" ? (
            <p className="text-sm text-muted">大约要一两分钟，请留在这一页。</p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="max-w-3xl text-sm text-seal">{error}</p> : null}
      {note ? <p className="max-w-3xl text-sm text-done">{note}</p> : null}

      {work ? (
        <Release open={panelOpen} fade>
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-4 text-sm">
              {(work.readOnly ? (["compare"] as const) : (["edit", "compare"] as const)).map(
                (mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setView(mode)}
                    className={
                      view === mode || work.readOnly
                        ? "text-foreground underline underline-offset-4"
                        : "text-muted"
                    }
                  >
                    {mode === "edit" ? "改正文" : "对照出处"}
                  </button>
                ),
              )}
              {work.basedOn ? (
                <span className="text-xs text-muted">从第 {work.basedOn} 版载入</span>
              ) : (
                <span className="text-xs text-muted">新初稿，还没有存</span>
              )}
            </div>

            {view === "edit" && !work.readOnly ? (
              <textarea
                aria-label={`${work.kind}正文`}
                rows={24}
                value={work.body}
                onChange={(event) =>
                  setWork((current) => current && { ...current, body: event.target.value })
                }
                className={fieldClass}
              />
            ) : (
              <Fold>
              <div className="flex flex-col gap-2 panel px-4 py-4">
                {work.warnings
                  .filter((warning) => warning.line < 0)
                  .map((warning, index) => (
                    <WarningLine key={`top-${index}`} warning={warning} />
                  ))}
                {work.body.split("\n").map((text, line) =>
                  text.trim() ? (
                    <div key={line} className="min-w-0">
                      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                        {renderLine(text, line)}
                      </p>
                      {stale
                        ? null
                        : work.warnings
                            .filter((warning) => warning.line === line)
                            .map((warning, index) => (
                              <WarningLine key={`${line}-${index}`} warning={warning} />
                            ))}
                    </div>
                  ) : null,
                )}
              </div>
              </Fold>
            )}

            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted">
                {stale
                  ? "正文改过，核对结果已经过时，请再核对一次。"
                  : work.warnings.length === 0
                    ? "核对：没有发现问题。"
                    : `核对：${blocks} 处要改，${work.warnings.length - blocks} 处提示。切到「对照出处」可以看到挂在哪一段。`}
              </p>
            </div>

            {work.readOnly ? null : (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending !== null}
                  onClick={recheck}
                >
                  {pending === "check" ? "正在核对" : "再核对一次"}
                </Button>
                <Button type="button" disabled={pending !== null} onClick={accept}>
                  {pending === "accept" ? "正在保存" : "接受，存为新的一版"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending !== null}
                  onClick={hide}
                >
                  收起
                </Button>
              </div>
            )}
            {work.readOnly ? (
              <div>
                <Button type="button" variant="ghost" onClick={hide}>
                  收起
                </Button>
              </div>
            ) : null}
          </div>

          <aside className="flex min-w-0 flex-col gap-3">
            <p className="text-xs text-muted">出处 {refSources.length} 条</p>
            <ul className="flex flex-col gap-2">
              {refSources.map((source, index) => {
                const key = `S${index + 1}`;
                const open = openRef === key;
                return (
                  <li
                    key={key}
                    id={`ref-${key}`}
                    className={`scroll-mt-6 border bg-background ${
                      open ? "border-foreground" : "border-line"
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenRef(open ? null : key)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    >
                      <span className="min-w-0 flex-1 break-words text-sm leading-6 text-foreground">
                        <span className="text-muted">{key}</span>{" "}
                        {source ? source.title : "这条出处已经不在本案"}
                      </span>
                      <Chevron open={open} />
                    </button>
                    {source ? (
                      <Release open={open} fade>
                        <div className="px-3 pb-3">
                          <p className="break-words text-xs leading-5 text-muted">
                            {[source.status, source.detail].filter(Boolean).join(" · ")}
                          </p>
                          <Fold className="mt-2">
                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                              {source.text}
                            </p>
                          </Fold>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs text-foreground underline"
                          >
                            在北大法宝打开
                          </a>
                        </div>
                      </Release>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">要素 {refElements.length} 条</p>
            <ul className="flex flex-col gap-2">
              {refElements.map((element, index) => {
                const key = `E${index + 1}`;
                const open = openRef === key;
                return (
                  <li
                    key={key}
                    id={`ref-${key}`}
                    className={`scroll-mt-6 border bg-background ${
                      open ? "border-foreground" : "border-line"
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenRef(open ? null : key)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm leading-6 text-foreground">
                        <span className="text-muted">{key}</span>{" "}
                        {element ? `${element.kind}：${element.body}` : "这条要素已经不在本案"}
                      </span>
                      <Chevron open={open} />
                    </button>
                    {element ? (
                      <Release open={open} fade>
                        <p className="whitespace-pre-wrap break-words px-3 pb-3 text-sm leading-6 text-foreground">
                          {element.kind}：{element.body}
                        </p>
                      </Release>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
        </Release>
      ) : null}

      {drafts.length > 0 ? (
        <div className="flex max-w-3xl flex-col gap-2">
          <p className="text-xs text-muted">版本</p>
          <ol className="flex flex-col gap-2">
            {drafts.map((draft) => {
              const draftBlocks = draft.warnings.filter((warning) => warning.level === "block").length;
              return (
                <li
                  key={draft.id}
                  id={`draft-${draft.id}`}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 panel px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      第 {draft.version} 版 · {draft.kind}
                      {draft.final ? <span className="text-seal"> · 律师定稿</span> : null}
                    </p>
                    <p className="text-xs leading-5 text-muted">
                      {[
                        draft.createdAt,
                        draft.basedOn ? `从第 ${draft.basedOn} 版来` : "",
                        draftBlocks ? `${draftBlocks} 处要改` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending !== null}
                      onClick={() => reveal(workFrom(draft, !editable || draft.final), editable && !draft.final ? "edit" : "compare")}
                    >
                      {editable && !draft.final ? "载入修改" : "查看"}
                    </Button>
                    {editable && !draft.final ? (
                      <Button
                        type="button"
                        variant="seal"
                        size="sm"
                        disabled={pending !== null}
                        onClick={() => finalize(draft)}
                      >
                        {pending === `final:${draft.id}` ? "正在定稿" : "律师定稿"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

    </section>
  );
}
