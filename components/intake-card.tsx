"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { categoryFromCause } from "@/lib/causes";
import { CASE_CATEGORIES } from "@/lib/constants";
import { FILE_ACCEPT } from "@/lib/file-kinds";

const fieldClass =
  "w-full min-w-0 field";

type Party = { roleLabel: string; name: string; creditCode: string };

type ReadCard = {
  filename: string;
  parties: Party[];
  court: string;
  cause: string;
  facts: string;
  mandate: string;
};

function others(parties: Party[], picked: number | null) {
  return parties
    .filter((_, index) => index !== picked)
    .map((party) => party.name)
    .join("、");
}

export function IntakeCard() {
  const router = useRouter();
  const [card, setCard] = useState<ReadCard | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [opposingName, setOpposingName] = useState("");
  const [courtName, setCourtName] = useState("");
  const [cause, setCause] = useState("");
  const [facts, setFacts] = useState("");
  const [mandate, setMandate] = useState("");
  const [category, setCategory] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [feeReceivable, setFeeReceivable] = useState("");
  const [contract, setContract] = useState(true);
  const [didRead, setDidRead] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [nameEdited, setNameEdited] = useState(false);
  const [opposingEdited, setOpposingEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"read" | "create" | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function applyCard(next: ReadCard, dropped: File) {
    setCard(next);
    setFile(dropped);
    setPicked(null);
    setClientName("");
    setName("");
    setNameEdited(false);
    setOpposingEdited(false);
    setOpposingName(others(next.parties, null));
    setCourtName(next.court);
    setCause(next.cause);
    if (!categoryTouched) setCategory(categoryFromCause(next.cause));
    setFacts(next.facts);
    setMandate(next.mandate);
    setError(null);
  }

  function choose(index: number) {
    if (!card) return;
    const party = card.parties[index];
    if (!party) return;
    setPicked(index);
    setClientName(party.name);
    setError(null);
    if (!opposingEdited) setOpposingName(others(card.parties, index));
    if (!nameEdited) {
      const opposing = others(card.parties, index).split("、")[0] ?? "";
      setName([party.name, opposing ? `与${opposing}` : "", card.cause].join(""));
    }
  }

  function holdFile(dropped: File) {
    setFile(dropped);
    setCard({
      filename: dropped.name,
      parties: [],
      court: "",
      cause: "",
      facts: "",
      mandate: "",
    });
    setPicked(null);
    setClientName("");
    setName("");
    setNameEdited(false);
    setOpposingEdited(false);
    setOpposingName("");
    setCourtName("");
    setCause("");
    setFacts("");
    setMandate("");
    setCategory("");
    setCategoryTouched(false);
    setDidRead(false);
    setReadNote(null);
    setError(null);
  }

  async function readHeld() {
    if (!file) return;
    setPending("read");
    setError(null);
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/intake/read", { method: "POST", body });
    const payload = (await response.json().catch(() => null)) as
      | (ReadCard & { error?: string; unread?: boolean; note?: string })
      | null;
    setPending(null);
    if (!response.ok || !payload || payload.error) {
      setError(payload?.error ?? "没有读出这份材料。");
      return;
    }
    if (payload.unread) {
      setDidRead(false);
      setReadNote(payload.note || "这份材料请手填。");
      return;
    }
    setDidRead(true);
    setReadNote(null);
    applyCard(payload, file);
  }

  function takeFiles(list: FileList | null) {
    const dropped = list?.[0];
    if (!dropped) return;
    if (list && list.length > 1) {
      setError("一次放入一份材料。");
      return;
    }
    holdFile(dropped);
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    if (!clientName.trim()) {
      setError("请点明谁是客户。");
      return;
    }
    setPending("create");
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("name", name);
    body.set("clientName", clientName);
    body.set("opposingName", opposingName);
    body.set("courtName", courtName);
    body.set("cause", cause);
    body.set("facts", facts);
    body.set("mandate", mandate);
    body.set("category", category);
    body.set("feeReceivable", feeReceivable);
    body.set("contract", contract ? "1" : "");
    body.set("extract", didRead ? "1" : "");
    const response = await fetch("/api/intake/accept", { method: "POST", body });
    const payload = (await response.json().catch(() => null)) as {
      id?: string;
      error?: string;
    } | null;
    setPending(null);
    if (!payload?.id) {
      setError(payload?.error ?? "没有建成这件案子。");
      return;
    }
    router.push(`/matters/${payload.id}`);
    router.refresh();
  }

  return (
    <section className="mt-8 flex max-w-3xl flex-col gap-4">
      <div>
        <h2 className="text-sm text-foreground">丢进文件</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          可以放入 txt、PDF、图片、录音或录像。点读取，才从 txt 和带文字的 PDF 里填这张卡片。点明谁是客户之后才创建。
        </p>
      </div>
      <label
        className={`flex cursor-pointer flex-col gap-1 border border-dashed px-4 py-6 text-sm ${
          dragOver ? "border-foreground bg-surface" : "border-line bg-background"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          takeFiles(event.dataTransfer.files);
        }}
      >
        <span className="text-foreground">
          {pending === "read" ? "正在读" : "把文件丢到这里，或点这里选择"}
        </span>
        <span className="text-xs text-muted">一次一份。放下之后再点读取。</span>
        <input
          type="file"
          accept={FILE_ACCEPT}
          className="sr-only"
          onChange={(event) => {
            takeFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {error && !card ? <p className="text-sm text-seal">{error}</p> : null}

      {card ? (
        <form onSubmit={create} className="flex flex-col gap-4 panel px-4 py-4">
          <div>
            <h3 className="text-sm text-foreground">创建卡</h3>
            <p className="mt-1 break-words text-xs text-muted">{card.filename}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" disabled={pending !== null} onClick={readHeld}>
              {pending === "read" ? "正在读取" : "读取"}
            </Button>
            {readNote ? <p className="text-sm text-foreground">{readNote}</p> : null}
          </div>
          {card.parties.length === 0 ? (
            <p className="text-sm leading-6 text-foreground">
              这份材料里没有读出当事人。请在下面写上，并点明谁是客户。
            </p>
          ) : (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs text-muted">当事人。点一条，点明谁是客户。</legend>
              {card.parties.map((party, index) => (
                <label
                  key={`${party.roleLabel}-${party.name}-${index}`}
                  className="flex min-w-0 items-start gap-3 border border-line bg-background px-3 py-2"
                >
                  <input
                    type="radio"
                    name="client"
                    className="mt-1 size-4 shrink-0"
                    checked={picked === index}
                    onChange={() => choose(index)}
                  />
                  <span className="min-w-0 break-words text-sm leading-6 text-foreground">
                    <span className="text-muted">{party.roleLabel}</span> {party.name}
                    {picked === index ? <span className="text-seal"> · 客户</span> : null}
                    {party.creditCode ? (
                      <span className="mt-1 block text-xs text-muted">
                        统一社会信用代码 {party.creditCode}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <label className="text-xs text-muted">
            客户
            <input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              autoComplete="off"
              className={`${fieldClass} mt-2`}
            />
          </label>
          <label className="text-xs text-muted">
            对方
            <input
              value={opposingName}
              onChange={(event) => {
                setOpposingEdited(true);
                setOpposingName(event.target.value);
              }}
              autoComplete="off"
              className={`${fieldClass} mt-2`}
            />
          </label>
          <label className="text-xs text-muted">
            法院
            <input
              value={courtName}
              onChange={(event) => setCourtName(event.target.value)}
              autoComplete="off"
              className={`${fieldClass} mt-2`}
            />
          </label>
          <label className="text-xs text-muted">
            案由
            <input
              value={cause}
              onChange={(event) => {
                const next = event.target.value;
                setCause(next);
                if (!categoryTouched) setCategory(categoryFromCause(next));
              }}
              autoComplete="off"
              className={`${fieldClass} mt-2`}
            />
          </label>
          <label className="text-xs text-muted">
            类型
            <select
              value={category}
              onChange={(event) => {
                setCategoryTouched(true);
                setCategory(event.target.value);
              }}
              className={`${fieldClass} mt-2`}
            >
              <option value="">按案由识别，对不上就手选</option>
              {CASE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            应收（元）
            <input
              value={feeReceivable}
              onChange={(event) => setFeeReceivable(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="可以先空着"
              className={`${fieldClass} mt-2`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4"
              checked={contract}
              onChange={(event) => setContract(event.target.checked)}
            />
            这份是代理合同
          </label>
          <label className="text-xs text-muted">
            案件名称
            <input
              value={name}
              onChange={(event) => {
                setNameEdited(true);
                setName(event.target.value);
              }}
              autoComplete="off"
              className={`${fieldClass} mt-2`}
            />
          </label>
          <label className="text-xs text-muted">
            基本事实
            <textarea
              value={facts}
              rows={4}
              onChange={(event) => setFacts(event.target.value)}
              className={`${fieldClass} mt-2 resize-y`}
            />
          </label>
          <label className="text-xs text-muted">
            委托事项
            <textarea
              value={mandate}
              rows={4}
              onChange={(event) => setMandate(event.target.value)}
              className={`${fieldClass} mt-2 resize-y`}
            />
          </label>
          {error ? <p className="text-sm text-seal">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="seal" disabled={pending !== null}>
              {pending === "create" ? "正在创建" : "创建"}
            </Button>
            {picked === null && card.parties.length > 0 ? (
              <p className="text-sm text-foreground">请点明谁是客户。还没有创建。</p>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
