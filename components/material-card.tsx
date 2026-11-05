"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Fold } from "@/components/fold";
import { SavedLine } from "@/components/saved-line";
import { Button } from "@/components/ui/button";
import { MATERIAL_KINDS, RULING_KINDS, partyLabel } from "@/lib/constants";
import { canReadText } from "@/lib/file-kinds";
import type { MaterialRecord, PartyRecord, RulingRecord } from "@/lib/types";

const fieldClass =
  "mt-2 w-full min-w-0 field";

export function MaterialCard({
  matterId,
  material,
  parties,
  ruling,
  editable,
  caseNumber: initialCaseNumber,
  courtName: initialCourtName,
}: {
  matterId: string;
  material: MaterialRecord;
  parties: PartyRecord[];
  ruling: RulingRecord | null;
  editable: boolean;
  caseNumber: string;
  courtName: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState(material.kind);
  const [proves, setProves] = useState(material.proves);
  const [submittedBy, setSubmittedBy] = useState(material.submittedBy ?? "");
  const [rulingKind, setRulingKind] = useState(ruling?.kind ?? "判决");
  const [decidedOn, setDecidedOn] = useState(ruling?.decidedOn ?? "");
  const [servedOn, setServedOn] = useState(ruling?.servedOn ?? "");
  const [effectiveOn, setEffectiveOn] = useState(ruling?.effectiveOn ?? "");
  const [result, setResult] = useState(ruling?.result ?? "");
  const [caseNumber, setCaseNumber] = useState(initialCaseNumber);
  const [courtName, setCourtName] = useState(initialCourtName);
  const [rulingReadPending, setRulingReadPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kindPending, setKindPending] = useState(false);
  const [rulingPending, setRulingPending] = useState(false);
  const [readPending, setReadPending] = useState(false);
  const [kindSaved, setKindSaved] = useState(false);
  const [rulingSaved, setRulingSaved] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);

  const submitter = parties.find((party) => party.id === material.submittedBy);

  async function saveKind(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKindPending(true);
    setError(null);
    setKindSaved(false);
    const response = await fetch(
      `/api/matters/${matterId}/materials/${material.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, proves, submittedBy }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setKindPending(false);
    if (!response.ok) {
      setError(body?.error ?? "种类没有记下。");
      return;
    }
    setKindSaved(true);
    router.refresh();
  }

  async function readText() {
    setReadPending(true);
    setError(null);
    setReadNote(null);
    const response = await fetch(
      `/api/matters/${matterId}/materials/${material.id}/read`,
      { method: "POST" },
    );
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setReadPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有读出文字。");
      return;
    }
    setReadNote("已读取");
    router.refresh();
  }

  async function saveRuling(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRulingPending(true);
    setError(null);
    setRulingSaved(false);
    const response = await fetch(`/api/matters/${matterId}/rulings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materialId: material.id,
        kind: rulingKind,
        decidedOn,
        servedOn,
        effectiveOn,
        result,
        caseNumber,
        courtName,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setRulingPending(false);
    if (!response.ok) {
      setError(body?.error ?? "裁判没有记下。");
      return;
    }
    setRulingSaved(true);
    router.refresh();
  }

  async function fillRuling() {
    setRulingReadPending(true);
    setError(null);
    setRulingSaved(false);
    const response = await fetch(
      `/api/matters/${matterId}/materials/${material.id}/ruling-read`,
      { method: "POST" },
    );
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      kind?: RulingRecord["kind"];
      caseNumber?: string;
      court?: string;
      decidedOn?: string;
      servedOn?: string;
      effectiveOn?: string;
      result?: string;
    } | null;
    setRulingReadPending(false);
    if (!response.ok || !body || body.error) {
      setError(body?.error ?? "没有读出裁判。");
      return;
    }
    if (body.kind) setRulingKind(body.kind);
    if (body.caseNumber) setCaseNumber(body.caseNumber);
    if (body.court) setCourtName(body.court);
    if (body.decidedOn) setDecidedOn(body.decidedOn);
    if (body.servedOn) setServedOn(body.servedOn);
    if (body.effectiveOn) setEffectiveOn(body.effectiveOn);
    if (body.result) setResult(body.result);
  }

  return (
    <article
      id={material.id}
      className="scroll-mt-6 flex flex-col gap-4 panel px-4 py-4"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h3 className="min-w-0 break-words text-sm font-medium text-foreground">
          {material.filename}
        </h3>
        <time className="shrink-0 text-xs text-muted">{material.createdAt}</time>
      </div>
      <p className="text-sm text-foreground">
        {material.kind}
        {material.proves ? ` · 证明 ${material.proves}` : ""}
        {submitter ? ` · ${partyLabel(submitter)}提交` : ""}
      </p>
      {editable && canReadText(material.filename) ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={readPending} onClick={readText}>
            {readPending ? "正在读取" : "读取"}
          </Button>
          {readNote ? <p className="text-sm text-done">{readNote}</p> : null}
        </div>
      ) : editable ? (
        <p className="text-sm leading-6 text-muted">
          图片、录音和录像先存放。读取文字只处理 txt 和带文字的 PDF。
        </p>
      ) : null}
      {editable ? (
        <form
          onSubmit={saveKind}
          onChange={() => setKindSaved(false)}
          className="flex flex-col gap-4"
        >
          <label className="min-w-0 text-xs text-muted">
            种类
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as MaterialRecord["kind"])}
              className={fieldClass}
            >
              {MATERIAL_KINDS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {kind === "证据" ? (
            <>
              <label className="min-w-0 text-xs text-muted">
                证明对象
                <input
                  value={proves}
                  onChange={(event) => setProves(event.target.value)}
                  autoComplete="off"
                  placeholder="可以先空着"
                  className={fieldClass}
                />
              </label>
              <label className="min-w-0 text-xs text-muted">
                谁提交
                <select
                  value={submittedBy}
                  onChange={(event) => setSubmittedBy(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">未填写</option>
                  {parties
                    .filter((party) => party.role !== "court")
                    .map((party) => (
                    <option key={party.id} value={party.id}>
                      {partyLabel(party)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="outline" disabled={kindPending}>
              {kindPending ? "正在记下" : "记下种类"}
            </Button>
            <SavedLine show={kindSaved} />
          </div>
        </form>
      ) : null}
      {material.kind === "裁判文书" && editable ? (
        <form
          onSubmit={saveRuling}
          onChange={() => setRulingSaved(false)}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-foreground">裁判</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-xs text-muted">
              案号
              <input
                value={caseNumber}
                onChange={(event) => setCaseNumber(event.target.value)}
                autoComplete="off"
                className={fieldClass}
              />
            </label>
            <label className="min-w-0 text-xs text-muted">
              法院
              <input
                value={courtName}
                onChange={(event) => setCourtName(event.target.value)}
                autoComplete="off"
                className={fieldClass}
              />
            </label>
          </div>
          <label className="min-w-0 text-xs text-muted">
            文书
            <select
              value={rulingKind}
              onChange={(event) =>
                setRulingKind(event.target.value as RulingRecord["kind"])
              }
              className={fieldClass}
            >
              {RULING_KINDS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="min-w-0 text-xs text-muted">
              裁判日期
              <input
                type="date"
                value={decidedOn}
                onChange={(event) => setDecidedOn(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="min-w-0 text-xs text-muted">
              送达日
              <input
                type="date"
                value={servedOn}
                onChange={(event) => setServedOn(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="min-w-0 text-xs text-muted">
              生效日
              <input
                type="date"
                value={effectiveOn}
                onChange={(event) => setEffectiveOn(event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
          <label className="min-w-0 text-xs text-muted">
            裁判结果
            <input
              value={result}
              onChange={(event) => setResult(event.target.value)}
              autoComplete="off"
              placeholder="可以先空着"
              className={fieldClass}
            />
          </label>
          <p className="text-sm leading-6 text-muted">
            读取只填进这张表，点记下裁判才保存。上诉期限用记下的送达日，仍要律师确认才出现在工作台。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={rulingPending || rulingReadPending}
              onClick={fillRuling}
            >
              {rulingReadPending ? "正在读取" : "读取裁判"}
            </Button>
            <Button type="submit" disabled={rulingPending || rulingReadPending}>
              {rulingPending ? "正在记下" : "记下裁判"}
            </Button>
            <SavedLine show={rulingSaved} />
          </div>
        </form>
      ) : null}
      {material.kind === "裁判文书" && !editable && ruling ? (
        <p className="text-sm leading-6 text-foreground">
          {ruling.kind}
          {ruling.servedOn ? ` · 送达 ${ruling.servedOn}` : ""}
          {ruling.effectiveOn ? ` · 生效 ${ruling.effectiveOn}` : ""}
          {ruling.result ? ` · ${ruling.result}` : ""}
        </p>
      ) : null}
      {error ? <p className="text-sm text-seal">{error}</p> : null}
      <div>
        <h4 className="text-xs text-muted">读出的文字</h4>
        <Fold className="mt-2" fade="from-surface">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
            {material.extractedText}
          </p>
        </Fold>
      </div>
      <div>
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a
              href={`/api/matters/${matterId}/materials/${material.id}/file`}
              target="_blank"
              rel="noopener"
            />
          }
        >
          打开原件
        </Button>
      </div>
    </article>
  );
}
