"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { SavedLine } from "@/components/saved-line";
import { Button } from "@/components/ui/button";
import { MATERIAL_KINDS, partyLabel } from "@/lib/constants";
import { FILE_ACCEPT } from "@/lib/file-kinds";
import type { PartyRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "mt-2 w-full min-w-0 field";

export function AddMaterialForm({
  matterId,
  parties,
}: {
  matterId: string;
  parties: PartyRecord[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [kind, setKind] = useState("往来文书");
  const [filename, setFilename] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  function rememberFile(file: File | null) {
    const input = fileRef.current;
    if (!input) return;
    if (!file) {
      input.value = "";
      setFilename("");
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    setFilename(file.name);
    setError(null);
    setSaved(false);
  }

  function onDragEnter(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const { files } = event.dataTransfer;
    if (files.length > 1) {
      setError("一次放一份。");
      return;
    }
    const file = files[0];
    if (!file) return;
    rememberFile(file);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("请选择一份材料。");
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/matters/${matterId}/materials`, {
      method: "POST",
      body: new FormData(form),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error ?? "这份材料没有放进去。");
      return;
    }
    form.reset();
    setKind("往来文书");
    setFilename("");
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      onChange={() => setSaved(false)}
      className="flex flex-col gap-3 panel px-4 py-4"
    >
      <label
        htmlFor="material-file"
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center",
          dragging ? "border-foreground bg-background" : "border-line",
        )}
      >
        <span className="text-sm text-foreground">把材料拖到这里，或点此选择</span>
        <span className="mt-1 text-xs text-muted">{filename || "一次一份"}</span>
        <input
          id="material-file"
          ref={fileRef}
          name="file"
          type="file"
          accept={FILE_ACCEPT}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setFilename(file ? file.name : "");
            setError(null);
            setSaved(false);
          }}
        />
      </label>
      <label className="min-w-0 text-xs text-muted">
        种类
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className={fieldClass}
        >
          {MATERIAL_KINDS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      {kind === "证据" ? (
        <>
          <label className="min-w-0 text-xs text-muted">
            证明对象
            <input
              name="proves"
              autoComplete="off"
              placeholder="可以先空着"
              className={fieldClass}
            />
          </label>
          <label className="min-w-0 text-xs text-muted">
            谁提交
            <select name="submittedBy" defaultValue="" className={fieldClass}>
              <option value="">未填写</option>
              {parties
                .filter((party) => party.role !== "court")
                .map((party) => (
                <option key={party.id} value={party.id}>
                  {partyLabel(party)}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      <p className="text-sm leading-6 text-muted">
        先存放。txt 和带文字的 PDF 可以之后点读取。
      </p>
      {error ? <p className="text-sm text-seal">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "正在放入" : "放入材料"}
        </Button>
        <SavedLine show={saved} />
      </div>
    </form>
  );
}
