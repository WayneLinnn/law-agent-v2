"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SavedLine } from "@/components/saved-line";
import { Button } from "@/components/ui/button";
import {
  REPEATS,
  TASK_KINDS,
  isTaskKind,
  type RulingKind,
  type TaskKind,
} from "@/lib/constants";
import {
  computeDeadline,
  isCalculatedKind,
  TASK_VARIANTS,
} from "@/lib/deadlines";

const fieldClass =
  "mt-2 w-full min-w-0 field";

export function TaskForm({
  matterId,
  rulings,
}: {
  matterId: string;
  rulings: {
    materialId: string;
    filename: string;
    kind: RulingKind;
    servedOn: string;
    effectiveOn: string;
  }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<TaskKind>("开庭");
  const [variant, setVariant] = useState("");
  const [customName, setCustomName] = useState("");
  const [startOn, setStartOn] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [place, setPlace] = useState("");
  const [repeat, setRepeat] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rulingPick, setRulingPick] = useState("");

  const variants = TASK_VARIANTS[kind] ?? [];
  const calculated = isCalculatedKind(kind);
  const preview = computeDeadline({
    kind,
    customName,
    dueOn,
    startOn,
    variant: variant || variants[0]?.value || "",
  });
  const previewDate =
    "error" in preview
      ? null
      : preview.dueOn === preview.endOn
        ? `到期 ${preview.dueOn}`
        : `提醒 ${preview.dueOn}，届满 ${preview.endOn}`;

  const appealRulings = rulings.filter(
    (ruling) => ruling.servedOn && (ruling.kind === "判决" || ruling.kind === "裁定"),
  );
  const enforcementRulings = rulings.filter((ruling) => ruling.effectiveOn);

  function chooseKind(next: string) {
    if (!isTaskKind(next)) return;
    setKind(next);
    setVariant(TASK_VARIANTS[next]?.[0]?.value ?? "");
    setRulingPick("");
    setError(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/matters/${matterId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        customName,
        dueOn,
        dueTime,
        place,
        repeat,
        repeatUntil,
        startOn,
        variant: variant || variants[0]?.value || "",
        note,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有记下这条待办。");
      return;
    }
    setCustomName("");
    setStartOn("");
    setDueOn("");
    setDueTime("");
    setPlace("");
    setRepeat("");
    setRepeatUntil("");
    setNote("");
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      onChange={() => setSaved(false)}
      className="flex flex-col gap-4 panel px-4 py-4"
    >
      <label className="min-w-0 text-xs text-muted">
        哪一种
        <abbr title="必填" className="ml-1 text-seal no-underline">
          *
        </abbr>
        <select
          value={kind}
          onChange={(event) => chooseKind(event.target.value)}
          className={fieldClass}
        >
          {TASK_KINDS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {kind === "其他" ? (
        <label className="min-w-0 text-xs text-muted">
          名称
          <abbr title="必填" className="ml-1 text-seal no-underline">
            *
          </abbr>
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            autoComplete="off"
            className={fieldClass}
          />
        </label>
      ) : null}

      {variants.length > 0 ? (
        <label className="min-w-0 text-xs text-muted">
          怎么起算
          <abbr title="必填" className="ml-1 text-seal no-underline">
            *
          </abbr>
          <select
            value={variant || variants[0].value}
            onChange={(event) => setVariant(event.target.value)}
            className={fieldClass}
          >
            {variants.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {kind === "上诉" && appealRulings.length > 0 ? (
        <label className="min-w-0 text-xs text-muted">
          从裁判带入送达日
          <select
            value={rulingPick}
            onChange={(event) => {
              const ruling = appealRulings.find(
                (item) => item.materialId === event.target.value,
              );
              setRulingPick(event.target.value);
              if (!ruling) return;
              setStartOn(ruling.servedOn);
              setVariant(ruling.kind === "裁定" ? "裁定·国内" : "判决·国内");
            }}
            className={fieldClass}
          >
            <option value="">自己填写</option>
            {appealRulings.map((ruling) => (
              <option key={ruling.materialId} value={ruling.materialId}>
                {ruling.filename} · {ruling.kind} · 送达 {ruling.servedOn}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {kind === "执行申请" && enforcementRulings.length > 0 ? (
        <label className="min-w-0 text-xs text-muted">
          从裁判带入生效日
          <select
            value={rulingPick}
            onChange={(event) => {
              const ruling = enforcementRulings.find(
                (item) => item.materialId === event.target.value,
              );
              setRulingPick(event.target.value);
              if (!ruling) return;
              setVariant("生效");
              setStartOn(ruling.effectiveOn);
            }}
            className={fieldClass}
          >
            <option value="">自己填写</option>
            {enforcementRulings.map((ruling) => (
              <option key={ruling.materialId} value={ruling.materialId}>
                {ruling.filename} · {ruling.kind} · 生效 {ruling.effectiveOn}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {calculated ? (
        <label className="min-w-0 text-xs text-muted">
          起算日
          <abbr title="必填" className="ml-1 text-seal no-underline">
            *
          </abbr>
          <input
            type="date"
            value={startOn}
            onChange={(event) => setStartOn(event.target.value)}
            className={fieldClass}
          />
        </label>
      ) : (
        <label className="min-w-0 text-xs text-muted">
          到期日
          <abbr title="必填" className="ml-1 text-seal no-underline">
            *
          </abbr>
          <input
            type="date"
            value={dueOn}
            onChange={(event) => setDueOn(event.target.value)}
            className={fieldClass}
          />
        </label>
      )}

      {calculated ? null : (
        <label className="min-w-0 text-xs text-muted">
          时间
          <input
            type="time"
            value={dueTime}
            onChange={(event) => setDueTime(event.target.value)}
            className={fieldClass}
          />
        </label>
      )}

      {kind === "开庭" ? (
        <label className="min-w-0 text-xs text-muted">
          法庭
          <input
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            autoComplete="off"
            placeholder="可以先空着"
            className={fieldClass}
          />
        </label>
      ) : null}

      {calculated ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-xs text-muted">
            重复
            <select
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              className={fieldClass}
            >
              <option value="">不重复</option>
              {REPEATS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {repeat ? (
            <label className="min-w-0 text-xs text-muted">
              重复到
              <input
                type="date"
                value={repeatUntil}
                onChange={(event) => setRepeatUntil(event.target.value)}
                className={fieldClass}
              />
            </label>
          ) : null}
        </div>
      )}

      <label className="min-w-0 text-xs text-muted">
        附注
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoComplete="off"
          placeholder="可以先空着"
          className={fieldClass}
        />
      </label>
      {previewDate ? (
        <p className="text-sm leading-6 text-foreground">{previewDate}</p>
      ) : null}
      {error ? <p className="text-sm text-seal">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "正在记下" : "记下"}
        </Button>
        <SavedLine show={saved} />
      </div>
    </form>
  );
}
