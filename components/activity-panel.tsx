"use client"

import { useState } from "react"
import Link from "next/link"

import { Fold, Release } from "@/components/fold"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const groups = [
  { key: "doing", label: "进行中", tone: "text-foreground" },
  { key: "pending", label: "待确认", tone: "text-seal" },
  { key: "done", label: "已完成", tone: "text-done" },
] as const

export type ActivityItem = { id: string; label: string; href: string }

export function ActivityPanel({
  pending = [],
  done = [],
}: {
  pending?: ActivityItem[]
  done?: ActivityItem[]
}) {
  const [open, setOpen] = useState(true)
  const items = { doing: [] as ActivityItem[], pending, done }

  return (
    <aside
      className={cn(
        "flex flex-col border-t border-line bg-background lg:sticky lg:top-0 lg:h-dvh lg:shrink-0 lg:border-t-0 lg:border-l",
        open ? "lg:w-72 lg:overflow-y-auto" : "lg:w-12 lg:overflow-hidden",
      )}
      style={{ transition: "width 520ms cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <div className={cn("flex items-center justify-between px-4 py-4", !open && "lg:justify-center lg:px-1")}>
        <h2 className={cn("text-sm font-medium text-foreground", !open && "lg:hidden")}>活动</h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen((current) => !current)}>
          {open ? "收起" : "活动"}
        </Button>
      </div>
      <Release open={open}>
      <div className="flex flex-col gap-6 px-4 pb-6">
        {groups.map((group) => (
          <section key={group.key}>
            <h3 className={cn("px-2 text-xs font-medium", group.tone)}>{group.label}</h3>
            {items[group.key].length === 0 ? (
              <p className="mt-2 text-sm text-muted">还没有</p>
            ) : (
              <Fold className="mt-2">
              <ul className="flex flex-col gap-2">
                {items[group.key].map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="block break-words rounded-lg px-2 py-1.5 text-sm leading-5 text-foreground transition-colors duration-200 hover:bg-surface"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              </Fold>
            )}
          </section>
        ))}
      </div>
      </Release>
    </aside>
  )
}
