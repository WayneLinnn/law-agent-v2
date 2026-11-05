import { Suspense } from "react";
import Link from "next/link";

import { AskPanel } from "@/components/ask-panel";
import { Fold } from "@/components/fold";
import { CaseSidebar } from "@/components/case-sidebar";
import { FindPanel } from "@/components/find-panel";
import { Button } from "@/components/ui/button";
import { repeatLabel } from "@/lib/constants";
import { daysUntil, NEAR_DAYS, promptPhrase, todayISO } from "@/lib/figures";
import { taskTitle, taskWhen } from "@/lib/deadlines";
import { listMatters } from "@/lib/matters";
import { listDueTasks } from "@/lib/tasks";
import type { DueTask } from "@/lib/types";

function WorkbenchFallback() {
  return (
    <main className="bg-background px-8 py-6 text-foreground">
      <h1 className="font-serif text-3xl">工作台</h1>
      <p className="mt-3 text-sm text-muted">正在读取案件。</p>
    </main>
  );
}

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function DueCard({ task }: { task: DueTask }) {
  return (
    <li className="panel px-4 py-3">
      <p className="text-sm text-foreground">
        <time>{taskWhen(task)}</time>
        <span className="mx-2 text-muted">{taskTitle(task)}</span>
        {task.repeat ? (
          <span className="text-muted">{repeatLabel(task.repeat)}</span>
        ) : null}
      </p>
      {task.place ? (
        <p className="mt-1 break-words text-sm text-foreground">{task.place}</p>
      ) : null}
      {task.endOn && task.endOn !== task.dueOn ? (
        <p className="mt-1 text-sm text-muted">届满 {task.endOn}</p>
      ) : null}
      {task.note ? (
        <p className="mt-1 break-words text-sm leading-6 text-foreground">{task.note}</p>
      ) : null}
      <Link
        href={`/matters/${task.matterId}/tasks#${task.id}`}
        className="mt-2 block break-words text-sm text-foreground underline"
      >
        {task.matterName}
      </Link>
    </li>
  );
}

async function Workbench({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    view?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = raw ?? "";
  const requested = one(params.view);
  const view = requested === "near" || requested === "open" ? requested : "today";
  const [allMatters, dueTasks] = await Promise.all([listMatters(), listDueTasks()]);
  const today = todayISO();
  const sortedTasks = [...dueTasks].sort(
    (a, b) => a.occursOn.localeCompare(b.occursOn) || a.dueTime.localeCompare(b.dueTime),
  );
  const todayTasks = sortedTasks.filter((task) => task.occursOn === today);
  const deadlinePrompts = sortedTasks.flatMap((task) => {
    const days = daysUntil(task.occursOn, today);
    if (days === null || days > NEAR_DAYS) return [];
    return [{ ...task, days, phrase: promptPhrase(days, "截止") }];
  });
  deadlinePrompts.sort((a, b) => a.days - b.days);
  const openMatters = allMatters.filter((matter) => matter.status === "办理中");
  const href = (next: "today" | "near" | "open") => {
    const search = new URLSearchParams();
    if (next !== "today") search.set("view", next);
    if (query) search.set("q", query);
    const text = search.toString();
    return text ? `/?${text}` : "/";
  };
  const counters = [
    { id: "today" as const, label: "今日到期", count: todayTasks.length },
    { id: "near" as const, label: "临近期限", count: deadlinePrompts.length },
    { id: "open" as const, label: "在办", count: openMatters.length },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <CaseSidebar matters={allMatters} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">工作台</h1>
            <p className="mt-1 text-sm text-muted">先问法律问题，再看今天要处理的。</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/judges" />}>
              法官
            </Button>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/review" />}>
              审合同
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/matters/new" />}>
              新建案件
            </Button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="panel p-5">
            <AskPanel desk />
          </div>
          <div className="panel p-5">
            <FindPanel desk query={query} searched={raw !== undefined} view={view} />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {counters.map((item) => (
            <Link
              key={item.id}
              href={href(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              className={`panel min-w-0 px-4 py-3 transition-colors duration-200 ${
                view === item.id ? "border-foreground" : "hover:bg-background"
              }`}
            >
              <span className="block text-xs font-medium text-muted">{item.label}</span>
              <span className="mt-1 block text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {item.count}
              </span>
            </Link>
          ))}
        </div>
        <section className="mt-6">
          {view === "today" ? (
            todayTasks.length === 0 ? (
              <p className="text-sm text-muted">今天没有要处理的。</p>
            ) : (
              <Fold>
                <ul className="flex flex-col gap-3">
                  {todayTasks.map((task) => (
                    <DueCard key={task.id} task={task} />
                  ))}
                </ul>
              </Fold>
            )
          ) : null}
          {view === "near" ? (
            deadlinePrompts.length === 0 ? (
              <p className="text-sm text-muted">90 天内没有临近或已过的期限。</p>
            ) : (
              <Fold>
              <ul className="flex flex-col gap-3">
                {deadlinePrompts.map((task) => (
                  <li key={task.id} className="panel px-4 py-3">
                    <p className="break-words text-sm text-foreground">
                      <time>{taskWhen(task)}</time>
                      <span className="mx-2 text-muted">{taskTitle(task)}</span>
                      <span className="text-seal">{task.phrase}</span>
                    </p>
                    {task.endOn && task.endOn !== task.dueOn ? (
                      <p className="mt-1 text-sm text-muted">届满 {task.endOn}</p>
                    ) : null}
                    <Link
                      href={`/matters/${task.matterId}/tasks#${task.id}`}
                      className="mt-2 block break-words text-sm text-foreground underline"
                    >
                      {task.matterName}
                    </Link>
                  </li>
                ))}
              </ul>
              </Fold>
            )
          ) : null}
          {view === "open" ? (
            openMatters.length === 0 ? (
              <p className="text-sm text-muted">没有办理中的案子。</p>
            ) : (
              <Fold>
              <ul className="flex flex-col gap-3">
                {openMatters.map((matter) => (
                  <li key={matter.id} className="panel px-4 py-3">
                    <Link
                      href={`/matters/${matter.id}`}
                      className="block break-words text-sm leading-6 text-foreground underline"
                    >
                      {matter.name}
                    </Link>
                    <p className="mt-1 break-words text-xs text-muted">
                      {[matter.cause, matter.courtName].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
              </Fold>
            )
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<WorkbenchFallback />}>
      <Workbench searchParams={searchParams} />
    </Suspense>
  );
}
