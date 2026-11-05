import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ConfirmTaskButton } from "@/components/confirm-task-button";
import { TaskForm } from "@/components/task-form";
import { repeatLabel, TERMINATED_NOTE } from "@/lib/constants";
import { nextOccurrence, taskTitle, taskWhen } from "@/lib/deadlines";
import { todayISO } from "@/lib/figures";
import { getMatter } from "@/lib/matters";
import { listRulings } from "@/lib/rulings";

export default function TasksPage({
  params,
}: PageProps<"/matters/[id]/tasks">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">正在读取待办。</p>}>
      <Tasks params={params} />
    </Suspense>
  );
}

async function Tasks({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getMatter(id);
  if (!detail) notFound();

  const { matter, tasks, materials } = detail;
  const rulings = (await listRulings(matter.id)).flatMap((ruling) => {
    const material = materials.find((item) => item.id === ruling.materialId);
    if (!material) return [];
    return [
      {
        materialId: ruling.materialId,
        filename: material.filename,
        kind: ruling.kind,
        servedOn: ruling.servedOn,
        effectiveOn: ruling.effectiveOn,
      },
    ];
  });

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      {matter.status === "办理中" ? (
        <TaskForm matterId={matter.id} rulings={rulings} />
      ) : (
        <p className="text-sm leading-6 text-foreground">
          {matter.status === "已终止" ? TERMINATED_NOTE : "待办在办理中记下。"}
        </p>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm text-foreground">待办</h2>
          <p className="text-sm text-muted">{tasks.length} 条</p>
        </div>
        {tasks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">本案还没有待办。</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {tasks.map((task) => {
              const next = nextOccurrence(
                task.dueOn,
                task.repeat,
                task.repeatUntil,
                todayISO(),
              );
              return (
              <li
                key={task.id}
                id={task.id}
                className="scroll-mt-6 panel px-4 py-4"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <h3 className="min-w-0 break-words text-sm font-medium text-foreground">
                    {taskTitle(task)}
                  </h3>
                  <time className="shrink-0 text-xs text-muted">
                    {task.endOn && task.endOn !== task.dueOn
                      ? `${taskWhen(task)} 前提醒`
                      : taskWhen(task)}
                  </time>
                </div>
                {task.place ? (
                  <p className="mt-1 break-words text-sm text-foreground">{task.place}</p>
                ) : null}
                {task.repeat ? (
                  <p className="mt-1 break-words text-sm text-muted">
                    {`${repeatLabel(task.repeat)}${task.repeatUntil ? `，到 ${task.repeatUntil}` : ""}`}
                    {next && next !== task.dueOn
                      ? ` · 下次 ${next}${task.dueTime ? ` ${task.dueTime}` : ""}`
                      : ""}
                    {next ? "" : " · 已经结束"}
                  </p>
                ) : null}
                {task.endOn && task.endOn !== task.dueOn ? (
                  <p className="mt-1 break-words text-sm text-foreground">
                    {`届满 ${task.endOn}`}
                  </p>
                ) : null}
                {task.note ? (
                  <p className="mt-2 break-words text-sm leading-6 text-foreground">
                    {task.note}
                  </p>
                ) : null}
                <div className="mt-3">
                  {task.confirmedAt ? (
                    <p className="text-sm text-done">已确认</p>
                  ) : matter.status === "办理中" ? (
                    <ConfirmTaskButton matterId={matter.id} taskId={task.id} />
                  ) : (
                    <p className="text-sm text-muted">尚未确认</p>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </div>

    </section>
  );
}
