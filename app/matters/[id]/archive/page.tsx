import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ClosingPanel } from "@/components/closing-panel";
import { getClosing } from "@/lib/closing";
import { getMatter } from "@/lib/matters";
import { listSources } from "@/lib/research";

export default function ArchivePage({ params }: PageProps<"/matters/[id]/archive">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">正在读取结案记录。</p>}>
      <Archive params={params} />
    </Suspense>
  );
}

async function Archive({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, closing, sources] = await Promise.all([getMatter(id), getClosing(id), listSources(id)]);
  if (!detail) notFound();
  return (
    <ClosingPanel key={`${detail.matter.status}:${Boolean(closing.record)}:${closing.record?.archivedAt ?? ""}`}
      matterId={id} status={detail.matter.status} tasks={detail.tasks}
      record={closing.record} resolutions={closing.resolutions} dossier={closing.dossier} sources={sources} />
  );
}
