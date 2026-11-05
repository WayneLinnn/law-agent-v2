"use client"

import Link from "next/link"
import { useState } from "react"

import { Release } from "@/components/fold"
import { cn } from "@/lib/utils"
import type { MatterSummary } from "@/lib/types"

export function CaseSidebar({
  matters,
  currentId,
  materials,
}: {
  matters: MatterSummary[]
  currentId?: string
  materials?: { id: string; filename: string }[]
}) {
  const [casesOpen, setCasesOpen] = useState(false)
  const [filesOpen, setFilesOpen] = useState(false)
  const listed = matters.filter((matter) => matter.status !== "已删除")
  const deleted = matters.filter((matter) => matter.status === "已删除")
  const headMatters = listed.slice(0, 6)
  const restMatters = listed.slice(6)
  const headFiles = materials?.slice(0, 4) ?? []
  const restFiles = materials?.slice(4) ?? []
  return (
    <aside className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div className="px-4 py-5">
        <Link href="/" className="text-base font-medium tracking-tight text-sidebar-foreground">
          办案
        </Link>
      </div>
      <nav aria-label="案件" className="px-3">
        <p className="px-2 text-xs font-medium text-sidebar-muted">案件</p>
        <ul className="mt-1 flex gap-2 overflow-x-auto pb-3 lg:block lg:overflow-visible lg:pb-0">
          {headMatters.map((matter) => {
            const active = matter.id === currentId
            return (
              <li key={matter.id} className="shrink-0 lg:shrink">
                <Link
                  href={`/matters/${matter.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block max-w-52 rounded-lg px-2.5 py-2 text-sm leading-5 text-sidebar-foreground transition-colors duration-200 lg:max-w-none",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent",
                  )}
                >
                  {matter.name}
                </Link>
              </li>
            )
          })}
        </ul>
        <Release open={casesOpen}>
          <ul className="flex gap-2 overflow-x-auto pb-3 lg:block lg:overflow-visible lg:pb-0">
            {restMatters.map((matter) => {
              const active = matter.id === currentId
              return (
                <li key={matter.id} className="shrink-0 lg:shrink">
                  <Link
                    href={`/matters/${matter.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block max-w-52 rounded-lg px-2.5 py-2 text-sm leading-5 text-sidebar-foreground transition-colors duration-200 lg:max-w-none",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent",
                    )}
                  >
                    {matter.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </Release>
        {listed.length > 6 ? (
          <button
            type="button"
            className="mt-1 px-2 text-xs font-medium text-sidebar-muted transition-colors duration-200 hover:text-sidebar-foreground"
            onClick={() => setCasesOpen((current) => !current)}
          >
            {casesOpen ? "收起" : `展开其余 ${listed.length - 6} 件`}
          </button>
        ) : null}
        {deleted.length > 0 ? (
          <div className="mt-4">
            <p className="px-2 text-xs font-medium text-sidebar-muted">已删除</p>
            <ul className="mt-1 flex gap-2 overflow-x-auto pb-3 lg:block lg:overflow-visible lg:pb-0">
              {deleted.map((matter) => {
                const active = matter.id === currentId
                return (
                  <li key={matter.id} className="shrink-0 lg:shrink">
                    <Link
                      href={`/matters/${matter.id}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block max-w-52 rounded-lg px-2.5 py-2 text-sm leading-5 text-sidebar-muted transition-colors duration-200 lg:max-w-none",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent",
                      )}
                    >
                      {matter.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </nav>
      {currentId && materials ? (
        <nav aria-label="材料" className="px-3 pb-4 lg:mt-6 lg:pb-6">
          <p className="px-2 text-xs font-medium text-sidebar-muted">材料</p>
          <ul className="mt-1 flex gap-2 overflow-x-auto lg:block lg:overflow-visible">
            {materials.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-sidebar-muted">还没有材料</li>
            ) : (
              headFiles.map((material) => (
                <li key={material.id} className="shrink-0 lg:shrink">
                  <Link
                    href={`/matters/${currentId}/materials#${material.id}`}
                    className="block max-w-52 rounded-md px-2 py-1.5 text-sm leading-5 text-sidebar-foreground transition-colors duration-200 hover:bg-sidebar-accent lg:max-w-none"
                  >
                    {material.filename}
                  </Link>
                </li>
              ))
            )}
          </ul>
          <Release open={filesOpen}>
            <ul className="flex gap-2 overflow-x-auto lg:block lg:overflow-visible">
              {restFiles.map((material) => (
                <li key={material.id} className="shrink-0 lg:shrink">
                  <Link
                    href={`/matters/${currentId}/materials#${material.id}`}
                    className="block max-w-52 rounded-md px-2 py-1.5 text-sm leading-5 text-sidebar-foreground transition-colors duration-200 hover:bg-sidebar-accent lg:max-w-none"
                  >
                    {material.filename}
                  </Link>
                </li>
              ))}
            </ul>
          </Release>
          {materials.length > 4 ? (
            <button
              type="button"
              className="mt-1 px-2 text-xs font-medium text-sidebar-muted transition-colors duration-200 hover:text-sidebar-foreground"
              onClick={() => setFilesOpen((current) => !current)}
            >
              {filesOpen ? "收起" : `展开其余 ${materials.length - 4} 份`}
            </button>
          ) : null}
        </nav>
      ) : null}
    </aside>
  )
}
