"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SavedLine } from "@/components/saved-line";
import { Button } from "@/components/ui/button";

const fieldClass =
  "mt-2 w-full min-w-0 field";

function amountText(value: number | null) {
  return value === null ? "" : String(value);
}

export function FeeRecord({
  matterId,
  receivable,
  received,
  editable,
}: {
  matterId: string;
  receivable: number | null;
  received: number | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [feeReceivable, setFeeReceivable] = useState(amountText(receivable));
  const [feeReceived, setFeeReceived] = useState(amountText(received));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const body: { feeReceivable?: string; feeReceived?: string } = {};
    if (feeReceivable.trim()) body.feeReceivable = feeReceivable.trim();
    if (feeReceived.trim()) body.feeReceived = feeReceived.trim();
    if (!body.feeReceivable && !body.feeReceived) {
      setPending(false);
      setError("请填写应收或实收。");
      return;
    }
    const response = await fetch(`/api/matters/${matterId}/figures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(result?.error ?? "费用没有记下。");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm text-foreground">费用</h2>
      <p className="text-sm leading-6 text-muted">
        应收在立案前写下。客户付款时记下实收。
      </p>
      {editable ? (
        <form
          onSubmit={save}
          onChange={() => setSaved(false)}
          className="grid grid-cols-1 gap-4 panel px-4 py-4 sm:grid-cols-2"
        >
          <label className="min-w-0 text-xs text-muted">
            应收（元）
            <input
              value={feeReceivable}
              onChange={(event) => setFeeReceivable(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          <label className="min-w-0 text-xs text-muted">
            实收（元）
            <input
              value={feeReceived}
              onChange={(event) => setFeeReceived(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          {error ? <p className="text-sm text-seal sm:col-span-2">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "正在记下" : "记下费用"}
            </Button>
            <SavedLine show={saved} />
          </div>
        </form>
      ) : (
        <p className="text-sm text-foreground">
          {`应收 ${receivable ?? "未填写"} · 实收 ${received ?? "未填写"}`}
        </p>
      )}
    </section>
  );
}
