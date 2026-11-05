"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ConfirmTaskButton({
  matterId,
  taskId,
}: {
  matterId: string;
  taskId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setError(null);
    const response = await fetch(
      `/api/matters/${matterId}/tasks/${taskId}/confirm`,
      { method: "POST" },
    );
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有确认这条待办。");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="seal"
        disabled={pending}
        onClick={onClick}
      >
        {pending ? "正在确认" : "确认"}
      </Button>
      <p className="text-sm leading-6 text-muted">
        确认之后，出现在工作台的到期里。
      </p>
      {error ? <p className="text-sm text-seal">{error}</p> : null}
    </div>
  );
}
