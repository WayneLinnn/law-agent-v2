"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

function matterKey(pathname: string) {
  const match = pathname.match(/^\/matters\/([^/]+)/);
  return match?.[1] ?? "";
}

export function CaseShift({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const matter = matterKey(pathname);
  const seen = useRef(matter);
  const node = useRef<HTMLDivElement>(null);
  const running = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    if (seen.current === matter) return;
    seen.current = matter;
    running.current?.cancel();
    running.current =
      node.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 420,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      }) ?? null;
  }, [matter]);

  return <div ref={node}>{children}</div>;
}
