"use client";

import { useState } from "react";

import { AskPanel } from "@/components/ask-panel";
import { Button } from "@/components/ui/button";

export function MatterAsk({ matterId }: { matterId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end p-4">
      <div className="pointer-events-auto flex w-[min(28rem,calc(100vw-2rem))] flex-col items-end gap-3">
        {open ? (
          <div className="panel max-h-[min(32rem,70dvh)] w-full overflow-y-auto p-4">
            <AskPanel matterId={matterId} />
          </div>
        ) : null}
        <Button type="button" onClick={() => setOpen((current) => !current)}>
          {open ? "收起" : "法律问题"}
        </Button>
      </div>
    </div>
  );
}
