"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { categoryFromCause } from "@/lib/causes";
import { CASE_CATEGORIES } from "@/lib/constants";

const fieldClass =
  "mt-2 w-full field";

function RequiredMark() {
  return (
    <abbr title="必填" className="ml-1 text-seal no-underline">
      *
    </abbr>
  );
}

export function NewMatterForm() {
  const router = useRouter();
  const [cause, setCause] = useState("");
  const [category, setCategory] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    setPending(true);
    setError(null);
    const response = await fetch("/api/matters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: value("name"),
        clientName: value("clientName"),
        opposingName: value("opposingName"),
        courtName: value("courtName"),
        cause,
        category,
        feeReceivable: value("feeReceivable"),
        facts: value("facts"),
        mandate: value("mandate"),
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      id?: string;
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok || !body?.id) {
      setError(body?.error ?? "没有建成这件案子。");
      return;
    }
    router.push(`/matters/${body.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex max-w-3xl flex-col gap-5">
      <label className="text-xs text-muted">
        案件名称
        <RequiredMark />
        <input name="name" autoComplete="off" aria-required="true" className={fieldClass} />
      </label>
      <label className="text-xs text-muted">
        客户
        <RequiredMark />
        <input
          name="clientName"
          autoComplete="off"
          aria-required="true"
          className={fieldClass}
        />
      </label>
      <label className="text-xs text-muted">
        对方
        <RequiredMark />
        <input
          name="opposingName"
          autoComplete="off"
          aria-required="true"
          className={fieldClass}
        />
      </label>
      <label className="text-xs text-muted">
        法院
        <input
          name="courtName"
          autoComplete="off"
          placeholder="可以先空着"
          className={fieldClass}
        />
      </label>
      <label className="text-xs text-muted">
        案由
        <RequiredMark />
        <input
          value={cause}
          onChange={(event) => {
            const next = event.target.value;
            setCause(next);
            if (!categoryTouched) setCategory(categoryFromCause(next));
          }}
          autoComplete="off"
          aria-required="true"
          className={fieldClass}
        />
      </label>
      <label className="text-xs text-muted">
        类型
        <select
          value={category}
          onChange={(event) => {
            setCategoryTouched(true);
            setCategory(event.target.value);
          }}
          className={fieldClass}
        >
          <option value="">按案由识别，对不上就手选</option>
          {CASE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted">
        应收（元）
        <input
          name="feeReceivable"
          inputMode="decimal"
          autoComplete="off"
          placeholder="可以先空着"
          className={fieldClass}
        />
      </label>
      <label className="text-xs text-muted">
        基本事实
        <RequiredMark />
        <textarea name="facts" rows={4} aria-required="true" className={fieldClass} />
      </label>
      <label className="text-xs text-muted">
        委托事项
        <RequiredMark />
        <textarea name="mandate" rows={4} aria-required="true" className={fieldClass} />
      </label>
      {error ? <p className="text-sm text-seal">{error}</p> : null}
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "正在保存" : "保存为草稿"}
        </Button>
      </div>
    </form>
  );
}
