"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function TerminateMatterButton({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/matters/${matterId}/terminate`, {
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有改为已终止。");
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
        {pending ? "正在更改" : "改为已终止"}
      </Button>
      <p className="text-sm leading-6 text-muted">
        改完之后，这件案子停在已终止，不能再往下推进。
      </p>
      {error ? <p className="text-sm text-seal">{error}</p> : null}
    </div>
  );
}
