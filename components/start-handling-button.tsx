"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function StartHandlingButton({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/handle`, {
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有进入办理中。");
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
        {pending ? "正在进入" : "进入办理中"}
      </Button>
      <p className="text-sm text-muted">进入之后，这件案子开始办理。</p>
      {error ? <p className="text-sm text-seal">{error}</p> : null}
    </div>
  );
}
