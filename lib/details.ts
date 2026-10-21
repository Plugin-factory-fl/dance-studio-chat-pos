import { DB, Student } from "./types";
import { today } from "./seed";
import { balance, money, fmtDate } from "./engine";
import { PAYMENT_PLANS } from "./policy";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const termStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };

export function attendance(db: DB, s: Student) {
  const t = today(), start = [termStart(), s.startDate].sort()[1];
  const ids = [s.classId, ...(s.extraClassIds ?? [])];
  let sessions = 0;
  for (const id of ids) { const k = db.classes.find(c => c.id === id)!; for (let d = new Date(start + "T00:00:00"); iso(d) < t; d.setDate(d.getDate() + 1)) if (DAYS[d.getDay()] === k.day) sessions++; }
  const att = db.attendance.filter(a => a.studentId === s.id && a.date >= start);
  const present = new Set(att.map(a => `${a.classId}|${a.date}`)).size;
  const canc = db.cancellations.filter(c => c.studentId === s.id);
  const pastC = canc.filter(c => c.date < t).length, upC = canc.filter(c => c.date >= t).length;
  const credits = canc.reduce((a, c) => a + c.creditCents, 0);
  const held = Math.max(present, sessions - pastC);
  const absent = Math.max(0, held - present);
  const last = att.map(a => a.date).sort().pop();
  return { present, absent, cancelled: pastC + upC, upcomingCancelled: upC, credits, last, pct: held ? Math.round(present / held * 100) : 100, start };
}

export function familyDetails(db: DB, familyId: string) {
  const f = db.families.find(x => x.id === familyId)!;
  const plan = PAYMENT_PLANS.find(p => p.id === (f.plan ?? "monthly"))!;
  const waivers = db.waivers.map(w => { const s = db.signatures.find(x => x.familyId === f.id && x.waiverId === w.id); return { name: w.name, signed: s ? fmtDate(s.date) : undefined }; });
  const kids = db.students.filter(s => s.familyId === f.id).map(s => {
    const classes = [s.classId, ...(s.extraClassIds ?? [])].map(id => db.classes.find(c => c.id === id)!).map(k => ({ name: k.style, when: `${k.day} ${k.time}`, room: k.room }));
    const numbers = db.recital.order.filter(o => o.studentIds.includes(s.id)).map(o => o.number);
    const merch = db.sales.filter(x => x.studentId === s.id).map(x => ({ date: fmtDate(x.date), item: db.merch.find(m => m.id === x.itemId)?.name ?? x.itemId, size: x.size ?? "", amount: money(x.amountCents) }));
    const costumes = db.assignments.filter(a => a.studentId === s.id).map(a => `${db.costumes.find(c => c.id === a.costumeId)!.name} ${a.size}${a.paid ? "" : a.billed ? " (billed)" : " (not billed)"}`);
    const medical = s.paused ? "Medical pause active" : db.requests.some(r => r.type === "medical" && r.studentId === s.id && r.status === "open") ? "Medical pause requested" : "None";
    return { s, classes, numbers, merch, costumes, medical, att: attendance(db, s) };
  });
  return { f, bal: balance(db, f.id), plan, waivers, kids, processor: db.processor };
}
