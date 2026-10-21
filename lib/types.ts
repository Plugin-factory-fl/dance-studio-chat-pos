export type Tone = "good" | "warn" | "bad" | "muted";
export type Row = [string, string] | [string, string, Tone];
export interface Card {
  kind: "student" | "payment" | "balance" | "report" | "roster" | "info" | "payrun" | "inventory" | "event" | "compliance" | "message" | "request" | "confirm";
  title: string; subtitle?: string; badge?: { text: string; tone: Tone };
  rows: Row[]; sections?: { heading: string; rows: Row[] }[];
  progress?: { label: string; value: number; max: number }; footer?: string;
}
export interface Button { label: string; send: string; tone?: "primary" | "ghost" }
export interface Message { id: string; thread: string; from: "owner" | "parent" | "system"; text: string; card?: Card; buttons?: Button[]; sticky?: boolean; ts: string }
export interface Family { id: string; name: string; parentName: string; phone: string; email: string; cardLast4?: string; plan?: string }
export interface Student { id: string; name: string; familyId: string; classId: string; rateCents: number; startDate: string; active: boolean; size: string; age: number; extraClassIds?: string[]; paused?: boolean }
export interface Klass { id: string; style: string; day: string; time: string; instructorId: string; hours: number; room: string; ageMin: number; ageMax: number; level: string; capacity: number; priceCents: number; prereq?: string; specialty?: boolean; needsApproval?: boolean }
export interface Instructor { id: string; name: string; ratePerClassCents: number; backgroundCheck: string; checkOk: boolean }
export interface Payout { id: string; instructorId: string; month: string; classes: number; hours: number; amountCents: number; date: string }
export interface LedgerEntry { id: string; familyId: string; type: "charge" | "payment" | "credit"; amountCents: number; description: string; date: string; processor?: string; feeCents?: number; thread: string }
export interface Attendance { id: string; studentId: string; classId: string; date: string }
export interface Processor { name: string; ratePct: number; fixedCents: number; external: boolean }
export interface Pending { action: string; data: any }
export interface Costume { id: string; name: string; number: string; color: string; priceCents: number; stock: Record<string, number> }
export interface CostumeAssignment { studentId: string; costumeId: string; size: string; billed: boolean; paid: boolean }
export interface MerchItem { id: string; name: string; priceCents: number; stock: number; sold: number; sizes?: Record<string, number> }
export interface Sale { id: string; itemId: string; qty: number; familyId?: string; studentId?: string; size?: string; amountCents: number; date: string }
export interface Vendor { name: string; role: string; status: "booked" | "pending" | "done"; costCents: number; due: string }
export interface Recital { name: string; date: string; venue: string; seats: number; ticketCents: number; sold: number; ticketSales: { familyId: string; qty: number }[]; order: { number: string; classId?: string; studentIds: string[]; costumeId?: string }[]; vendors: Vendor[] }
export interface Waiver { id: string; name: string; required: boolean }
export interface Signature { familyId: string; waiverId: string; date: string }
export interface Request { id: string; familyId: string; type: "switch" | "cancel" | "trial" | "question" | "audition" | "private" | "medical" | "specialty"; teamId?: string; studentId?: string; studentName?: string; toClassId?: string; date?: string; text: string; status: "open" | "approved" | "declined"; ownerMsgId?: string }
export interface DB {
  studio: string; families: Family[]; students: Student[]; classes: Klass[]; instructors: Instructor[]; payouts: Payout[];
  ledger: LedgerEntry[]; attendance: Attendance[]; messages: Message[]; processor: Processor; pending: Record<string, Pending | undefined>;
  costumes: Costume[]; assignments: CostumeAssignment[]; merch: MerchItem[]; sales: Sale[]; recital: Recital;
  cancellations: { id: string; studentId: string; classId: string; date: string; creditCents: number }[];
  waivers: Waiver[]; signatures: Signature[]; requests: Request[]; seq: number; version: number;
}
