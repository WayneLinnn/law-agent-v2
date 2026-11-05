import { notFound } from "next/navigation"

import { ActivityPanel } from "@/components/activity-panel"
import { StatusControl } from "@/components/status-control"
import { CaseSidebar } from "@/components/case-sidebar"
import { MatterAsk } from "@/components/matter-ask"
import { MatterNav } from "@/components/matter-nav"
import { SectionShift } from "@/components/section-shift"
import { PartyColumns } from "@/components/party-columns"
import { repeatLabel } from "@/lib/constants"
import { nextOccurrence, taskTitle, taskWhen } from "@/lib/deadlines"
import { todayISO } from "@/lib/figures"
import { groupParties, getMatter, listMatters } from "@/lib/matters"
import { listDrafts } from "@/lib/drafts"
import { listSources } from "@/lib/research"
import { getClosing } from "@/lib/closing"

export async function MatterFrame({
  matterId,
  children,
}: {
  matterId: string
  children: React.ReactNode
}) {
  const [detail, matters, sources, drafts, closing] = await Promise.all([
    getMatter(matterId),
    listMatters(),
    listSources(matterId),
    listDrafts(matterId),
    getClosing(matterId),
  ])
  if (!detail) notFound()

  const { matter, parties, materials, tasks, elements, focuses } = detail
  const resolutionByTask = new Map(closing.resolutions.map((item) => [item.taskId, item]))
  const activityItem = (task: (typeof tasks)[number]) => {
    const next = nextOccurrence(task.dueOn, task.repeat, task.repeatUntil, todayISO())
    return {
      id: task.id,
      label: `${taskTitle(task)} ${taskWhen({ ...task, occursOn: next ?? undefined })}${task.place ? ` · ${task.place}` : ""}${repeatLabel(task.repeat) ? ` · ${repeatLabel(task.repeat)}` : ""}${resolutionByTask.get(task.id) ? ` · ${resolutionByTask.get(task.id)?.result}` : ""}`,
      href: `/matters/${matter.id}/tasks#${task.id}`,
    }
  }
  const elementsConfirmed =
    elements.length > 0 && elements.every((element) => element.confirmedAt)
  const elementActivity =
    elements.length === 0
      ? []
      : [
          {
            id: `elements-${matter.id}`,
            label: elementsConfirmed
              ? `要素 ${elements.length} 条 ${elements[0]?.confirmedAt ?? ""}`
              : `要素 ${elements.length} 条`,
            href: `/matters/${matter.id}/documents`,
          },
        ]
  const focusesConfirmed =
    focuses.length > 0 && focuses.every((focus) => focus.confirmedAt)
  const focusActivity =
    focuses.length === 0
      ? []
      : [
          {
            id: `focuses-${matter.id}`,
            label: focusesConfirmed
              ? `焦点 ${focuses.length} 条 ${focuses[0]?.confirmedAt ?? ""}`
              : `焦点 ${focuses.length} 条`,
            href: `/matters/${matter.id}/documents`,
          },
        ]
  const lastAccepted = sources.reduce(
    (latest, source) => (source.acceptedAt > latest ? source.acceptedAt : latest),
    "",
  )
  const sourceActivity =
    sources.length === 0
      ? []
      : [
          {
            id: `sources-${matter.id}`,
            label: `出处 ${sources.length} 条 ${lastAccepted}`,
            href: `/matters/${matter.id}/documents#sources`,
          },
        ]
  const finalDraft = drafts.find((draft) => draft.final)
  const latestDraft = drafts[0]
  const draftActivity = latestDraft
    ? [
        {
          id: `drafts-${matter.id}`,
          label: finalDraft
            ? `律师定稿 第 ${finalDraft.version} 版 ${finalDraft.createdAt}`
            : `文书 第 ${latestDraft.version} 版 ${latestDraft.createdAt}`,
          href: `/matters/${matter.id}/documents#drafts`,
        },
      ]
    : []
  const pending = [
    ...tasks.filter((task) => !task.confirmedAt && !resolutionByTask.has(task.id)).map(activityItem),
    ...(elementsConfirmed ? [] : elementActivity),
    ...(focusesConfirmed ? [] : focusActivity),
    ...(finalDraft ? [] : draftActivity),
  ]
  const done = [
    ...tasks.filter((task) => task.confirmedAt || resolutionByTask.has(task.id)).map(activityItem),
    ...(elementsConfirmed ? elementActivity : []),
    ...(focusesConfirmed ? focusActivity : []),
    ...sourceActivity,
    ...(finalDraft ? draftActivity : []),
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <CaseSidebar
        matters={matters}
        currentId={matter.id}
        materials={materials.map((material) => ({
          id: material.id,
          filename: material.filename,
        }))}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1">
          <header className="px-4 pt-5 sm:px-8 sm:pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">案件</p>
                <h1 className="mt-1 font-serif text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
                  {matter.name}
                </h1>
                {matter.category ||
                matter.engagedOn ||
                matter.instance ||
                matter.procedure ||
                matter.caseNumber ? (
                  <p className="mt-2 break-words text-sm text-muted">
                    {[
                      matter.category,
                      matter.engagedOn ? `委托 ${matter.engagedOn}` : "",
                      matter.instance,
                      matter.procedure,
                      matter.caseNumber,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <div className="sm:shrink-0 sm:pt-2">
                <StatusControl matterId={matter.id} status={matter.status} />
              </div>
            </div>
            <div className="mt-6">
              <PartyColumns parties={groupParties(parties)} courtName={matter.courtName} />
            </div>
          </header>
          <MatterNav matterId={matter.id} />
          <div className="lg:hidden">
            <ActivityPanel pending={pending} done={done} />
          </div>
          <SectionShift matterId={matter.id}>{children}</SectionShift>
        </div>
        <div className="hidden lg:block">
          <ActivityPanel pending={pending} done={done} />
        </div>
      </div>
      <MatterAsk matterId={matter.id} />
    </div>
  )
}
