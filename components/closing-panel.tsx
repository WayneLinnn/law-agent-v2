"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

import { Fold } from "@/components/fold";
import { Button } from "@/components/ui/button";
import { OUTCOME_KINDS, type MatterStatus, type OutcomeKind, type TaskResolution } from "@/lib/constants";
import { taskTitle, taskWhen } from "@/lib/deadlines";
import type { ClosingRecord, ClosingTaskResolution, DossierItem, SourceRecord, TaskRecord } from "@/lib/types";

const fieldClass = "mt-2 w-full min-w-0 field";

export function ClosingPanel({ matterId, status, tasks, record, resolutions, dossier, sources }: {
  matterId: string;
  status: MatterStatus;
  tasks: TaskRecord[];
  record: ClosingRecord | null;
  resolutions: ClosingTaskResolution[];
  dossier: DossierItem[];
  sources: SourceRecord[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<OutcomeKind>(record?.outcomeKind ?? "生效裁判");
  const [outcomeOn, setOutcomeOn] = useState(record?.outcomeOn ?? "");
  const [outcomeNote, setOutcomeNote] = useState(record?.outcomeNote ?? "");
  const [savedOutcome, setSavedOutcome] = useState({
    kind: record?.outcomeKind ?? "生效裁判",
    on: record?.outcomeOn ?? "",
    note: record?.outcomeNote ?? "",
  });
  const [statement, setStatement] = useState(record?.statement ?? "");
  const [savedStatement, setSavedStatement] = useState(record?.statement ?? "");
  const [dirtyTasks, setDirtyTasks] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const resolved = new Map(resolutions.map((item) => [item.taskId, item]));
  const unresolved = tasks.filter((task) => !resolved.has(task.id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const outcomeDirty = status === "已结案" && (
    kind !== savedOutcome.kind || outcomeOn !== savedOutcome.on || outcomeNote.trim() !== savedOutcome.note
  );
  const hasUnsavedChanges = outcomeDirty || statement.trim() !== savedStatement || Object.values(dirtyTasks).some(Boolean);

  function setTaskDirty(taskId: string, dirty: boolean) {
    setDirtyTasks((current) => ({ ...current, [taskId]: dirty }));
  }

  async function post(path: string, value?: unknown, method = "POST") {
    setPending(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch(`/api/matters/${matterId}${path}`, {
        method,
        headers: value ? { "Content-Type": "application/json" } : undefined,
        body: value ? JSON.stringify(value) : undefined,
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "操作没有完成。");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("连接失败，请再试一次。");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function fillFromRuling() {
    setPending(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/closing/from-ruling`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        statement?: string;
      } | null;
      if (!response.ok || !body?.statement) {
        setError(body?.error ?? "没有读出本审裁判。");
        return;
      }
      setStatement((current) =>
        current.trim() ? `${current.trim()}\n\n${body.statement}` : body.statement ?? "",
      );
    } catch {
      setError("连接失败，请再试一次。");
    } finally {
      setPending(false);
    }
  }

  async function saveStatement() {
    if (await post("/closing/statement", { statement })) {
      setSavedStatement(statement.trim());
      setNote(status === "已结案" ? "结案说明更正已保存。" : "结案说明已保存，尚未确认结案。");
    }
  }

  async function saveOutcome() {
    if (await post("/closing", { outcomeKind: kind, outcomeOn, outcomeNote }, "PUT")) {
      setSavedOutcome({ kind, on: outcomeOn, note: outcomeNote.trim() });
      setNote("办结结果更正已保存。");
    }
  }

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <div>
        <h2 className="text-sm text-foreground">结案与归档</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          文书的律师定稿不会自动结案。案件有实际办结结果后，在这里开始结案；确认结案说明与待办处理后，再单独归档。
        </p>
      </div>
      {(status === "办理中" || status === "结案中") && !record ? (
        <div className="flex flex-col gap-4 panel px-4 py-4">
          <h3 className="text-sm text-foreground">{status === "办理中" ? "进入结案中" : "补记办结结果"}</h3>
          <label className="text-xs text-muted">办结结果
            <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as OutcomeKind)}>
              {OUTCOME_KINDS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">结果日期
            <input className={fieldClass} type="date" value={outcomeOn} onChange={(event) => setOutcomeOn(event.target.value)} />
          </label>
          <label className="text-xs text-muted">具体情况
            <textarea className={fieldClass} rows={3} value={outcomeNote} onChange={(event) => setOutcomeNote(event.target.value)} placeholder="例如裁判何时生效、和解履行情况或撤诉原因" />
          </label>
          <div><Button disabled={pending} onClick={() => post("/closing", { outcomeKind: kind, outcomeOn, outcomeNote })}>{status === "办理中" ? "进入结案中" : "记下结果"}</Button></div>
        </div>
      ) : null}

      {record && status !== "已结案" ? (
        <div className="panel px-4 py-4">
          <h3 className="text-sm text-foreground">办结结果</h3>
          <p className="mt-2 text-sm text-foreground">{record.outcomeKind} · {record.outcomeOn}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{record.outcomeNote}</p>
        </div>
      ) : null}

      {record && status === "已结案" ? (
        <div className="flex flex-col gap-4 panel px-4 py-4">
          <h3 className="text-sm text-foreground">更正办结结果</h3>
          <label className="text-xs text-muted">办结结果
            <select className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as OutcomeKind)}>
              {OUTCOME_KINDS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">结果日期
            <input className={fieldClass} type="date" value={outcomeOn} onChange={(event) => setOutcomeOn(event.target.value)} />
          </label>
          <label className="text-xs text-muted">具体情况
            <textarea className={fieldClass} rows={3} value={outcomeNote} onChange={(event) => setOutcomeNote(event.target.value)} />
          </label>
          <div><Button variant="outline" disabled={pending} onClick={saveOutcome}>保存结果更正</Button></div>
        </div>
      ) : null}

      {(status === "结案中" || status === "已结案") && record ? (
        <>
          <div>
            <h3 className="text-sm text-foreground">核对待办</h3>
            <p className="mt-2 text-sm text-muted">{status === "已结案" ? "可更正已记录的处理结果。" : `每条待办都要记录处理结果。还有 ${unresolved.length} 条待处理。`}</p>
            {tasks.length === 0 ? <p className="mt-3 text-sm text-muted">本案没有待办。</p> : (
              <ul className="mt-3 flex flex-col gap-3">
                {tasks.map((task) => <TaskResolutionRow key={task.id} task={task} resolution={resolved.get(task.id)} pending={pending}
                  onDirtyChange={(dirty) => setTaskDirty(task.id, dirty)}
                  onSave={async (result, taskNote) => {
                    const saved = await post(`/closing/tasks/${task.id}`, { result, note: taskNote });
                    if (saved) setTaskDirty(task.id, false);
                    return saved;
                  }} />)}
              </ul>
            )}
          </div>
          <div className="panel px-4 py-4">
            <label className="text-sm text-foreground">结案说明
              <textarea className={fieldClass} rows={8} value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="写明办理经过、结果、未完成事项及向客户交代的情况" />
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button variant="outline" disabled={pending} onClick={fillFromRuling}>从本审裁判填入</Button>
              <Button variant="outline" disabled={pending} onClick={saveStatement}>{status === "已结案" ? "保存说明更正" : "保存说明"}</Button>
              {status === "结案中" ? <Button disabled={pending || !savedStatement || statement.trim() !== savedStatement || unresolved.length > 0} onClick={() => post("/closing/confirm")}>确认结案</Button> : null}
            </div>
            {statement.trim() !== savedStatement ? <p className="mt-2 text-xs text-muted">正文有修改，请先保存。</p> : null}
          </div>
        </>
      ) : null}

      {record?.statement && status === "已归档" ? (
        <div className="panel px-4 py-4">
          <h3 className="text-sm text-foreground">结案说明 {record.confirmedAt ? `· 已于 ${record.confirmedAt} 确认` : ""}</h3>
          <Fold className="mt-3" fade="from-surface">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{record.statement}</p>
          </Fold>
        </div>
      ) : null}

      {status === "已归档" && tasks.length > 0 ? (
        <div>
          <h3 className="text-sm text-foreground">待办处理记录</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {tasks.map((task) => {
              const resolution = resolved.get(task.id);
              return <li key={task.id} className="panel px-4 py-3 text-sm">
                <p>{taskTitle(task)} · {taskWhen(task)} · {resolution?.result ?? "未记录"}</p>
                {resolution?.note ? <p className="mt-2 whitespace-pre-wrap break-words text-muted">{resolution.note}</p> : null}
              </li>;
            })}
          </ul>
        </div>
      ) : null}

      {status === "已结案" ? (
        <div className="panel px-4 py-4">
          <p className="text-sm text-foreground">结案已确认。可在上方更正办结结果、待办处理和结案说明；再次归档将生成最新卷宗目录。</p>
          <div className="mt-3"><Button disabled={pending || hasUnsavedChanges} onClick={() => { if (window.confirm("确认归档这件案子？归档后不能再写入。")) void post("/archive"); }}>确认归档</Button></div>
          {hasUnsavedChanges ? <p className="mt-2 text-xs text-muted">有未保存的更正，请分别保存后归档。</p> : null}
        </div>
      ) : null}

      {status === "已归档" ? (
        <div className="panel px-4 py-4">
          <p className="text-sm text-done">本案已归档，只供查阅。归档日期：{record?.archivedAt ?? "未记录"}。</p>
          <p className="mt-2 text-sm text-muted">解档后状态回到已结案，可更正结案记录，再次归档。</p>
          <div className="mt-3"><Button variant="outline" disabled={pending} onClick={() => post("/unarchive")}>解档</Button></div>
        </div>
      ) : null}

      {dossier.length > 0 ? (
        <div>
          <h3 className="text-sm text-foreground">卷宗目录 · {dossier.length} 项</h3>
          <ol className="mt-3 flex flex-col gap-2">
            {dossier.map((item) => {
              const href = item.refId && (
                item.section === "材料" ? `/matters/${matterId}/materials#${item.refId}` :
                item.section === "文书版本" ? `/matters/${matterId}/documents#draft-${item.refId}` :
                item.section === "待办" ? `/matters/${matterId}/tasks#${item.refId}` : null
              );
              const source = item.section === "检索出处" && item.refId ? sourceById.get(item.refId) : null;
              return <li key={item.id} className="flex min-w-0 gap-3 panel px-4 py-3 text-sm">
                <span className="shrink-0 text-muted">{item.position + 1}.</span>
                <div className="min-w-0 break-words"><span className="text-muted">{item.section} · </span>
                  {href ? <Link className="underline" href={href}>{item.label}</Link> : item.label}
                  {source ? <Fold className="mt-2" fade="from-surface"><p className="whitespace-pre-wrap break-words text-sm leading-6">{source.text}</p></Fold> : null}
                </div>
              </li>;
            })}
          </ol>
        </div>
      ) : null}
      {error ? <p className="text-sm text-seal">{error}</p> : null}
      {note ? <p className="text-sm text-done">{note}</p> : null}
      {!record && status === "结案中" ? <p className="text-sm text-muted">本案沿用旧流程进入结案中，请先补记实际办结结果。</p> : null}
      {!record && status !== "办理中" && status !== "结案中" ? <p className="text-sm text-muted">本案尚未进入结案流程。</p> : null}
    </section>
  );
}

function TaskResolutionRow({ task, resolution, pending, onSave, onDirtyChange }: {
  task: TaskRecord;
  resolution?: { result: TaskResolution; note: string; resolvedAt: string };
  pending: boolean;
  onSave: (result: TaskResolution, note: string) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [result, setResult] = useState<TaskResolution>(resolution?.result ?? "已完成");
  const [note, setNote] = useState(resolution?.note ?? "");
  const originalResult = resolution?.result ?? "已完成";
  const originalNote = resolution?.note ?? "";
  return (
    <li className="panel px-4 py-3">
      <p className="text-sm text-foreground">{taskTitle(task)} · {taskWhen(task)}</p>
      <p className="mt-1 text-xs text-muted">{resolution ? `${resolution.result} · ${resolution.resolvedAt}` : "尚未处理"}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select aria-label="处理结果" className={fieldClass} value={result} onChange={(event) => {
          const next = event.target.value as TaskResolution;
          setResult(next);
          onDirtyChange(next !== originalResult || note.trim() !== originalNote);
        }}><option>已完成</option><option>不再适用</option></select>
        <input aria-label="处理说明" className={fieldClass} value={note} onChange={(event) => {
          const next = event.target.value;
          setNote(next);
          onDirtyChange(result !== originalResult || next.trim() !== originalNote);
        }} placeholder={result === "不再适用" ? "写明原因" : "处理说明（可选）"} />
      </div>
      <div className="mt-3"><Button variant="outline" size="sm" disabled={pending} onClick={() => onSave(result, note)}>{resolution ? "更新处理" : "记下处理"}</Button></div>
    </li>
  );
}
