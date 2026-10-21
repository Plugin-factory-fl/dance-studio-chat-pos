import fs from "fs";
import path from "path";
import { DB } from "./types";
const FILE = path.join(process.cwd(), "data", "db.json");
const today = () => new Date().toISOString().slice(0, 10);
export function seed(): DB {
  const now = new Date().toISOString();
  const db: DB = {
    studio: "BabyBlue Dance Studio",
    families: [
      { id: "fam_lopez", name: "Lopez", parentName: "Ana Lopez", cardLast4: "1881" },
      { id: "fam_chen", name: "Chen", parentName: "Li Chen", cardLast4: "4242" },
      { id: "fam_patel", name: "Patel", parentName: "Raj Patel", cardLast4: "5100" },
    ],
    classes: [
      { id: "c_hh_tue", style: "Hip Hop", day: "Tuesday", time: "4pm", instructor: "Sarah" },
      { id: "c_hh_thu", style: "Hip Hop", day: "Thursday", time: "4pm", instructor: "Sarah" },
      { id: "c_ballet_mon", style: "Ballet", day: "Monday", time: "5pm", instructor: "Elena" },
      { id: "c_jazz_wed", style: "Jazz", day: "Wednesday", time: "6pm", instructor: "Marcus" },
    ],
    students: [
      { id: "s_maya", name: "Maya Lopez", familyId: "fam_lopez", classId: "c_hh_tue", rateCents: 8500, startDate: "2026-09-01", active: true },
      { id: "s_priya", name: "Priya Patel", familyId: "fam_patel", classId: "c_jazz_wed", rateCents: 6000, startDate: "2026-09-01", active: true },
      { id: "s_dev", name: "Dev Patel", familyId: "fam_patel", classId: "c_hh_tue", rateCents: 6000, startDate: "2026-09-01", active: true },
    ],
    ledger: [
      { id: "l1", familyId: "fam_lopez", type: "charge", amountCents: 8500, description: "September tuition", date: "2026-09-01", thread: "owner" },
      { id: "l2", familyId: "fam_lopez", type: "payment", amountCents: 8500, description: "September tuition", date: "2026-09-02", processor: "Stripe", feeCents: 277, thread: "owner" },
      { id: "l3", familyId: "fam_patel", type: "charge", amountCents: 12000, description: "September tuition", date: "2026-09-01", thread: "owner" },
    ],
    attendance: [],
    messages: [
      { id: "m1", thread: "owner", from: "system", ts: now, text: "Welcome to the BabyBlue owner thread. Type a request in plain language, or type help to see examples." },
      { id: "m2", thread: "parent:fam_chen", from: "system", ts: now, text: "Hi Li, this is your BabyBlue family thread. Ask what's my balance, pay tuition, or ask to switch or cancel a class." },
    ],
    processor: { name: "Stripe", ratePct: 2.9, fixedCents: 30, external: false },
    pending: {},
    seq: 100,
  };
  return db;
}
export function load(): DB {
  if (!fs.existsSync(FILE)) { const db = seed(); save(db); return db; }
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
export function save(db: DB) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); }
export { today };
