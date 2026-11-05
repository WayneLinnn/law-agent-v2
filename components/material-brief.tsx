"use client";

import Link from "next/link";
import { useState } from "react";

import { Release } from "@/components/fold";

const VISIBLE = 4;

export function MaterialBrief({
  matterId,
  materials,
}: {
  matterId: string;
  materials: { id: string; kind: string; filename: string; createdAt: string }[];
}) {
  const [open, setOpen] = useState(false);
  if (materials.length === 0) {
    return <p className="text-sm text-muted">本案还没有材料。</p>;
  }

  const head = materials.slice(0, VISIBLE);
  const rest = materials.slice(VISIBLE);

  function row(material: (typeof materials)[number]) {
    return (
      <li key={material.id} className="border-b border-line last:border-b-0">
        <Link
          href={`/matters/${matterId}/materials#${material.id}`}
          className="flex items-baseline gap-3 py-2"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {material.kind} · {material.filename}
          </span>
          <time className="shrink-0 text-xs text-muted">{material.createdAt}</time>
        </Link>
      </li>
    );
  }

  return (
    <div>
      <ul>{head.map(row)}</ul>
      {rest.length > 0 ? (
        <>
          <Release open={open}>
            <ul>{rest.map(row)}</ul>
          </Release>
          <button
            type="button"
            className="mt-2 text-sm text-muted"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "收起" : `展开其余 ${rest.length} 份`}
          </button>
        </>
      ) : null}
    </div>
  );
}
