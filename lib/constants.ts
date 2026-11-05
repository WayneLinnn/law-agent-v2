export const MATTER_STATUSES = [
  "草稿",
  "待立案",
  "办理中",
  "结案中",
  "已结案",
  "已归档",
  "已终止",
  "已删除",
] as const;

export type MatterStatus = (typeof MATTER_STATUSES)[number];

export const MOVABLE_STATUSES = ["草稿", "待立案", "办理中", "结案中"] as const;

export function canMoveStatus(status: string) {
  return (MOVABLE_STATUSES as readonly string[]).includes(status);
}

export const PARTY_ROLES = ["client", "ally", "opposing", "court"] as const;

export type PartyRole = (typeof PARTY_ROLES)[number];

export const PARTY_ROLE_LABEL: Record<PartyRole, string> = {
  client: "客户",
  ally: "我方",
  opposing: "对方",
  court: "法院",
};

export const MATTER_SECTIONS = [
  { slug: "", label: "概览" },
  { slug: "materials", label: "材料" },
  { slug: "tasks", label: "待办" },
  { slug: "documents", label: "文书" },
  { slug: "archive", label: "归档" },
] as const;

export function sectionHref(matterId: string, slug: string) {
  return slug ? `/matters/${matterId}/${slug}` : `/matters/${matterId}`;
}

export const INSTANCES = ["一审", "二审", "再审", "执行"] as const;

export type Instance = (typeof INSTANCES)[number];

export const CASE_CATEGORIES = [
  "民事",
  "刑事",
  "行政诉讼",
  "非诉专项",
  "法律顾问",
  "其他",
] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const PROCEDURES = ["普通", "简易", "特别"] as const;

export type Procedure = (typeof PROCEDURES)[number];

export const PARTY_POSITIONS = [
  "原告",
  "被告",
  "第三人",
  "上诉人",
  "被上诉人",
] as const;

export type PartyPosition = (typeof PARTY_POSITIONS)[number];

export const MATERIAL_KINDS = [
  "代理合同",
  "起诉状",
  "证据",
  "裁判文书",
  "送达回证",
  "往来文书",
] as const;

export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const RULING_KINDS = ["判决", "裁定", "调解书"] as const;

export type RulingKind = (typeof RULING_KINDS)[number];

export function partyLabel(party: { name: string; position: string }) {
  return party.position ? `${party.name}（${party.position}）` : party.name;
}

export function isPartyRole(value: string): value is PartyRole {
  return (PARTY_ROLES as readonly string[]).includes(value);
}

export function isInstance(value: string): value is Instance {
  return (INSTANCES as readonly string[]).includes(value);
}

export function isCaseCategory(value: string): value is CaseCategory {
  return (CASE_CATEGORIES as readonly string[]).includes(value);
}

export function isProcedure(value: string): value is Procedure {
  return (PROCEDURES as readonly string[]).includes(value);
}

export function isPartyPosition(value: string): value is PartyPosition {
  return (PARTY_POSITIONS as readonly string[]).includes(value);
}

export function isMaterialKind(value: string): value is MaterialKind {
  return (MATERIAL_KINDS as readonly string[]).includes(value);
}

export function isRulingKind(value: string): value is RulingKind {
  return (RULING_KINDS as readonly string[]).includes(value);
}

export function canEditRecord(status: MatterStatus) {
  return status !== "已归档" && status !== "已终止" && status !== "已删除";
}

export function isMatterStatus(value: string): value is MatterStatus {
  return (MATTER_STATUSES as readonly string[]).includes(value);
}

export const TASK_KINDS = [
  "答辩",
  "举证",
  "开庭",
  "上诉",
  "保全",
  "管辖权异议",
  "鉴定",
  "公告期满",
  "再审",
  "执行申请",
  "其他",
] as const;

export type TaskKind = (typeof TASK_KINDS)[number];

export function isTaskKind(value: string): value is TaskKind {
  return (TASK_KINDS as readonly string[]).includes(value);
}

export const REPEATS = [
  { value: "day", label: "每天" },
  { value: "week", label: "每周" },
  { value: "month", label: "每月" },
  { value: "year", label: "每年" },
] as const;

export type Repeat = (typeof REPEATS)[number]["value"];

export function isRepeat(value: string): value is Repeat {
  return REPEATS.some((item) => item.value === value);
}

export function repeatLabel(value: string) {
  return REPEATS.find((item) => item.value === value)?.label ?? "";
}

export const ELEMENT_KINDS = ["请求", "事实", "金额", "日期"] as const;

export type ElementKind = (typeof ELEMENT_KINDS)[number];

export function isElementKind(value: string): value is ElementKind {
  return (ELEMENT_KINDS as readonly string[]).includes(value);
}

export const ELEMENTS_UNCONFIRMED = "要素还没有确认，不能去定焦点。";

export const FOCUS_UNCONFIRMED = "焦点还没有确认，不能检索，也不能起草。";

export const TERMINABLE_STATUSES = ["草稿", "待立案", "办理中"] as const;

export const TERMINATED_NOTE = "这件案子已终止，不能再往下推进。";

export const DELETE_HOLD_DAYS = 30;

export const DELETED_NOTE = "这件案子已删除。保留 30 天后可以彻底删除。";

export const OUTCOME_KINDS = ["生效裁判", "和解", "撤诉", "委托终止", "其他"] as const;
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];
export type TaskResolution = "已完成" | "不再适用";

export const DRAFT_KINDS = ["意见书", "起诉状", "答辩状", "上诉状", "二审答辩状"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export function canTerminate(status: MatterStatus) {
  return (TERMINABLE_STATUSES as readonly string[]).includes(status);
}
