import { isTaskKind, type TaskKind } from "@/lib/constants";

const REST_2026 = new Set([
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  "2026-02-15",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  "2026-02-21",
  "2026-02-22",
  "2026-02-23",
  "2026-04-04",
  "2026-04-05",
  "2026-04-06",
  "2026-05-01",
  "2026-05-02",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
]);

const WORK_2026 = new Set([
  "2026-01-04",
  "2026-02-14",
  "2026-02-28",
  "2026-05-09",
  "2026-09-20",
  "2026-10-10",
]);

export const MANUAL_TASK_KINDS = ["举证", "开庭", "鉴定", "其他"] as const;

export const TASK_VARIANTS: Record<string, { value: string; label: string }[]> = {
  答辩: [
    { value: "一审·国内", label: "一审，收到起诉状副本，十五日" },
    { value: "二审·国内", label: "二审，收到上诉状副本，十五日" },
    { value: "一审·域外", label: "一审，在我国领域内没有住所，三十日" },
    { value: "二审·域外", label: "二审，在我国领域内没有住所，三十日" },
  ],
  管辖权异议: [
    { value: "国内", label: "收到起诉状副本，十五日" },
    { value: "域外", label: "在我国领域内没有住所，三十日" },
  ],
  上诉: [
    { value: "判决·国内", label: "判决送达，十五日" },
    { value: "裁定·国内", label: "裁定送达，十日" },
    { value: "判决·域外", label: "判决送达，在我国领域内没有住所，三十日" },
    { value: "裁定·域外", label: "裁定送达，在我国领域内没有住所，三十日" },
  ],
  保全: [
    { value: "银行存款", label: "银行存款，一年" },
    { value: "网络支付账户资金", label: "网络支付账户资金，参照银行存款，一年" },
    { value: "动产", label: "动产，二年" },
    { value: "不动产及其他财产权", label: "不动产及其他财产权，三年" },
    { value: "注册商标权", label: "注册商标权，一次一年" },
  ],
  公告期满: [
    { value: "国内", label: "国内，三十日" },
    { value: "涉外", label: "涉外，六十日" },
  ],
  再审: [
    { value: "生效", label: "判决、裁定生效后六个月" },
    { value: "知道", label: "法定四种情形，自知道或应当知道之日起六个月" },
  ],
  执行申请: [
    { value: "履行期", label: "履行期限最后一日起二年" },
    { value: "分期", label: "分期履行的最后一期届满日起二年" },
    { value: "生效", label: "未规定履行期间，法律文书生效日起二年" },
  ],
};

export type DeadlineFacts = {
  kind: string;
  customName: string;
  dueOn: string;
  startOn: string;
  variant: string;
};

export type DeadlineResult = {
  dueOn: string;
  endOn: string;
  startOn: string | null;
  variant: string;
  customName: string;
  basisNote: string;
};

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const index = month - 1 + months;
  const nextYear = year + Math.floor(index / 12);
  const nextMonth = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  const nextDay = Math.min(day, lastDay);
  return new Date(Date.UTC(nextYear, nextMonth, nextDay)).toISOString().slice(0, 10);
}

