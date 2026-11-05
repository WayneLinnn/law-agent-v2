import { Suspense } from "react";

import { CaseSidebar } from "@/components/case-sidebar";
import { IntakeCard } from "@/components/intake-card";
import { NewMatterForm } from "@/components/new-matter-form";
import { listMatters } from "@/lib/matters";

function NewMatterFallback() {
  return (
    <main className="bg-background px-4 py-6 text-foreground sm:px-8">
      <h1 className="font-serif text-2xl sm:text-3xl">新建案件</h1>
      <p className="mt-3 text-sm text-muted">正在读取案件。</p>
    </main>
  );
}

async function NewMatterScreen() {
  const matters = await listMatters();

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <CaseSidebar matters={matters} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <h1 className="font-serif text-2xl text-foreground sm:text-3xl">
          新建案件
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          先记成草稿。可以把文件丢进来，在创建卡上点明谁是客户；也可以自己填写。确认建档之后，才变为待立案。
        </p>
        <IntakeCard />
        <h2 className="mt-10 text-sm text-foreground">自己填写</h2>
        <NewMatterForm />
      </main>
    </div>
  );
}

export default function NewMatterPage() {
  return (
    <Suspense fallback={<NewMatterFallback />}>
      <NewMatterScreen />
    </Suspense>
  );
}
