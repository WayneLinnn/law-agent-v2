"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ContractAsk } from "@/lib/contracts";

export function ContractQuestions({ reviewId, asks }: { reviewId: string; asks: ContractAsk[] }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || pending) return;
    setPending(true);
    setError(null);
    const response = await fetch(`/api/review/${reviewId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "没有回答。");
      return;
    }
    setQuestion("");
    router.refresh();
  }

  return (
    <section className="mt-8 max-w-3xl">
      <h2 className="text-sm text-foreground">就这份合同提问</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        只看这份正文和这些审查点。回答里新写的条号会再核对；核不上的那句不当成法条。
      </p>
      <form className="mt-3" onSubmit={submit}>
        <textarea
          className="field min-h-24 w-full min-w-0"
          maxLength={500}
          value={question}
          placeholder="最多 500 个字"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Button className="mt-3" type="submit" disabled={pending || question.trim().length === 0}>
          {pending ? "正在回答" : "提问"}
        </Button>
        {pending ? <p className="mt-2 text-sm text-muted">请留在这一页。</p> : null}
      </form>
      {asks.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-3">
          {asks.map((ask) => (
            <li key={ask.id} className="panel px-4 py-3">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted">{ask.question}</p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{ask.answer}</p>
              {ask.lawNote ? <p className="mt-2 text-sm text-seal">{ask.lawNote}</p> : null}
              {ask.laws.map((law) => (
                <div key={law.law} className="mt-3 border-t border-line pt-3">
                  <p className="break-words text-xs text-muted">
                    {[law.law, law.status, law.detail].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{law.text}</p>
                  {law.url ? (
                    <a href={law.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-foreground underline">
                      在北大法宝打开
                    </a>
                  ) : null}
                </div>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-2 text-sm text-seal">{error}</p> : null}
    </section>
  );
}