function isRestDay(iso: string) {
  if (iso.startsWith("2026-")) {
    if (WORK_2026.has(iso)) return false;
    if (REST_2026.has(iso)) return true;
  }
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function rollForward(iso: string) {
  let date = iso;
  for (let step = 0; step < 20 && isRestDay(date); step += 1) {
    date = addDays(date, 1);
  }
  return date;
}

function holidayNote(raw: string, rolled: string) {
  const year = Number(rolled.slice(0, 4));
  if (rolled !== raw && year === 2026) {
    return "届满日遇到 2026 年国务院安排的放假日，已顺延到放假后的第一天。";
  }
  if (rolled !== raw) {
    return "届满日遇到周末，已顺延。这一年的国务院放假安排还没有列入，请再核对。";
  }
  if (year !== 2026) {
    return "这一年的国务院放假安排还没有列入，只避开了周末。请再核对。";
  }
  return null;
}

function periodEnd(start: string, amount: number, unit: "day" | "month" | "year") {
  const raw =
    unit === "day"
      ? addDays(start, amount)
      : addMonths(start, unit === "year" ? amount * 12 : amount);
  const endOn = rollForward(raw);
  return { endOn, note: holidayNote(raw, endOn) };
}

function variantLabel(kind: string, variant: string) {
  return TASK_VARIANTS[kind]?.find((item) => item.value === variant)?.label ?? "";
}

export function taskTitle(task: { kind: string; customName?: string }) {
  if (task.kind === "其他" && task.customName?.trim()) return task.customName.trim();
  return task.kind;
}

export function taskWhen(task: {
  dueOn: string;
  dueTime?: string;
  occursOn?: string;
}) {
  const date = task.occursOn || task.dueOn;
  return task.dueTime ? `${date} ${task.dueTime}` : date;
}

export function nextOccurrence(
  dueOn: string,
  repeat: string,
  until: string,
  today: string,
) {
  if (!isIsoDate(dueOn) || !isIsoDate(today)) return null;
  if (!repeat) return dueOn;
  if (until && !isIsoDate(until)) return null;
  let cursor = dueOn;
  for (let step = 0; step < 4000; step += 1) {
    if (cursor >= today && (!until || cursor <= until)) return cursor;
    if (until && cursor > until) return null;
    const next =
      repeat === "day"
        ? addDays(cursor, 1)
        : repeat === "week"
          ? addDays(cursor, 7)
          : repeat === "month"
            ? addMonths(cursor, 1)
            : repeat === "year"
              ? addMonths(cursor, 12)
              : "";
    if (!next || next <= cursor) return null;
    cursor = next;
  }
  return null;
}

export function computeDeadline(
  input: DeadlineFacts,
): DeadlineResult | { error: string } {
  const kind = input.kind.trim();
  if (!isTaskKind(kind)) return { error: "请选择一种期限。" };
  const customName = input.customName.trim();
  const noteBits: string[] = [];

  if ((MANUAL_TASK_KINDS as readonly string[]).includes(kind)) {
    if (kind === "其他" && !customName) return { error: "请填写这个期限的名称。" };
    if (customName.length > 40) return { error: "名称写得太长。" };
    if (!isIsoDate(input.dueOn)) return { error: "请填写到期日。" };
    return {
      dueOn: input.dueOn,
      endOn: input.dueOn,
      startOn: null,
      variant: "",
      customName: kind === "其他" ? customName : "",
      basisNote:
        kind === "举证"
          ? "举证期限由法院指定。法定最短天数不是届满日。"
          : kind === "开庭"
            ? "开庭日期来自法院通知。"
            : kind === "鉴定"
              ? "鉴定没有统一届满日。"
              : "这个名称不在常用清单里。",
    };
  }

  if (!isIsoDate(input.startOn)) return { error: "请填写起算日。" };
  const label = variantLabel(kind, input.variant);
  if (!label) return { error: "请选择怎么起算。" };

  let computed: { endOn: string; note: string | null };
  if (kind === "答辩" || kind === "管辖权异议") {
    const days = input.variant.includes("域外") ? 30 : 15;
    computed = periodEnd(input.startOn, days, "day");
  } else if (kind === "上诉") {
    const days = input.variant.includes("域外")
      ? 30
      : input.variant.startsWith("裁定")
        ? 10
        : 15;
    computed = periodEnd(input.startOn, days, "day");
  } else if (kind === "公告期满") {
    computed = periodEnd(input.startOn, input.variant === "涉外" ? 60 : 30, "day");
  } else if (kind === "再审") {
    computed = periodEnd(input.startOn, 6, "month");
  } else if (kind === "执行申请") {
    computed = periodEnd(input.startOn, 2, "year");
  } else if (kind === "保全") {
    const years =
      input.variant === "动产" ? 2 : input.variant === "不动产及其他财产权" ? 3 : 1;
    computed = periodEnd(input.startOn, years, "year");
  } else {
    return { error: "请选择一种期限。" };
  }

  if (computed.note) noteBits.push(computed.note);
  let dueOn = computed.endOn;
  if (kind === "保全") {
    const rawRemind = addDays(computed.endOn, -7);
    let remind = rollForward(rawRemind);
    if (remind >= computed.endOn) {
      remind = addDays(computed.endOn, -1);
      while (isRestDay(remind)) remind = addDays(remind, -1);
    }
    if (remind !== rawRemind) noteBits.push("提醒日遇到休假日，已顺延，仍在届满日之前。");
    dueOn = remind;
    noteBits.unshift(
      `自 ${input.startOn} 起算，${label}，届满 ${computed.endOn}。续行申请在 ${dueOn} 前提出。`,
    );
  } else {
    noteBits.unshift(`自 ${input.startOn} 起算，${label}，届满 ${computed.endOn}。`);
  }

  return {
    dueOn,
    endOn: computed.endOn,
    startOn: input.startOn,
    variant: input.variant,
    customName: "",
    basisNote: noteBits.join(""),
  };
}

export function isCalculatedKind(kind: TaskKind) {
  return !(MANUAL_TASK_KINDS as readonly string[]).includes(kind);
}
