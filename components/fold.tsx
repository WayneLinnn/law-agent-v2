"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const release = "max-height 520ms cubic-bezier(0.22, 1, 0.36, 1)";

export function Release({
  open,
  children,
  className,
  fade = false,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  fade?: boolean;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      const outer = node.parentElement;
      if (!outer) return;
      let next = node.scrollHeight;
      if (next === 0) {
        const prev = outer.style.maxHeight;
        outer.style.maxHeight = "none";
        next = node.scrollHeight;
        outer.style.maxHeight = prev;
      }
      setHeight((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [children, open]);

  return (
    <div
      className={cn("overflow-hidden", className)}
      style={{
        maxHeight: open ? height : 0,
        opacity: fade ? (open ? 1 : 0) : undefined,
        transition: fade ? `${release}, opacity 420ms cubic-bezier(0.22, 1, 0.36, 1)` : release,
      }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}

export function Fold({
  children,
  className,
  limit = 160,
  fade = "from-background",
}: {
  children: React.ReactNode;
  className?: string;
  limit?: number;
  collapsedClass?: string;
  fade?: "from-background" | "from-surface";
}) {
  const body = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(0);
  const [ease, setEase] = useState(false);

  useLayoutEffect(() => {
    const node = body.current;
    if (!node) return;
    const measure = () => setFull(node.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children]);

  const overflows = full > limit + 8;
  const maxHeight = !overflows || open ? full : limit;

  return (
    <div className={className}>
      <div
        className="relative overflow-hidden"
        style={{ maxHeight, transition: ease ? release : "none" }}
      >
        <div ref={body}>{children}</div>
        {overflows && !open ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t to-transparent",
              fade,
            )}
          />
        ) : null}
      </div>
      {overflows ? (
        <button
          type="button"
          className="mt-2 text-xs text-muted underline underline-offset-4 transition-colors duration-200 hover:text-foreground"
          onClick={() => {
            setEase(true);
            setOpen((current) => !current);
          }}
        >
          {open ? "收起" : "展开"}
        </button>
      ) : null}
    </div>
  );
}
