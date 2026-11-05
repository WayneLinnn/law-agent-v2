import { Suspense } from "react";
import { notFound } from "next/navigation";

import { DraftPanel } from "@/components/draft-panel";
import { ElementPanel } from "@/components/element-panel";
import { FocusPanel } from "@/components/focus-panel";
import { ResearchPanel } from "@/components/research-panel";
import { TERMINATED_NOTE } from "@/lib/constants";
import { listDrafts } from "@/lib/drafts";
import { getMatter } from "@/lib/matters";
import { listSources } from "@/lib/research";

export default function DocumentsPage({
  params,
}: PageProps<"/matters/[id]/documents">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">正在读取文书。</p>}>
      <Documents params={params} />
    </Suspense>
  );
}

async function Documents({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, sources, drafts] = await Promise.all([
    getMatter(id),
    listSources(id),
    listDrafts(id),
  ]);
  if (!detail) notFound();

  const { matter, elements, focuses } = detail;
  const elementsConfirmed =
    elements.length > 0 && elements.every((element) => element.confirmedAt);
  const confirmedFocuses = focuses.filter((focus) => focus.confirmedAt);
  const pendingFocus = focuses.some((focus) => !focus.confirmedAt);
  const draftPanel = (
    <DraftPanel
      matterId={matter.id}
      status={matter.status}
      sources={sources}
      elements={elements.filter((element) => element.confirmedAt)}
      drafts={drafts}
    />
  );
  if (matter.status !== "办理中") {
    if (drafts.length > 0 && matter.status !== "已终止") return draftPanel;
    return (
      <p className="text-sm leading-6 text-foreground">
        {matter.status === "已终止"
          ? TERMINATED_NOTE
          : "要素和焦点在办理中记下。"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ElementPanel
        key={elements.map((element) => element.id).join() || "none"}
        matterId={matter.id}
        elements={elements}
      />
      <FocusPanel
        matterId={matter.id}
        focuses={focuses}
        elementsConfirmed={elementsConfirmed}
      />
      {confirmedFocuses.length > 0 ? (
        <>
          {pendingFocus ? (
            <p className="text-sm leading-6 text-foreground">
              新加的焦点确认之后，才能检索这一条。已经确认的焦点和原来的出处还在。
            </p>
          ) : null}
          <ResearchPanel
            matterId={matter.id}
            focuses={confirmedFocuses}
            sources={sources}
          />
          {draftPanel}
        </>
      ) : null}
    </div>
  );
}
