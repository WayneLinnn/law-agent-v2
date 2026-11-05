export const FILE_ACCEPT =
  ".txt,.pdf,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.m4a,.mp4,.webm,.mov,text/plain,application/pdf,image/*,audio/*,video/*";

export const MAX_FILE_BYTES = 32 * 1024 * 1024;

const ALLOWED = new Set([
  "txt",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "mp3",
  "wav",
  "m4a",
  "mp4",
  "webm",
  "mov",
]);

const CONTENT_TYPE: Record<string, string> = {
  txt: "text/plain; charset=utf-8",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export function fileExtension(name: string) {
  const base = name.trim().toLowerCase();
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1);
}

export function fileKindError(name: string) {
  return ALLOWED.has(fileExtension(name))
    ? null
    : "请放入 txt、PDF、图片、录音或录像。";
}

export function canReadText(name: string) {
  const ext = fileExtension(name);
  return ext === "txt" || ext === "pdf";
}

export function contentType(name: string) {
  return CONTENT_TYPE[fileExtension(name)] ?? "application/octet-stream";
}
