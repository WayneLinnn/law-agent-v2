import type {
  ElementKind,
  MatterStatus,
  MaterialKind,
  PartyRole,
  RulingKind,
  TaskKind,
  OutcomeKind,
  TaskResolution,
  DraftKind,
} from "@/lib/constants";

export type ClosingRecord = {
  outcomeKind: OutcomeKind;
  outcomeOn: string;
  outcomeNote: string;
  statement: string;
  confirmedAt: string | null;
  archivedAt: string | null;
};

export type ClosingTaskResolution = {
  taskId: string;
  result: TaskResolution;
  note: string;
  resolvedAt: string;
};

export type DossierItem = {
  id: string;
  section: string;
  label: string;
  refId: string | null;
  position: number;
};

export type MatterRecord = {
  id: string;
  name: string;
  status: MatterStatus;
  cause: string;
  facts: string;
  mandate: string;
  claimAmount: number | null;
  feeReceivable: number | null;
  feeReceived: number | null;
  limitationStart: string | null;
  caseNumber: string;
  category: string;
  engagedOn: string;
  instance: string;
  procedure: string;
  parentMatterId: string | null;
  courtName: string;
  createdAt: string;
  deletedOn: string;
};

export type PartyRecord = {
  id: string;
  role: PartyRole;
  name: string;
  position: string;
  idNumber: string;
  clientId: string | null;
};

export type MaterialRecord = {
  id: string;
  filename: string;
  extractedText: string;
  kind: MaterialKind;
  proves: string;
  submittedBy: string | null;
  createdAt: string;
};

export type ProceedingLink = {
  id: string;
  name: string;
  instance: string;
  status: string;
  caseNumber: string;
};

export type RulingRecord = {
  id: string;
  materialId: string;
  kind: RulingKind;
  decidedOn: string;
  servedOn: string;
  effectiveOn: string;
  result: string;
};

export type TaskRecord = {
  id: string;
  kind: TaskKind;
  customName: string;
  dueOn: string;
  dueTime: string;
  place: string;
  repeat: string;
  repeatUntil: string;
  endOn: string | null;
  startOn: string | null;
  variant: string;
  basisNote: string;
  note: string;
  confirmedAt: string | null;
};

export type JudgeRecord = {
  id: string;
  name: string;
  division: string;
  phone: string;
};

export type CourtOfficer = {
  judge: string;
  assistant: string;
  clerk: string;
  division: string;
  contact: string;
};

export type ElementRecord = {
  id: string;
  kind: ElementKind;
  body: string;
  sourceLabel: string;
  sourceMaterialId: string | null;
  confirmedAt: string | null;
};

export type FocusRecord = {
  id: string;
  body: string;
  lawQuery: string;
  confirmedAt: string | null;
};

export type SourceKind = "law" | "case";

export type AskHit = {
  title: string;
  text: string;
  url: string;
  detail: string;
};

export type MatterAskRecord = {
  id: string;
  question: string;
  mode: "lookup" | "answer";
  answer: string;
  laws: AskHit[];
  cases: AskHit[];
  createdAt: string;
};

export type SourceCandidate = {
  kind: SourceKind;
  sourceId: string;
  title: string;
  text: string;
  url: string;
  status: string;
  detail: string;
};

export type SourceRecord = SourceCandidate & {
  id: string;
  focusId: string;
  retrievedAt: string;
  acceptedAt: string;
};

export type { DraftKind } from "@/lib/constants";

export type DraftWarning = {
  level: "block" | "warn" | "info";
  line: number;
  quote: string;
  text: string;
  url?: string;
};

export type DraftRefs = { sourceIds: string[]; elementIds: string[] };

export type DraftRecord = DraftRefs & {
  id: string;
  kind: DraftKind;
  version: number;
  body: string;
  warnings: DraftWarning[];
  final: boolean;
  basedOn: number | null;
  createdAt: string;
};

export type DueTask = {
  id: string;
  matterId: string;
  matterName: string;
  kind: TaskKind;
  customName: string;
  dueOn: string;
  dueTime: string;
  place: string;
  repeat: string;
  repeatUntil: string;
  occursOn: string;
  endOn: string | null;
  note: string;
};

export type MatterDetail = {
  matter: MatterRecord;
  parties: PartyRecord[];
  materials: MaterialRecord[];
  tasks: TaskRecord[];
  elements: ElementRecord[];
  focuses: FocusRecord[];
};

export type MatterSummary = MatterRecord & {
  parties: Record<PartyRole, string[]>;
};
