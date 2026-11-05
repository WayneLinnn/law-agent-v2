"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

import { MATTER_SECTIONS } from "@/lib/constants";

function sectionIndex(pathname: string, matterId: string) {
  const base = `/matters/${matterId}`;
  if (pathname === base) return 0;
  if (!pathname.startsWith(`${base}/`)) return -1;
  const slug = pathname.slice(base.length + 1).split("/")[0];
  return MATTER_SECTIONS.findIndex((section) => section.slug === slug);
}

export function SectionShift({
  matterId,
  children,
}: {
  matterId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const index = sectionIndex(pathname, matterId);
  const matterSeen = useRef(matterId);
  const indexSeen = useRef(index);
  const node = useRef<HTMLDivElement>(null);
  const running = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    if (matterSeen.current !== matterId) {
      matterSeen.current = matterId;
      indexSeen.current = index;
      return;
    }
    const previous = indexSeen.current;
    indexSeen.current = index;
    if (previous < 0 || index < 0 || previous === index) return;
    const direction = index > previous ? 1 : -1;
    running.current?.cancel();
    running.current =
      node.current?.animate(
        [
          { opacity: 0.4, transform: `translateX(${direction * 18}%)` },
          { opacity: 1, transform: "translateX(0)" },
        ],
        {
          duration: 420,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "both",
        },
      ) ?? null;
  }, [matterId, index]);

  return (
    <div className="overflow-x-clip">
      <div ref={node} className="px-4 py-6 sm:px-8">
        {children}
      </div>
    </div>
  );
}
