"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { contractKind, CONTRACT_KINDS } from "@/lib/contracts";

export function ContractReviewForm() {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof CONTRACT_KINDS)[number]["label"]>(CONTRACT_KINDS[0].label);
  const [stance, setStance] = useState<string>(CONTRACT_KINDS[0].stances[0]);
  const [reader, setReader] = useState("");
  const [filename, setFilename] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = contractKind(kind);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    const response = await fetch("/api/review", { method: "POST", body: data });
    const body = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
    setPending(false);
    if (!response.ok || !body?.id) {
      setError(body?.error ?? "没有读入。");
      return;
    }
    router.push(`/review/${body.id}`);
  }

  function onKind(value: string) {
    const next = contractKind(value);
    setKind(next.label);
    setStance(next.stances[0]);
  }

  return (
    <form
      className="mt-6 flex max-w-xl flex-col gap-4"
      onSubmit={onSubmit}
    >
      <label className="block text-xs text-muted">
        合同
        <input
          className="mt-2 field"
          type="file"
          name="file"
          accept=".txt,.pdf,text/plain,application/pdf"
          onChange={(event) => {
            setFilename(event.target.files?.[0]?.name ?? "");
            setError(null);
          }}
        />
      </label>
      <p className="text-sm text-muted">{filename || "一次一份，txt 或 pdf。"}</p>
      <label className="block text-xs text-muted">
        合同类型
        <select className="mt-2 field" name="kind" value={kind} onChange={(event) => onKind(event.target.value)}>
          {CONTRACT_KINDS.map((item) => (
            <option key={item.label}>{item.label}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted">
        审查立场
        <select className="mt-2 field" name="stance" value={stance} onChange={(event) => setStance(event.target.value)}>
          {selected.stances.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted">
        审阅人
        <input
          className="mt-2 field"
          name="reader"
          value={reader}
          maxLength={10}
          placeholder="可空，最多 10 个字"
          onChange={(event) => setReader(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-seal">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !filename}>
          {pending ? "正在读入" : "读入合同"}
        </Button>
        <Button type="button" disabled>
          开始审查
        </Button>
      </div>
      <p className="text-sm text-muted">读不出文字就不能开始。这一步先不审查。</p>
    </form>
  );
}
