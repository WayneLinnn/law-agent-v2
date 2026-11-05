import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefRow } from "@/components/brief-row";
import { ConfirmFilingButton } from "@/components/confirm-filing-button";
import { DeleteMatter } from "@/components/delete-matter";
import { CourtPanel } from "@/components/court-panel";
import { FeeRecord } from "@/components/fee-record";
import { HandlingGate } from "@/components/handling-gate";
import { PartyEditor } from "@/components/party-editor";
import { PreservationPanel } from "@/components/preservation-panel";
import { ProceedingPanel } from "@/components/proceeding-panel";
import { TerminateMatter } from "@/components/terminate-matter";
import { canEditRecord } from "@/lib/constants";
import { getCourtOfficer } from "@/lib/court";
import { listJudges } from "@/lib/judges";
import { getMatter } from "@/lib/matters";
import { getPreservation } from "@/lib/preservation";
import { listProceedings } from "@/lib/proceedings";

export default function OverviewPage({
  params,
}: PageProps<"/matters/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">正在读取案件。</p>}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getMatter(id);
  if (!detail) notFound();

  const { matter, materials, parties } = detail;
  const [proceedings, officer, judges, preservation] = await Promise.all([
    listProceedings(matter.id),
    getCourtOfficer(matter.id),
    listJudges(),
    getPreservation(matter.id),
  ]);
  const editable = canEditRecord(matter.status);
  const people = parties
    .filter((party) => party.role !== "court")
    .sort((left, right) => {
      const order = { client: 0, ally: 1, opposing: 2, court: 3 };
      return order[left.role] - order[right.role];
    });
  const proceedingSummary =
    [matter.category, matter.instance, matter.caseNumber].filter(Boolean).join(" · ") || "未填写";
  const courtSummary = [matter.courtName, officer.judge].filter(Boolean).join(" · ") || "未填写";
  const preservationSummary =
    [preservation.status, preservation.subject].filter(Boolean).join(" · ") || "未填写";
  const feeSummary = `应收${matter.feeReceivable === null ? "未记" : ` ${matter.feeReceivable}`} · 实收${matter.feeReceived === null ? "未记" : ` ${matter.feeReceived}`}`;
  const partySummary = people.map((party) => party.name).join(" · ") || "未填写";
  const factSummary = matter.facts.replace(/\s+/g, " ").trim() || "未填写";
  const mandateSummary = matter.mandate.replace(/\s+/g, " ").trim() || "未填写";
  const materialSummary = materials.length ? `${materials.length} 份` : "还没有材料";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label htmlFor="case-line" className="text-xs text-muted">
          本案
        </label>
        <input
          id="case-line"
          name="case-line"
          placeholder="就这件案子写一句"
          autoComplete="off"
          className="mt-1 w-full bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none"
        />
      </div>

      <div className="flex flex-col items-start gap-3">
        {matter.status === "草稿" ? (
          <ConfirmFilingButton matterId={matter.id} />
        ) : null}
        <HandlingGate
          matterId={matter.id}
          status={matter.status}
          materialCount={materials.length}
        />
        <TerminateMatter matterId={matter.id} status={matter.status} />
        <DeleteMatter
          matterId={matter.id}
          status={matter.status}
          deletedOn={matter.deletedOn}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <BriefRow label="程序" summary={proceedingSummary}>
        <p className="mb-3 text-sm text-foreground">案由：{matter.cause || "未填写"}</p>
        <ProceedingPanel
        matterId={matter.id}
        caseNumber={matter.caseNumber}
        category={matter.category}
        cause={matter.cause}
        engagedOn={matter.engagedOn}
        instance={matter.instance}
        procedure={matter.procedure}
        editable={editable}
        canOpen={matter.status !== "已终止"}
        parent={proceedings?.parent ?? null}
        children={proceedings?.children ?? []}
      />
      </BriefRow>

      <BriefRow label="法院" summary={courtSummary}>
      <CourtPanel
        matterId={matter.id}
        instance={matter.instance}
        courtName={matter.courtName}
        officer={officer}
        judges={judges}
        editable={editable}
      />
      </BriefRow>

      <BriefRow label="保全" summary={preservationSummary}>
      <PreservationPanel
        matterId={matter.id}
        record={preservation}
        editable={editable}
      />
      </BriefRow>

      <BriefRow label="费用" summary={feeSummary}>
      <FeeRecord
        matterId={matter.id}
        receivable={matter.feeReceivable}
        received={matter.feeReceived}
        editable={editable}
      />
      </BriefRow>

      <BriefRow label="当事人" summary={partySummary}>
      <PartyEditor
        matterId={matter.id}
        parties={parties}
        editable={editable}
      />
      </BriefRow>

      <BriefRow label="事实" summary={factSummary}>
        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
          {matter.facts || "未填写"}
        </p>
      </BriefRow>

      <BriefRow label="委托" summary={mandateSummary}>
        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
          {matter.mandate || "未填写"}
        </p>
      </BriefRow>

      <BriefRow label="材料" summary={materialSummary}>
        {materials.length === 0 ? (
          <p className="text-sm text-muted">本案还没有材料。</p>
        ) : (
          <div className="-mx-4 -mb-4 border-t border-line">
            {materials.map((material) => (
              <BriefRow key={material.id} label={material.kind} summary={material.filename}>
                <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {material.extractedText || "尚未读取"}
                </p>
                <Link
                  href={`/matters/${matter.id}/materials#${material.id}`}
                  className="mt-3 inline-block text-sm text-foreground underline"
                >
                  在材料页打开
                </Link>
              </BriefRow>
            ))}
          </div>
        )}
      </BriefRow>
      </div>
    </div>
  );
}
