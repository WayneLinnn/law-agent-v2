import { Suspense } from "react";
import Link from "next/link";

import { CaseSidebar } from "@/components/case-sidebar";
import { ContractReviewForm } from "@/components/contract-review-form";
import { listMatters } from "@/lib/matters";

function ReviewFallback() {
  return (
    <main className="bg-background px-4 py-6 text-foreground sm:px-8">
      <h1 className="font-serif text-2xl sm:text-3xl">审合同</h1>
      <p className="mt-3 text-sm text-muted">正在读取。</p>
    </main>
  );
}

async function ReviewScreen() {
  const matters = await listMatters();

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <CaseSidebar matters={matters} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <h1 className="font-serif text-2xl text-foreground sm:text-3xl">审合同</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          一次放一份合同。先选类型和立场。审查点出来之后，点了名的法条再去核对原文。
        </p>
        <p className="mt-3 text-sm">
          <Link href="/" className="text-foreground underline">
            回到工作台
          </Link>
        </p>
        <ContractReviewForm />
      </main>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<ReviewFallback />}>
      <ReviewScreen />
    </Suspense>
  );
}
