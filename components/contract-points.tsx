"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { contractOpinion, type ContractPoint } from "@/lib/contracts";

export function ContractPoints({
  reviewId,
  points,
  lawNote,
}: {
  reviewId: string;
  points: ContractPoint[];
  lawNote: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opinion = contractOpinion(points);

  async function choose(pointId: string, decision: "接受" | "跳过") {
    const current = points.find((point) => point.id === pointId);
    if (!current || current.decision === decision) return;
    setPending(true);
    setError(null);
    const response = await fetch(`/api/review/${reviewId}/points/${pointId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有记下。");
      return;
    }
    router.refresh();
  }

  async function start() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/review/${reviewId}/start`, { method: "POST" });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有审查。");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6">
      {points.length === 0 ? (
        <div>
          <Button type="button" disabled={pending} onClick={start}>
            {pending ? "正在审查" : "开始审查"}
          </Button>
          {pending ? <p className="mt-2 text-sm text-muted">大约要一两分钟，请留在这一页。</p> : null}
        </div>
      ) : (
        <>
        <p className="max-w-3xl text-sm leading-6 text-muted">
          点接受或跳过。审查意见只收接受的卡片。未核上的可以接受，意见里不写那条法。
        </p>
        <ul className="mt-3 flex max-w-3xl flex-col gap-3">
          {lawNote ? <p className="text-sm text-seal">{lawNote}</p> : null}
          {points.map((point, index) => (
            <li key={point.id} className="panel px-4 py-3">
              <p className="text-xs text-muted">
                {index + 1}. {point.level}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{point.issue}</p>
              {point.quote ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{point.quote}</p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{point.suggestion}</p>
              {point.verified ? (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="break-words text-xs text-muted">
                    {[point.law, point.lawStatus, point.lawDetail].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{point.lawText}</p>
                  {point.lawUrl ? (
                    <a href={point.lawUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-foreground underline">
                      在北大法宝打开
                    </a>
                  ) : null}
                </div>
              ) : null}
              {point.law && !point.verified ? <p className="mt-2 text-xs text-seal">未核上</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={point.decision === "接受" ? "default" : "outline"}
                  disabled={pending}
                  onClick={() => choose(point.id, "接受")}
                >
                  接受
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={point.decision === "跳过" ? "default" : "outline"}
                  disabled={pending}
                  onClick={() => choose(point.id, "跳过")}
                >
                  跳过
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {opinion ? (
          <section className="panel mt-6 max-w-3xl px-4 py-3">
            <h2 className="text-sm text-foreground">审查意见</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{opinion}</p>
          </section>
        ) : null}
        </>
      )}
      {error ? <p className="mt-2 text-sm text-seal">{error}</p> : null}
    </div>
  );
}
