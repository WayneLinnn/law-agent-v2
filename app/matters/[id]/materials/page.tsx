import { Suspense } from "react";
import { notFound } from "next/navigation";

import { AddMaterialForm } from "@/components/add-material-form";
import { BriefRow } from "@/components/brief-row";
import { HandlingGate } from "@/components/handling-gate";
import { MaterialCard } from "@/components/material-card";
import { canEditRecord, TERMINATED_NOTE } from "@/lib/constants";
import { getMatter } from "@/lib/matters";
import { listRulings } from "@/lib/rulings";

export default function MaterialsPage({
  params,
}: PageProps<"/matters/[id]/materials">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">正在读取材料。</p>}>
      <Materials params={params} />
    </Suspense>
  );
}

async function Materials({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getMatter(id);
  if (!detail) notFound();

  const { matter, materials, parties } = detail;
  const rulings = await listRulings(matter.id);
  const canAdd =
    matter.status === "草稿" ||
    matter.status === "待立案" ||
    matter.status === "办理中";
  const editable = canEditRecord(matter.status);

  return (
    <section className="flex flex-col gap-4">
      {canAdd ? <AddMaterialForm matterId={id} parties={parties} /> : null}
      {matter.status === "已终止" ? (
        <p className="text-sm leading-6 text-foreground">{TERMINATED_NOTE}</p>
      ) : null}
      <HandlingGate
        matterId={matter.id}
        status={matter.status}
        materialCount={materials.length}
      />
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm text-foreground">材料</h2>
        <p className="text-sm text-muted">{materials.length} 份</p>
      </div>
      {materials.length === 0 ? (
        <p className="text-sm text-muted">本案还没有材料。</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          {materials.map((material) => (
            <BriefRow
              key={material.id}
              id={material.id}
              label={material.kind}
              summary={material.filename}
            >
              <MaterialCard
                matterId={matter.id}
                material={material}
                parties={parties}
                ruling={
                  rulings.find((item) => item.materialId === material.id) ?? null
                }
                editable={editable}
                caseNumber={matter.caseNumber}
                courtName={matter.courtName}
              />
            </BriefRow>
          ))}
        </div>
      )}
    </section>
  );
}
