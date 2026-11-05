"use client";

import { useEffect, useState } from "react";

import { Release } from "@/components/fold";
import { cn } from "@/lib/utils";

export function BriefRow({
  label,
  summary,
  children,
  id,
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
  id?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const sync = () => {
      if (window.location.hash === `#${id}`) setOpen(true);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [id]);

  return (
    <div id={id} className="scroll-mt-6 border-b border-line last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-4 py-3 text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="w-20 shrink-0 whitespace-nowrap text-sm font-medium text-foreground">{label}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">{summary}</span>
        <span
          aria-hidden
          className={cn("text-sm text-muted transition-transform duration-300", open && "rotate-90")}
        >
          ›
        </span>
      </button>
      <Release open={open}>
        <div inert={open ? undefined : true} className="px-4 pb-4 [&>section>h2]:hidden">
          {children}
        </div>
      </Release>
    </div>
  );
}
