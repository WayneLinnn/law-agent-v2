import { Suspense } from "react";
import Link from "next/link";

import { CaseSidebar } from "@/components/case-sidebar";
import { JudgeDirectory } from "@/components/judge-directory";
import { listJudges } from "@/lib/judges";
import { listMatters } from "@/lib/matters";

function JudgesFallback() {
  return (
    <main className="bg-background px-4 py-6 text-foreground sm:px-8">
      <h1 className="font-serif text-2xl sm:text-3xl">法官</h1>
      <p className="mt-3 text-sm text-muted">正在读取。</p>
    </main>
  );
}

async function JudgesScreen() {
  const [matters, judges] = await Promise.all([listMatters(), listJudges()]);

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <CaseSidebar matters={matters} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <h1 className="font-serif text-2xl text-foreground sm:text-3xl">法官</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          姓名、庭室和电话留在这里。办案时选用，不用在每件案子里重打。案子上记下的仍是当时填写的文字。
        </p>
        <p className="mt-3 text-sm">
          <Link href="/" className="text-foreground underline">
            回到工作台
          </Link>
        </p>
        <JudgeDirectory judges={judges} />
      </main>
    </div>
  );
}

export default function JudgesPage() {
  return (
    <Suspense fallback={<JudgesFallback />}>
      <JudgesScreen />
    </Suspense>
  );
}
