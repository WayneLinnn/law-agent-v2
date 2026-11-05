"use client";

import { useState } from "react";

import { Release } from "@/components/fold";
import { cn } from "@/lib/utils";

export function ContractBody({ text }: { text: string }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mt-6 max-w-3xl border border-line bg-background">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1 text-sm text-foreground">{open ? "收起正文" : "展开正文"}</span>
        <span
          aria-hidden
          className={cn("shrink-0 text-sm text-muted transition-transform duration-300", open && "rotate-90")}
        >
          ›
        </span>
      </button>
      <Release open={open} fade>
        <p className="whitespace-pre-wrap break-words px-4 pb-4 text-sm leading-7 text-foreground">{text}</p>
      </Release>
    </div>
  );
}
