import "server-only";

import {
  fileExtension,
  fileKindError,
  MAX_FILE_BYTES,
} from "@/lib/file-kinds";
import { textFromPdf } from "@/lib/pdf-text";

export async function textFromFile(name: string, bytes: Uint8Array) {
  const kindError = fileKindError(name);
  if (kindError) return { error: kindError, status: 400 as const };
  if (bytes.byteLength === 0) {
    return { error: "这份材料是空的。", status: 400 as const };
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { error: "这份材料太大。", status: 400 as const };
  }

  const ext = fileExtension(name);
  if (ext === "txt") {
    if (bytes.includes(0)) {
      return { error: "读不出文字。请放入一份文本。", status: 400 as const };
    }
    try {
      const text = new TextDecoder("utf-8", { fatal: true })
        .decode(bytes)
        .replace(/^\uFEFF/, "")
        .trim();
      if (!text) return { error: "这份材料是空的。", status: 400 as const };
      return { text };
    } catch {
      return { error: "读不出文字。请放入一份文本。", status: 400 as const };
    }
  }

  if (ext === "pdf") {
    try {
      const text = (await textFromPdf(bytes)).trim();
      if (!text) {
        return { unread: true as const, note: "这份 PDF 没有文字层，请手填。" };
      }
      return { text };
    } catch {
      return { unread: true as const, note: "这份 PDF 没有读出文字，请手填。" };
    }
  }

  return {
    unread: true as const,
    note: "图片、录音和录像先存放，文字请手填。",
  };
}
