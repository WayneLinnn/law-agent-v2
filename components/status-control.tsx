"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { canMoveStatus, MOVABLE_STATUSES } from "@/lib/constants";

export function StatusControl({
  matterId,
  status,
}: {
  matterId: string;
  status: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (current !== status && !pending) setCurrent(status);

  if (!canMoveStatus(status)) {
    return (
      <p className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-xs font-medium text-foreground">
        {status}
      </p>
    );
  }

  return (
    <label className="block text-xs font-medium text-muted">
      状态
      <select
        aria-label="案件状态"
        value={current}
        disabled={pending}
        onChange={async (event) => {
          const next = event.target.value;
          setCurrent(next);
          setPending(true);
          setError(null);
          const response = await fetch(`/api/matters/${matterId}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: next }),
          });
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setPending(false);
          if (!response.ok) {
            setCurrent(status);
            setError(body?.error ?? "没有改状态。");
            return;
          }
          router.refresh();
        }}
        className="mt-1 block rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-foreground"
      >
        {MOVABLE_STATUSES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-seal">{error}</p> : null}
    </label>
  );
}
