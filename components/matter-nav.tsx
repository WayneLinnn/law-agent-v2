"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { MATTER_SECTIONS, sectionHref } from "@/lib/constants"
import { cn } from "@/lib/utils"

export function MatterNav({ matterId }: { matterId: string }) {
  const pathname = usePathname()

  return (
    <nav aria-label="案件分区" className="mt-6 flex gap-1 overflow-x-auto border-b border-line px-4 pb-2 sm:px-8">
      {MATTER_SECTIONS.map((section) => {
        const href = sectionHref(matterId, section.slug)
        const active = pathname === href
        return (
          <Link
            key={section.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-200",
              active
                ? "bg-surface text-foreground shadow-[var(--shadow)]"
                : "text-muted hover:bg-surface hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
