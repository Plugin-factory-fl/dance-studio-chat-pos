export type Card =
  | { kind: "student"; title: string; rows: [string, string][] }
  | { kind: "payment"; title: string; rows: [string, string][] }
  | { kind: "balance"; title: string; rows: [string, string][] }
  | { kind: "report"; title: string; rows: [string, string][] }
  | { kind: "roster"; title: string; rows: [string, string][] }
  | { kind: "info"; title: string; rows: [string, string][] };
export interface Message { id: string; thread: string; from: "owner" | "parent" | "system"; text: string; card?: Card; buttons?: { label: string; send: string }[]; ts: string }
export interface Family { id: string; name: string; parentName: string; cardLast4?: string }
export interface Student { id: string; name: string; familyId: string; classId: string; rateCents: number; startDate: string; active: boolean }
export interface Klass { id: string; style: string; day: string; time: string; instructor: string }
export interface LedgerEntry { id: string; familyId: string; type: "charge" | "payment"; amountCents: number; description: string; date: string; processor?: string; feeCents?: number; thread: string }
export interface Attendance { id: string; studentId: string; classId: string; date: string }
export interface Processor { name: string; ratePct: number; fixedCents: number; external: boolean }
export interface Pending { action: string; data: any }
export interface DB { studio: string; families: Family[]; students: Student[]; classes: Klass[]; ledger: LedgerEntry[]; attendance: Attendance[]; messages: Message[]; processor: Processor; pending: Record<string, Pending | undefined>; seq: number }
