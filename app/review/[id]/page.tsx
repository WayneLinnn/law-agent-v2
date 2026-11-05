import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CaseSidebar } from "@/components/case-sidebar";
import { ContractBody } from "@/components/contract-body";
import { ContractPoints } from "@/components/contract-points";
import { ContractQuestions } from "@/components/contract-questions";
import { getContractReview } from "@/lib/contract-reviews";
import { listMatters } from "@/lib/matters";

function ReviewFallback() {
  return (
    <main className="bg-background px-4 py-6 text-foreground sm:px-8">
      <h1 className="font-serif text-2xl sm:text-3xl">审合同</h1>
      <p className="mt-3 text-sm text-muted">正在读取。</p>
    </main>
  );
}

async function SavedReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [matters, review] = await Promise.all([listMatters(), getContractReview(id)]);
  if (!review) notFound();

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <CaseSidebar matters={matters} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <h1 className="font-serif text-2xl text-foreground sm:text-3xl">审合同</h1>
        <p className="mt-2 break-words text-sm text-foreground">{review.filename}</p>
        <p className="mt-1 break-words text-sm text-muted">
          {[review.kind, review.stance, review.reader].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-3 text-sm">
          <Link href="/review" className="text-foreground underline">
            再放一份
          </Link>
        </p>
        <ContractBody text={review.body} />
        <ContractPoints reviewId={review.id} points={review.points} lawNote={review.lawNote} />
        {review.points.length > 0 ? <ContractQuestions reviewId={review.id} asks={review.asks} /> : null}
      </main>
    </div>
  );
}

export default function SavedReviewPage({ params }: PageProps<"/review/[id]">) {
  return (
    <Suspense fallback={<ReviewFallback />}>
      <SavedReview params={params} />
    </Suspense>
  );
}
