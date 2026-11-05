import { Suspense } from "react";

import { MatterFrame } from "@/components/matter-frame";

function MatterFallback() {
  return (
    <main className="bg-background px-8 py-6 text-foreground">
      <p className="font-serif text-lg">办案</p>
      <p className="mt-3 text-sm text-muted">正在读取案件。</p>
    </main>
  );
}

export default function MatterLayout({
  children,
  params,
}: LayoutProps<"/matters/[id]">) {
  return (
    <Suspense fallback={<MatterFallback />}>
      <MatterLayoutBody params={params}>{children}</MatterLayoutBody>
    </Suspense>
  );
}

async function MatterLayoutBody({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatterFrame matterId={id}>{children}</MatterFrame>;
}
