"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ConfirmFilingButton({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/confirm`, {
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有确认建档。");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="seal"
        size="lg"
        disabled={pending}
        onClick={onClick}
      >
        {pending ? "正在确认" : "确认建档"}
      </Button>
      <p className="text-sm text-muted">确认之后，这件案子进入待立案。</p>
      {error ? <p className="text-sm text-seal">{error}</p> : null}
    </div>
  );
}
