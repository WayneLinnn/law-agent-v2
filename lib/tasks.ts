import { cache } from "react";
import { connection } from "next/server";

import { isRepeat, isTaskKind, TERMINATED_NOTE, type TaskKind } from "@/lib/constants";
import {
  computeDeadline,
  isCalculatedKind,
  isIsoDate,
  nextOccurrence,
} from "@/lib/deadlines";
import { todayISO } from "@/lib/figures";

import { getDb } from "@/lib/db";
import type { DueTask } from "@/lib/types";

function matterStatus(id: string) {
  const db = getDb();
  return db.prepare("SELECT status FROM matters WHERE id = ?").get(id) as
    | { status: string }
    | undefined;
}

function scheduleFacts(
  kind: string,
  dueOn: string,
  dueTime: string,
  place: string,
  repeat: string,
  repeatUntil: string,
) {
  if (isTaskKind(kind) && isCalculatedKind(kind)) {
    return { dueTime: "", place: "", repeat: "", repeatUntil: "" };
  }
  const time = dueTime.trim();
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return { error: "时间要写成 14:00 这样。" };
  }
  const room = kind.trim() === "开庭" ? place.trim() : "";
  if (room.length > 80) return { error: "法庭写得太长。" };
  const rule = repeat.trim();
  if (rule && !isRepeat(rule)) return { error: "重复方式不对。" };
  const until = rule ? repeatUntil.trim() : "";
  if (until && !isIsoDate(until)) {
    return { error: "重复到要写成日期。" };
  }
  if (until && until < dueOn) return { error: "重复到要在到期日之后。" };
  return { dueTime: time, place: room, repeat: rule, repeatUntil: until };
}

function blocked(status: string) {
  if (status === "已终止") return { error: TERMINATED_NOTE, status: 409 as const };
  if (status !== "办理中") {
    return { error: "待办在办理中记下。", status: 409 as const };
  }
  return null;
}

export async function createTask(
  matterId: string,
  input: {
    kind: string;
    customName: string;
    dueOn: string;
    dueTime: string;
    place: string;
    repeat: string;
    repeatUntil: string;
    startOn: string;
    variant: string;
    note: string;
  },
) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = blocked(matter.status);
  if (stop) return stop;

  const note = input.note.trim();
  if (note.length > 200) return { error: "附注写得太长。", status: 400 as const };
  const deadline = computeDeadline(input);
  if ("error" in deadline) return { error: deadline.error, status: 400 as const };
  const schedule = scheduleFacts(
    input.kind,
    deadline.dueOn,
    input.dueTime,
    input.place,
    input.repeat,
    input.repeatUntil,
  );
  if ("error" in schedule) return { error: schedule.error, status: 400 as const };

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString().slice(0, 10);
  getDb()
    .prepare(
      `INSERT INTO tasks (
         id, matter_id, kind, custom_name, due_on, due_time, place, repeat, repeat_until,
         end_on, start_on, variant,
         basis_note, note, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      matterId,
      input.kind.trim(),
      deadline.customName,
      deadline.dueOn,
      schedule.dueTime,
      schedule.place,
      schedule.repeat,
      schedule.repeatUntil,
      deadline.endOn,
      deadline.startOn,
      deadline.variant,
      deadline.basisNote,
      note,
      createdAt,
    );
  return { id, status: 201 as const };
}

export async function confirmTask(matterId: string, taskId: string) {
  await connection();
  const matter = matterStatus(matterId);
  if (!matter) return { error: "没有这件案子。", status: 404 as const };
  const stop = blocked(matter.status);
  if (stop) return stop;

  const db = getDb();
  const task = db
    .prepare(
      `SELECT confirmed_at AS confirmedAt
       FROM tasks
       WHERE id = ? AND matter_id = ?`,
    )
    .get(taskId, matterId) as { confirmedAt: string | null } | undefined;
  if (!task) return { error: "没有这条待办。", status: 404 as const };
  if (task.confirmedAt) {
    return { error: "这条待办已经确认。", status: 409 as const };
  }

  const confirmedAt = new Date().toISOString().slice(0, 10);
  const result = db
    .prepare(
      `UPDATE tasks
       SET confirmed_at = ?
       WHERE id = ? AND matter_id = ? AND confirmed_at IS NULL`,
    )
    .run(confirmedAt, taskId, matterId);
  if (result.changes !== 1) {
    return { error: "没有确认这条待办。", status: 409 as const };
  }
  return { id: taskId, status: 200 as const };
}

export const listDueTasks = cache(async (): Promise<DueTask[]> => {
  await connection();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.id, t.matter_id AS matterId, m.name AS matterName,
              t.kind, t.custom_name AS customName, t.due_on AS dueOn,
              t.due_time AS dueTime, t.place, t.repeat,
              t.repeat_until AS repeatUntil,
              t.end_on AS endOn, t.note
       FROM tasks t
       JOIN matters m ON m.id = t.matter_id
       WHERE t.confirmed_at IS NOT NULL AND m.status = '办理中'
       ORDER BY t.due_on, t.due_time, t.created_at`,
    )
    .all() as Array<{
    id: string;
    matterId: string;
    matterName: string;
    kind: string;
    customName: string;
    dueOn: string;
    dueTime: string;
    place: string;
    repeat: string;
    repeatUntil: string;
    endOn: string | null;
    note: string;
  }>;

  const today = todayISO();
  return rows.flatMap((row) => {
    if (!isTaskKind(row.kind)) return [];
    const occursOn = nextOccurrence(row.dueOn, row.repeat, row.repeatUntil, today);
    if (!occursOn) return [];
    return [
      {
        id: row.id,
        matterId: row.matterId,
        matterName: row.matterName,
        kind: row.kind satisfies TaskKind,
        customName: row.customName,
        dueOn: row.dueOn,
        dueTime: row.dueTime,
        place: row.place,
        repeat: row.repeat,
        repeatUntil: row.repeatUntil,
        occursOn,
        endOn: row.endOn,
        note: row.note,
      },
    ];
  });
});
