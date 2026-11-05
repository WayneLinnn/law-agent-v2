"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DELETE_HOLD_DAYS } from "@/lib/constants";
import { plusDays, todayISO } from "@/lib/figures";

export function DeleteMatter({
  matterId,
  status,
  deletedOn,
}: {
  matterId: string;
  status: string;
  deletedOn: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const purgeOn = plusDays(deletedOn, DELETE_HOLD_DAYS);
  const ready = status === "已删除" && purgeOn !== "" && todayISO() >= purgeOn;

  async function onClick() {
    setPending(true);
    setError(null);
    const response = await fetch(
      `/api/matters/${matterId}/${status === "已删除" ? "purge" : "delete"}`,
      { method: "POST" },
    );
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有删掉这件案子。");
      return;
    }
    if (status === "已删除") {
      router.push("/");
      return;
    }
    router.refresh();
  }

  if (status === "已删除") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm leading-6 text-foreground">
          {ready
            ? "保留期已过，可以彻底删除。案子和材料会从这台电脑去掉。"
            : `已删除。保留到 ${purgeOn || "删除日期未记下"}，之后可以彻底删除。`}
        </p>
        {ready ? (
          <Button type="button" variant="seal" disabled={pending} onClick={onClick}>
            {pending ? "正在删除" : "彻底删除"}
          </Button>
        ) : null}
        {error ? <p className="text-sm text-seal">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="outline" disabled={pending} onClick={onClick}>
        {pending ? "正在删除" : "删除案件"}
      </Button>
      <p className="text-sm leading-6 text-muted">
        删除后进入已删除，保留 30 天，之后可以彻底删除。
      </p>
      {error ? <p className="text-sm text-seal">{error}</p> : null}
    </div>
  );
}
