import { DB, Card, Message, Family, Student, Klass, Row, Button, Request } from "./types";
import { today } from "./seed";

export const money = (c: number) => (c < 0 ? "minus " : "") + "$" + (Math.abs(c) / 100).toFixed(2);
const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9$. ]/g, " ").replace(/\s+/g, " ").trim();
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const cap = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());
const monthName = () => new Date().toLocaleString("en-US", { month: "long" });
export const fmtDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); if (!d) return iso; return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: y !== new Date().getFullYear() ? "numeric" : undefined }); };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nid = (db: DB, p: string) => `${p}${++db.seq}`;
const amount = (t: string) => { const m = t.match(/\$\s?(\d+(?:,\d{3})*(?:\.\d\d)?)/); return m ? Math.round(parseFloat(m[1].replace(/,/g, "")) * 100) : undefined; };
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const nextDate = (day: string, weeksAhead = 0) => { const d = new Date(); const t = DAYS.indexOf(day.toLowerCase()); let add = (t - d.getDay() + 7) % 7; if (add === 0) add = 7; d.setDate(d.getDate() + add + 7 * weeksAhead); return iso(d); };

export function balance(db: DB, familyId: string) {
  return db.ledger.filter(l => l.familyId === familyId).reduce((s, l) => s + (l.type === "charge" ? l.amountCents : -l.amountCents), 0);
}
const fee = (db: DB, cents: number) => Math.round(cents * db.processor.ratePct / 100 + db.processor.fixedCents);
const kls = (db: DB, id: string) => db.classes.find(c => c.id === id)!;
const inst = (db: DB, id: string) => db.instructors.find(i => i.id === id)!;
const className = (k: Klass) => `${k.day} ${k.time} ${k.style}`;
const fam = (db: DB, id: string) => db.families.find(f => f.id === id)!;
const stu = (db: DB, id: string) => db.students.find(s => s.id === id)!;
export const parentThread = (f: Family) => `parent:${f.id}`;
const first = (s: Student) => s.name.split(" ")[0];

function post(db: DB, thread: string, text: string, card?: Card, buttons?: Button[], sticky = false) {
  const m: Message = { id: nid(db, "m"), thread, from: "system", text, card, buttons, sticky, ts: new Date().toISOString() };
  db.messages.push(m); return m;
}
const has = (n: string, w: string) => new RegExp(`\\b${w}\\b`).test(n);

function findFamily(db: DB, t: string): Family | undefined {
  const n = norm(t);
  return db.families.find(f => has(n, f.name.toLowerCase())) ||
    db.students.filter(s => has(n, first(s).toLowerCase())).map(s => fam(db, s.familyId))[0];
}
function findStudent(db: DB, t: string, familyId?: string): Student | undefined {
  const n = norm(t); const pool = db.students.filter(s => !familyId || s.familyId === familyId);
  return pool.find(s => n.includes(s.name.toLowerCase())) || pool.find(s => has(n, first(s).toLowerCase()));
}
function findClass(db: DB, t: string): Klass | undefined {
  const n = norm(t).replace(/hiphop/g, "hip hop").replace(/tiny tot\b/g, "tiny tots");
  let best: Klass | undefined, score = 0;
  for (const k of db.classes) {
    let s = 0;
    if (has(n, k.day.toLowerCase())) s += 2;
    if (n.includes(k.style.toLowerCase())) s += 2;
    if (new RegExp(`\\b${k.time.replace(/[ap]m/, "")}\\s?${k.time.slice(-2)}\\b`).test(n)) s += 1;
    if (s > score) { score = s; best = k; }
  }
  return score >= 2 ? best : undefined;
}
function parseClassSpec(db: DB, t: string): Klass | undefined {
  const m = t.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2}(?::\d\d)?\s?[ap]m)\s+([a-z \-]+?)(?:,|$)/i);
  if (!m) return;
  return { id: "", day: cap(m[1].toLowerCase()), time: m[2].replace(/\s/g, "").toLowerCase(), style: cap(m[3].replace(/-/g, " ").trim()), instructorId: db.instructors[0].id, hours: 1, room: "Studio A" };
}
const monthIn = (t: string) => { const m = norm(t).match(new RegExp(`\\b(${MONTHS.join("|")})\\b`)); return m ? cap(m[1]) : monthName(); };
const monthKey = (name: string) => { const i = MONTHS.indexOf(name.toLowerCase()); const y = new Date().getFullYear() - (i > new Date().getMonth() ? 1 : 0); return `${y}-${String(i + 1).padStart(2, "0")}`; };

// ---------- cards ----------
function studentCard(db: DB, s: Student, title = "Student record"): Card {
  const f = fam(db, s.familyId), k = kls(db, s.classId);
  const att = db.attendance.filter(a => a.studentId === s.id).length;
  const signed = db.waivers.filter(w => db.signatures.some(x => x.familyId === f.id && x.waiverId === w.id)).length;
  const bal = balance(db, f.id);
  return { kind: "student", title: s.name, subtitle: `${title} · age ${s.age} · costume size ${s.size}`, badge: { text: s.active ? "Active" : "Inactive", tone: s.active ? "good" : "muted" }, rows: [
    ["Class", className(k)], ["Instructor", inst(db, k.instructorId).name], ["Room", k.room], ["Tuition", `${money(s.rateCents)} per month`], ["Start date", fmtDate(s.startDate)],
    ["Classes attended", String(att)], ["Waivers signed", `${signed} of ${db.waivers.length}`, signed < db.waivers.length ? "warn" : "good"],
    ["Family", `${f.parentName} · card ${f.cardLast4 ?? "none"}`], ["Family balance", money(bal), bal > 0 ? "warn" : "good"]] };
}
function balanceCard(db: DB, f: Family): Card {
  const items = db.ledger.filter(l => l.familyId === f.id).slice(-5).map(l => [`${fmtDate(l.date)} · ${l.description}`, (l.type === "charge" ? "" : "paid ") + money(l.amountCents), l.type === "payment" ? "good" : undefined] as Row);
  const b = balance(db, f.id);
  return { kind: "balance", title: `${f.name} family account`, subtitle: `${f.parentName} · card ending ${f.cardLast4 ?? "none"}`, badge: { text: b > 0 ? `${money(b)} due` : "Paid up", tone: b > 0 ? "warn" : "good" }, rows: [...items.map(r => r.filter(Boolean) as Row), ["Balance due", money(b), b > 0 ? "warn" : "good"]] };
}

function charge(db: DB, f: Family, cents: number, desc: string, thread: string) {
  db.ledger.push({ id: nid(db, "l"), familyId: f.id, type: "charge", amountCents: cents, description: desc, date: today(), thread });
}
function collect(db: DB, f: Family, cents: number, desc: string, by: "owner" | "parent") {
  const fe = fee(db, cents);
  db.ledger.push({ id: nid(db, "l"), familyId: f.id, type: "payment", amountCents: cents, description: desc, date: today(), processor: db.processor.name, feeCents: fe, thread: by === "owner" ? "owner" : parentThread(f) });
  // mark billed costumes paid when the balance clears
  if (balance(db, f.id) <= 0) db.assignments.filter(a => a.billed && stu(db, a.studentId).familyId === f.id).forEach(a => a.paid = true);
  const card: Card = { kind: "payment", title: "Payment confirmation", subtitle: `${fmtDate(today())} · ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`, badge: { text: "Paid", tone: "good" }, rows: [["Family", f.name], ["Amount", money(cents)], ["For", desc], ["Method", f.cardLast4 ? `Card ending ${f.cardLast4}` : "Card"], ["Processor", db.processor.name + (db.processor.external ? " (your merchant)" : "")], ["Processing fee", money(fe), "muted"], ["Net to studio", money(cents - fe)], ["New balance", money(balance(db, f.id)), balance(db, f.id) > 0 ? "warn" : "good"]] };
  post(db, "owner", `Payment of ${money(cents)} received from the ${f.name} family${by === "parent" ? " in their parent thread" : ""}.`, card);
  post(db, parentThread(f), `Thank you! Your payment of ${money(cents)} is posted.`, card);
}
const payBtn = (db: DB, f: Family): Button[] => [{ label: `Pay ${money(balance(db, f.id))} now`, send: "pay now", tone: "primary" }];

// ---------- help ----------
const HELP_OWNER: Card = { kind: "info", title: "What you can ask", subtitle: "Front desk and back office in one thread", rows: [], sections: [
  { heading: "Front desk", rows: [["Enroll", "Enroll Emma Chen in Monday 5pm Ballet, $75/month, charge card ending 4242"], ["Bill", "Post October tuition for all active students"], ["Charge", "Charge the Lopez family $85"], ["Check in", "Maya checked in  /  Mark all present for Tuesday 4pm"], ["Message", "Text the Tuesday class that rehearsal moved to 5pm"], ["Report", "Show this month's revenue and outstanding balances"]] },
  { heading: "Back office", rows: [["Payroll", "Run payroll for October  /  Pay Sarah $450 for October classes"], ["Costumes", "How many pink tutus do we have left?  /  Order 12 medium black leotards"], ["Merch", "Merch stock  /  Sell 2 hoodies to the Rossi family"], ["Recital", "Recital status  /  Running order  /  Add Maya to the opening number  /  Mark videographer booked"], ["Costume fees", "Send costume payment links to all families in the spring show"], ["Waivers", "Who still needs to sign the photo release?  /  Send photo release to missing families"]] },
  { heading: "Money and requests", rows: [["Fees", "What did we pay in processing fees this month?"], ["Processor", "Use Square at 2.6% + 15c"], ["Requests", "Open requests  /  Reply to Lopez: see you Tuesday"]] }] };

// ---------- owner ----------
function ownerCmd(db: DB, raw: string) {
  const t = raw.trim(), n = norm(t), T = "owner";
  const pend = db.pending[T];
  if (pend && /^(yes|y|confirm|ok|approve pay run|post tuition|send links)\b/.test(n)) { db.pending[T] = undefined; return execPending(db, T, pend); }
  if (pend && /^(no|cancel|n)\b/.test(n)) { db.pending[T] = undefined; return post(db, T, "Okay, cancelled. Nothing was changed."); }
  if (/^(help|what can)/.test(n)) return post(db, T, "Here is everything this thread can run.", HELP_OWNER);

  let m: RegExpMatchArray | null;
  if ((m = n.match(/^(approve|decline) request (r\d+)/))) return resolveRequest(db, m[2].toUpperCase(), m[1] === "approve");
  if (/^(open )?requests|pending requests/.test(n)) {
    const open = db.requests.filter(r => r.status === "open");
    return post(db, T, open.length ? `${open.length} parent requests waiting on you.` : "No open requests. You are all caught up.", { kind: "request", title: "Open parent requests", rows: open.map(r => [`${r.id} · ${fam(db, r.familyId).name}`, r.text] as Row) },
      open.flatMap(r => r.type === "question" ? [] : [{ label: `Approve ${r.id}`, send: `approve request ${r.id}`, tone: "primary" as const }]), true);
  }
  if ((m = t.match(/^reply to (?:the )?([a-z]+)(?: family)?\s*:\s*(.+)$/i))) {
    const f = findFamily(db, m[1]); if (!f) return post(db, T, "Which family should I reply to?");
    db.requests.filter(r => r.familyId === f.id && r.type === "question" && r.status === "open").forEach(r => { r.status = "approved"; clearButtons(db, r); });
    post(db, parentThread(f), `Message from Blue Ocean: ${m[2]}`, { kind: "message", title: "Reply from the studio", rows: [["From", "Blue Ocean Dance Studio"], ["Message", m[2]]] });
    return post(db, T, `Reply sent to the ${f.name} family thread.`, { kind: "message", title: "Reply delivered", badge: { text: "Sent", tone: "good" }, rows: [["To", f.parentName], ["Message", m[2]]] });
  }

  if (/^enroll\b/.test(n)) return enroll(db, t);
  if (/(post|run|bill).*tuition/.test(n)) {
    const month = monthIn(t); const act = db.students.filter(s => s.active); const total = act.reduce((s, x) => s + x.rateCents, 0);
    db.pending[T] = { action: "tuition", data: { month } };
    return post(db, T, `Post ${month} tuition for ${act.length} active students, ${money(total)} total?`, { kind: "report", title: `${month} tuition preview`, subtitle: `${act.length} students · ${new Set(act.map(a => a.familyId)).size} families`, rows: [...act.map(s => [s.name, money(s.rateCents)] as Row), ["Total", money(total)]] }, [{ label: "Post tuition", send: "post tuition", tone: "primary" }, { label: "Cancel", send: "no" }]);
  }
  if (/^(collect|take payment|charge card|run card)/.test(n) || /charge .*card on file/.test(n)) {
    const f = findFamily(db, t); if (!f) return post(db, T, "Which family should I collect from?");
    const cents = amount(t) ?? balance(db, f.id);
    if (cents <= 0) return post(db, T, `The ${f.name} family has no balance due.`, balanceCard(db, f));
    return collect(db, f, cents, "Payment on account", "owner");
  }
  if (/^pay\b/.test(n) && db.instructors.some(i => has(n, i.name.split(" ")[0].toLowerCase()))) return payInstructor(db, t);
  if (/payroll|pay run/.test(n)) return payroll(db, t);
  if (/^charge\b/.test(n)) {
    const f = findFamily(db, t), cents = amount(t);
    if (!f || !cents) return post(db, T, "Tell me the family and amount, for example: Charge the Lopez family $85.");
    const desc = cap(t.match(/\bfor\s+(.+)$/i)?.[1] ?? "Studio charge");
    charge(db, f, cents, desc, T);
    post(db, parentThread(f), `A charge of ${money(cents)} for ${desc} was added to your account.`, balanceCard(db, f), payBtn(db, f));
    return post(db, T, `Charged the ${f.name} family ${money(cents)}. Posted to their account and shared in their thread.`, balanceCard(db, f), f.cardLast4 ? [{ label: `Collect ${money(balance(db, f.id))} from card ${f.cardLast4}`, send: `collect from ${f.name}`, tone: "primary" }] : undefined);
  }
  if (/mark all present|all present/.test(n)) {
    const k = findClass(db, t) ?? db.classes.find(c => has(n, c.day.toLowerCase()) && n.includes(c.time.replace(/[ap]m/, "")));
    if (!k) return post(db, T, "Which class? For example: Mark all present for Tuesday 4pm.");
    const ss = db.students.filter(s => s.classId === k.id && s.active);
    ss.forEach(s => db.attendance.push({ id: nid(db, "a"), studentId: s.id, classId: k.id, date: today() }));
    return post(db, T, `Marked ${ss.length} present for ${className(k)}. Roster updated and ${inst(db, k.instructorId).name.split(" ")[0]} gets credit for this class in payroll.`, { kind: "roster", title: `Roster · ${className(k)}`, subtitle: `${fmtDate(today())} · ${k.room} · ${inst(db, k.instructorId).name}`, badge: { text: `${ss.length} present`, tone: "good" }, rows: ss.map(s => [s.name, "Present", "good"] as Row) });
  }
  if (/checked in|check in/.test(n)) {
    const s = findStudent(db, t); if (!s) return post(db, T, "I could not find that student.");
    const k = kls(db, s.classId);
    db.attendance.push({ id: nid(db, "a"), studentId: s.id, classId: k.id, date: today() });
    const here = db.students.filter(x => x.classId === k.id).map(x => [x.name, db.attendance.some(a => a.studentId === x.id && a.date === today()) ? "Present" : "Not yet", db.attendance.some(a => a.studentId === x.id && a.date === today()) ? "good" : "muted"] as Row);
    return post(db, T, `${s.name} is checked in for ${className(k)}.`, { kind: "roster", title: `Roster · ${className(k)}`, subtitle: `${fmtDate(today())} · ${k.room}`, rows: here, footer: `${first(s)} has attended ${db.attendance.filter(a => a.studentId === s.id).length} classes.` });
  }
  if (/^(text|message|email|send (a )?(message|text|note))\b/.test(n) && !/waiver|release|form|payment link|costume/.test(n)) return broadcast(db, t);

  if (/processing fee|\bfees\b/.test(n)) {
    const pays = db.ledger.filter(l => l.type === "payment" && l.date.slice(0, 7) === today().slice(0, 7));
    const tot = pays.reduce((s, l) => s + (l.feeCents ?? 0), 0), gross = pays.reduce((s, l) => s + l.amountCents, 0);
    const byProc: Record<string, number> = {}; pays.forEach(p => byProc[p.processor ?? "?"] = (byProc[p.processor ?? "?"] ?? 0) + (p.feeCents ?? 0));
    return post(db, T, `This month you paid ${money(tot)} in processing fees on ${money(gross)} collected.`, { kind: "report", title: "Processing fees this month", rows: [["Payments", String(pays.length)], ["Collected", money(gross)], ...Object.entries(byProc).map(([k, v]) => [`Fees via ${k}`, money(v)] as Row), ["Effective rate", gross ? (tot / gross * 100).toFixed(2) + "%" : "n/a"], ["Current processor", `${db.processor.name} at ${db.processor.ratePct}% + ${db.processor.fixedCents}c`]] });
  }
  if (/^(use|switch to|set processor|processor)\b/.test(n) || /as (our )?processor/.test(n)) {
    const pm = t.match(/(?:use|switch to|processor(?: to| is)?)\s+([A-Za-z][\w ]*?)(?:\s+(?:at|as|with)\b|$)/i);
    const name = (pm?.[1] ?? "").trim(); if (!name) return post(db, T, `Current processor is ${db.processor.name}. Say: Use Square at 2.6% + 15c.`);
    const rate = t.match(/(\d+(?:\.\d+)?)\s?%/), fixed = t.match(/\+\s?(\d+)\s?c/i);
    const isStripe = /^stripe$/i.test(name);
    db.processor = { name: cap(name), ratePct: rate ? parseFloat(rate[1]) : isStripe ? 2.9 : db.processor.ratePct, fixedCents: fixed ? parseInt(fixed[1]) : isStripe ? 30 : db.processor.fixedCents, external: !isStripe };
    return post(db, T, `Noted. New payments will run through ${db.processor.name}. Family accounts and parent payment links keep working the same way.`, { kind: "info", title: "Payment processor", badge: { text: db.processor.external ? "Your merchant" : "Default", tone: "good" }, rows: [["Processor", db.processor.name], ["Rate", `${db.processor.ratePct}% + ${db.processor.fixedCents}c per charge`]] });
  }

  // back office
  if (/costume (payment|fee)|payment links?/.test(n)) return costumeLinks(db);
  if (/size chart|costume sizes/.test(n)) return sizeChart(db);
  if (/^order\b/.test(n)) return orderCostume(db, t);
  if (/tutu|leotard|jacket|dress|costume/.test(n)) return costumeInventory(db, t);
  if (/^sell\b|merch|store|hoodie|tee|bag|bottle|scrunchie/.test(n)) return merch(db, t);
  if (/^add .* to (the )?/.test(n) && db.recital.order.some(o => n.includes(norm(o.number)))) return addToNumber(db, t);
  if (/running order|show order|lineup/.test(n)) return runningOrder(db);
  if ((m = n.match(/^mark (?:the )?([a-z ]+?) (booked|done|paid|pending)$/))) return vendorUpdate(db, m[1], m[2]);
  if (/recital|showcase|tickets|vendor|spring show/.test(n)) return recitalStatus(db);
  if (/waiver|release|medical|sign|compliance|background check/.test(n)) return waivers(db, t);

  if (/revenue|outstanding|report|who owes/.test(n)) return report(db, t);
  if (/roster/.test(n)) {
    const k = findClass(db, t); if (!k) return post(db, T, "Which class roster?");
    return post(db, T, `${className(k)} with ${inst(db, k.instructorId).name}.`, { kind: "roster", title: `Roster · ${className(k)}`, subtitle: `${k.room} · ${k.hours} hr`, rows: db.students.filter(s => s.classId === k.id).map(s => [s.name, `${money(s.rateCents)} / mo`] as Row) });
  }
  if (/balance/.test(n)) {
    const f = findFamily(db, t); if (!f) return post(db, T, "Which family?");
    return post(db, T, `The ${f.name} family owes ${money(balance(db, f.id))}.`, balanceCard(db, f));
  }
  const s = findStudent(db, t);
  if (s) return post(db, T, `Here is ${s.name}.`, studentCard(db, s));
  return post(db, T, "I did not catch that. Tap a suggestion below or type help.");
}

function enroll(db: DB, t: string) {
  const nm = t.match(/enroll\s+([A-Za-z']+\s+[A-Za-z']+)/i);
  if (!nm) return post(db, "owner", "Who should I enroll? Try: Enroll Emma Chen in Monday 5pm Ballet, $75/month.");
  const name = cap(nm[1].toLowerCase());
  const k = findClass(db, t), spec = !k ? parseClassSpec(db, t) : undefined;
  if (!k && !spec) return post(db, "owner", "Which class? Include day, time and style, for example Monday 5pm Ballet.");
  const rate = amount(t) ?? 7500, card4 = t.match(/(?:ending|ends in|last four)\s*(\d{4})/i)?.[1];
  const day = (k ?? spec!).day;
  let start = /next week/i.test(t) ? nextDate(day) : today();
  const sm = t.match(/start(?:s|ing)?\s+(?:on\s+)?(\d{4}-\d\d-\d\d)/i); if (sm) start = sm[1];
  const chargeNow = /charge/i.test(t);
  db.pending.owner = { action: "enroll", data: { name, classId: k?.id, newClass: spec, rate, card4, start, chargeNow } };
  const last = name.split(" ")[1], f = db.families.find(x => x.name.toLowerCase() === last.toLowerCase());
  return post(db, "owner", "Confirm enroll?", { kind: "confirm", title: `New enrollment · ${name}`, badge: { text: "Needs confirm", tone: "warn" }, rows: [["Class", k ? className(k) : `${className(spec!)} (new class)`], ["Instructor", inst(db, (k ?? spec!).instructorId).name], ["Tuition", `${money(rate)} per month`], ["Start", fmtDate(start)], ["Family", f ? `${f.name} (existing)` : `${last} (new family)`], ["Card", card4 ? `ending ${card4}` : f?.cardLast4 ? `ending ${f.cardLast4}` : "none"], ["First charge", chargeNow ? `${money(rate)} posted now` : "next tuition run"]] },
    [{ label: "Confirm enroll", send: "yes", tone: "primary" }, { label: "Cancel", send: "no" }]);
}

function payrollRows(db: DB, month: string) {
  const key = monthKey(month);
  return db.instructors.map(i => {
    const sessions = new Set(db.attendance.filter(a => a.date.startsWith(key) && kls(db, a.classId)?.instructorId === i.id).map(a => `${a.classId}|${a.date}`));
    const hours = [...sessions].reduce((h, s) => h + kls(db, s.split("|")[0]).hours, 0);
    const paid = db.payouts.filter(p => p.instructorId === i.id && p.month === month).reduce((s, p) => s + p.amountCents, 0);
    return { i, classes: sessions.size, hours, amount: sessions.size * i.ratePerClassCents, paid };
  });
}
function payroll(db: DB, t: string) {
  const month = monthIn(t), rows = payrollRows(db, month);
  const due = rows.reduce((s, r) => s + Math.max(0, r.amount - r.paid), 0);
  const card: Card = { kind: "payrun", title: `Pay run · ${month}`, subtitle: "Per class pay calculated from attendance", badge: { text: due ? `${money(due)} due` : "Paid", tone: due ? "warn" : "good" }, rows: [],
    sections: rows.map(r => ({ heading: `${r.i.name} · ${money(r.i.ratePerClassCents)} per class`, rows: [["Classes taught", String(r.classes)], ["Hours", String(r.hours)], ["Amount due", money(Math.max(0, r.amount - r.paid)), r.amount - r.paid > 0 ? "warn" : "good"], ...(r.paid ? [["Already paid", money(r.paid), "muted"] as Row] : [])] })),
    footer: `Total ${money(due)} across ${rows.length} instructors` };
  if (!due) return post(db, "owner", `${month} payroll is fully paid.`, card);
  db.pending.owner = { action: "payroll", data: { month } };
  return post(db, "owner", `${month} payroll is ready: ${money(due)} for ${rows.filter(r => r.amount > r.paid).length} instructors. Approve the pay run?`, card, [{ label: "Approve pay run", send: "approve pay run", tone: "primary" }, { label: "Cancel", send: "no" }]);
}
function payInstructor(db: DB, t: string) {
  const n = norm(t), i = db.instructors.find(x => has(n, x.name.split(" ")[0].toLowerCase()))!, cents = amount(t);
  if (!cents) return post(db, "owner", `How much should I pay ${i.name.split(" ")[0]}?`);
  const month = monthIn(t), r = payrollRows(db, month).find(x => x.i.id === i.id)!;
  db.payouts.push({ id: nid(db, "p"), instructorId: i.id, month, classes: r.classes, hours: r.hours, amountCents: cents, date: today() });
  return post(db, "owner", `Paid ${i.name} ${money(cents)} for ${month} classes.`, { kind: "payrun", title: `Pay run · ${i.name}`, subtitle: month, badge: { text: "Paid", tone: "good" }, rows: [["Classes taught", String(r.classes)], ["Hours", String(r.hours)], ["Calculated pay", money(r.amount)], ["Amount paid", money(cents), "good"], [cents >= r.amount ? "Over calculated pay" : "Under calculated pay", money(Math.abs(cents - r.amount)), cents === r.amount ? "good" : "warn"]] });
}

function costumeOf(db: DB, t: string) {
  const n = norm(t);
  return db.costumes.find(c => c.name.toLowerCase().split(" ").filter(w => w.length > 3).some(w => n.includes(w.replace(/s$/, ""))) || n.includes(c.color));
}
function costumeCard(db: DB, c: { id: string; name: string; number: string; priceCents: number; stock: Record<string, number> }): Card {
  const as = db.assignments.filter(a => a.costumeId === c.id);
  const rows: Row[] = Object.entries(c.stock).map(([size, on]) => {
    const asg = as.filter(a => a.size === size).length, owed = Math.max(0, asg - on);
    return [size, `${on} on hand · ${asg} assigned${owed ? ` · ${owed} still owed` : ""}`, owed ? "bad" : on - asg <= 0 ? "warn" : undefined] as Row;
  }).map(r => r.filter(Boolean) as Row);
  const on = Object.values(c.stock).reduce((a, b) => a + b, 0), asg = as.length, owed = Object.entries(c.stock).reduce((s, [z, o]) => s + Math.max(0, as.filter(a => a.size === z).length - o), 0);
  const unpaid = as.filter(a => !a.paid).length;
  return { kind: "inventory", title: `Inventory · ${c.name}`, subtitle: `${c.number} · ${money(c.priceCents)} costume fee`, badge: owed ? { text: `${owed} still owed`, tone: "bad" } : { text: "Covered", tone: "good" }, rows,
    sections: [{ heading: "Totals", rows: [["On hand", String(on)], ["Assigned to dancers", String(asg)], ["Still owed to dancers", String(owed), owed ? "bad" : "good"], ["Costume fees unpaid", String(unpaid), unpaid ? "warn" : "good"]] }] };
}
function costumeInventory(db: DB, t: string) {
  const c = costumeOf(db, t);
  if (!c) return post(db, "owner", "Here is the full costume inventory.", { kind: "inventory", title: "Costume inventory", rows: db.costumes.map(c => { const on = Object.values(c.stock).reduce((a, b) => a + b, 0); const asg = db.assignments.filter(a => a.costumeId === c.id).length; return [c.name, `${on} on hand · ${asg} assigned`] as Row; }) });
  const left = Object.values(c.stock).reduce((a, b) => a + b, 0) - db.assignments.filter(a => a.costumeId === c.id).length;
  return post(db, "owner", `You have ${Object.values(c.stock).reduce((a, b) => a + b, 0)} ${c.name.toLowerCase()}s on hand, ${Math.max(0, left)} not yet assigned.`, costumeCard(db, c));
}
const SIZE_WORDS: Record<string, string> = { "extra small": "Child XS", xs: "Child XS", small: "Child S", medium: "Child M", large: "Child L", "adult small": "Adult S" };
function orderCostume(db: DB, t: string) {
  const n = norm(t), qty = parseInt(n.match(/\b(\d+)\b/)?.[1] ?? "0"), c = costumeOf(db, t);
  if (!c || !qty) return post(db, "owner", "Tell me how many, the size and the costume, for example: Order 12 medium black leotards.");
  const sizeKey = Object.keys(SIZE_WORDS).sort((a, b) => b.length - a.length).find(w => has(n, w)); const size = sizeKey ? SIZE_WORDS[sizeKey] : "Child M";
  c.stock[size] = (c.stock[size] ?? 0) + qty;
  return post(db, "owner", `Ordered ${qty} ${size} ${c.name.toLowerCase()}s. Inventory and size chart updated.`, costumeCard(db, c));
}
function sizeChart(db: DB) {
  const sizes = [...new Set(db.costumes.flatMap(c => Object.keys(c.stock)))];
  return post(db, "owner", "Here is the size chart for every dancer in the show.", { kind: "inventory", title: "Costume size chart", subtitle: db.recital.name, rows: sizes.map(z => [z, db.students.filter(s => s.size === z).map(first).join(", ") || "none"] as Row), sections: [{ heading: "Assignments", rows: db.assignments.map(a => [stu(db, a.studentId).name, `${db.costumes.find(c => c.id === a.costumeId)!.name} · ${a.size}`, a.paid ? "good" : "warn"] as Row) }] });
}
function costumeLinks(db: DB) {
  const unbilled = db.assignments.filter(a => !a.billed);
  if (!unbilled.length) return post(db, "owner", "Every costume fee has already been sent.");
  const byFam: Record<string, typeof unbilled> = {};
  unbilled.forEach(a => (byFam[stu(db, a.studentId).familyId] ??= []).push(a));
  db.pending.owner = { action: "costumeLinks", data: {} };
  return post(db, "owner", `Send costume payment links to ${Object.keys(byFam).length} families in the ${db.recital.name}?`, { kind: "confirm", title: "Costume payment links", badge: { text: "Needs confirm", tone: "warn" }, rows: Object.entries(byFam).map(([fid, list]) => [`${fam(db, fid).name} family`, `${list.map(a => first(stu(db, a.studentId))).join(", ")} · ${money(list.reduce((s, a) => s + db.costumes.find(c => c.id === a.costumeId)!.priceCents, 0))}`] as Row) },
    [{ label: "Send links", send: "send links", tone: "primary" }, { label: "Cancel", send: "no" }]);
}
function merch(db: DB, t: string) {
  const n = norm(t);
  if (/^sell\b/.test(n) || /sold/.test(n)) {
    const item = db.merch.find(i => i.name.toLowerCase().split(" ").some(w => w.length > 2 && n.includes(w.replace(/s$/, ""))));
    if (!item) return post(db, "owner", "Which item? For example: Sell 2 hoodies to the Rossi family.");
    const qty = parseInt(n.match(/\b(\d+)\b/)?.[1] ?? "1");
    if (item.stock < qty) return post(db, "owner", `Only ${item.stock} ${item.name.toLowerCase()}s left in stock.`, merchCard(db));
    const f = findFamily(db, t); const cents = qty * item.priceCents;
    item.stock -= qty; item.sold += qty; db.sales.push({ id: nid(db, "x"), itemId: item.id, qty, familyId: f?.id, amountCents: cents, date: today() });
    if (f) { charge(db, f, cents, `${qty} ${item.name}`, "owner"); post(db, parentThread(f), `${qty} ${item.name} added to your account for ${money(cents)}.`, balanceCard(db, f), payBtn(db, f)); }
    return post(db, "owner", `Sold ${qty} × ${item.name} for ${money(cents)}${f ? `, charged to the ${f.name} family` : " at the front desk"}. Sale logged.`, { kind: "inventory", title: `Sale · ${item.name}`, badge: { text: "Logged", tone: "good" }, rows: [["Quantity", String(qty)], ["Amount", money(cents)], ["Charged to", f ? `${f.name} family account` : "Front desk"], ["Left in stock", String(item.stock), item.stock < 5 ? "warn" : undefined].filter(Boolean) as Row, ["Sold to date", String(item.sold)]] });
  }
  return post(db, "owner", "Here is the studio store.", merchCard(db));
}
function merchCard(db: DB): Card {
  const rev = db.merch.reduce((s, i) => s + i.sold * i.priceCents, 0);
  return { kind: "inventory", title: "Studio store", subtitle: `${money(rev)} in sales to date`, rows: db.merch.map(i => [`${i.name} · ${money(i.priceCents)}`, `${i.stock} in stock · ${i.sold} sold`, i.stock === 0 ? "bad" : i.stock < 5 ? "warn" : undefined].filter(Boolean) as Row), footer: db.merch.filter(i => i.stock < 5).map(i => i.stock ? `${i.name} running low` : `${i.name} sold out`).join(" · ") || undefined };
}
function recitalCard(db: DB): Card {
  const r = db.recital, done = r.vendors.filter(v => v.status !== "pending").length;
  return { kind: "event", title: r.name, subtitle: `${fmtDate(r.date)} · ${r.venue}`, badge: { text: `${r.seats - r.sold} seats left`, tone: r.seats - r.sold < 30 ? "warn" : "good" }, progress: { label: `${r.sold} of ${r.seats} seats sold`, value: r.sold, max: r.seats },
    rows: [["Ticket price", money(r.ticketCents)], ["Ticket revenue", money(r.sold * r.ticketCents)], ["Numbers in show", String(r.order.length)], ["Dancers", String(new Set(r.order.flatMap(o => o.studentIds)).size)]],
    sections: [{ heading: `Vendor checklist · ${done} of ${r.vendors.length} confirmed`, rows: r.vendors.map(v => [`${v.role} · ${v.name}`, `${v.status === "pending" ? "Pending" : v.status === "done" ? "Done" : "Booked"} · ${money(v.costCents)} · due ${fmtDate(v.due)}`, v.status === "pending" ? "warn" : "good"] as Row) }] };
}
function recitalStatus(db: DB) {
  const p = db.recital.vendors.filter(v => v.status === "pending");
  return post(db, "owner", `${db.recital.sold} seats sold. ${p.length ? `${p.length} vendors still pending: ${p.map(v => v.role.toLowerCase()).join(", ")}.` : "All vendors confirmed."}`, recitalCard(db),
    [{ label: "Running order", send: "running order" }, ...p.slice(0, 2).map(v => ({ label: `Mark ${v.role.toLowerCase()} booked`, send: `mark ${v.role.toLowerCase()} booked` }))], true);
}
function runningOrder(db: DB) {
  return post(db, "owner", `${db.recital.name} running order.`, { kind: "event", title: "Running order", subtitle: `${db.recital.name} · ${fmtDate(db.recital.date)}`, rows: db.recital.order.map((o, i) => [`${i + 1}. ${o.number}`, o.studentIds.map(id => first(stu(db, id))).join(", ") || "no dancers yet"] as Row) });
}
function vendorUpdate(db: DB, who: string, status: string) {
  const v = db.recital.vendors.find(x => who.includes(x.role.toLowerCase()) || x.role.toLowerCase().includes(who) || x.name.toLowerCase().includes(who));
  if (!v) return post(db, "owner", "Which vendor? Try photographer, videographer, florist, programs, venue or sound.");
  v.status = status === "pending" ? "pending" : status === "booked" ? "booked" : "done";
  return post(db, "owner", `${v.role} (${v.name}) marked ${v.status}. Vendor checklist updated.`, recitalCard(db));
}
function addToNumber(db: DB, t: string) {
  const n = norm(t), o = db.recital.order.find(x => n.includes(norm(x.number)))!, s = findStudent(db, t);
  if (!s) return post(db, "owner", "Which dancer?");
  if (!o.studentIds.includes(s.id)) o.studentIds.push(s.id);
  let extra = "";
  if (o.costumeId && !db.assignments.some(a => a.studentId === s.id && a.costumeId === o.costumeId)) {
    db.assignments.push({ studentId: s.id, costumeId: o.costumeId, size: s.size, billed: false, paid: false });
    const c = db.costumes.find(c => c.id === o.costumeId)!;
    extra = ` ${c.name} assigned in size ${s.size}.`;
    post(db, "owner", `${s.name} added to ${o.number}.${extra}`, costumeCard(db, c));
  } else post(db, "owner", `${s.name} added to ${o.number}.`);
  return runningOrder(db);
}
function waivers(db: DB, t: string) {
  const n = norm(t);
  const w = db.waivers.find(x => n.includes(x.name.toLowerCase().split(" ")[0]));
  if (/^send/.test(n)) {
    const list = w ? [w] : db.waivers;
    const targets = /new waiver|all families/.test(n) ? db.families : db.families.filter(f => list.some(x => !db.signatures.some(s => s.familyId === f.id && s.waiverId === x.id)));
    targets.forEach(f => list.filter(x => /new waiver|all families/.test(n) || !db.signatures.some(s => s.familyId === f.id && s.waiverId === x.id)).forEach(x =>
      post(db, parentThread(f), `Please review and sign the ${x.name.toLowerCase()} for the ${new Date().getFullYear()} season.`, { kind: "compliance", title: x.name, subtitle: "Blue Ocean Dance Studio", badge: { text: "Signature needed", tone: "warn" }, rows: [["Family", f.name], ["Dancers", db.students.filter(s => s.familyId === f.id).map(first).join(", ") || "none yet"]] }, [{ label: `Sign ${x.name.toLowerCase()}`, send: `sign ${x.name.toLowerCase()}`, tone: "primary" }])));
    return post(db, "owner", `Sent ${list.length === 1 ? `the ${list[0].name.toLowerCase()}` : "waivers"} to ${targets.length} families. You will see each signature here as it comes in.`, { kind: "message", title: "Waiver sent", badge: { text: `${targets.length} families`, tone: "good" }, rows: targets.map(f => [f.parentName, `${f.name} family thread`] as Row) });
  }
  const checks = db.instructors.filter(i => !i.checkOk);
  const list = w ? [w] : db.waivers;
  const missing = list.map(x => ({ x, fams: db.families.filter(f => !db.signatures.some(s => s.familyId === f.id && s.waiverId === x.id)) }));
  const total = missing.reduce((s, m) => s + m.fams.length, 0);
  return post(db, "owner", w ? (total ? `${total} families still need to sign the ${w.name.toLowerCase()}: ${missing[0].fams.map(f => f.name).join(", ")}.` : `Everyone has signed the ${w.name.toLowerCase()}.`) : `${total} missing signatures${checks.length ? ` and ${checks.length} background check flagged` : ""}.`,
    { kind: "compliance", title: w ? `Compliance · ${w.name}` : "Compliance overview", badge: { text: total || checks.length ? `${total + (w ? 0 : checks.length)} flagged` : "All clear", tone: total || checks.length ? "bad" : "good" }, rows: [],
      sections: [...missing.map(m => ({ heading: `${m.x.name} · ${db.families.length - m.fams.length} of ${db.families.length} signed`, rows: db.families.map(f => [f.name, m.fams.includes(f) ? "Missing" : "Signed", m.fams.includes(f) ? "bad" : "good"] as Row) })),
        ...(w ? [] : [{ heading: "Instructor background checks", rows: db.instructors.map(i => [i.name, `${i.checkOk ? "Current" : "Expired"} · ${fmtDate(i.backgroundCheck)}`, i.checkOk ? "good" : "bad"] as Row) }])] },
    total ? [{ label: w ? `Send ${w.name.toLowerCase()} to missing families` : "Send waivers to missing families", send: w ? `send ${w.name.toLowerCase()} to missing families` : "send waivers to missing families", tone: "primary" }] : undefined, true);
}
function broadcast(db: DB, t: string) {
  const n = norm(t);
  const body = t.match(/\bthat\s+(.+)$/i)?.[1] ?? t.match(/:\s*(.+)$/)?.[1];
  if (!body) return post(db, "owner", "What should the message say? For example: Text the Tuesday class that rehearsal moved to 5pm.");
  let fams: Family[] = [], label = "";
  const day = DAYS.find(d => has(n, d)); const k = findClass(db, t);
  if (/all families|everyone|all parents/.test(n)) { fams = db.families; label = "All families"; }
  else if (k || day) { const cs = k ? [k] : db.classes.filter(c => c.day.toLowerCase() === day); fams = [...new Set(db.students.filter(s => cs.some(c => c.id === s.classId)).map(s => s.familyId))].map(id => fam(db, id)); label = k ? className(k) : `${cap(day!)} classes`; }
  else { const f = findFamily(db, t); if (f) { fams = [f]; label = `${f.name} family`; } }
  if (!fams.length) return post(db, "owner", "Who should get it? Name a class, a family, or say all families.");
  const channel = /^email/.test(n) ? "Email" : /^text/.test(n) ? "Text" : "Text and email";
  const msg = body.charAt(0).toUpperCase() + body.slice(1).replace(/\.?$/, ".");
  fams.forEach(f => post(db, parentThread(f), `Studio update: ${msg}`, { kind: "message", title: "Message from the studio", subtitle: `${channel} · ${label}`, rows: [["Message", msg]] }));
  return post(db, "owner", `${channel} sent to ${fams.length} families in ${label}.`, { kind: "message", title: "Message sent", subtitle: `${channel} · ${label}`, badge: { text: "Delivered", tone: "good" }, rows: [["Message", msg], ...fams.map(f => [f.parentName, channel === "Email" ? f.email : f.phone] as Row)] });
}
function report(db: DB, t: string) {
  const over = t.match(/over\s+\$?(\d+)/i), min = over ? parseInt(over[1]) * 100 : 1;
  const owing = db.families.map(f => ({ f, b: balance(db, f.id) })).filter(x => x.b >= min).sort((a, b) => b.b - a.b);
  const ym = today().slice(0, 7);
  const pays = db.ledger.filter(l => l.type === "payment" && l.date.startsWith(ym)), charges = db.ledger.filter(l => l.type === "charge" && l.date.startsWith(ym));
  const rev = pays.reduce((s, l) => s + l.amountCents, 0), fees = pays.reduce((s, l) => s + (l.feeCents ?? 0), 0);
  const payroll = db.payouts.filter(p => p.date.startsWith(ym)).reduce((s, p) => s + p.amountCents, 0);
  const merchSales = db.sales.filter(s => s.date.startsWith(ym)).reduce((s, x) => s + x.amountCents, 0);
  const outTotal = owing.reduce((s, x) => s + x.b, 0);
  const card: Card = over ? { kind: "report", title: `Balances over ${money(min)}`, badge: { text: money(outTotal), tone: "warn" }, rows: owing.map(x => [`${x.f.name} family`, money(x.b), "warn"] as Row) }
    : { kind: "report", title: `${monthName()} revenue and outstanding`, subtitle: `Through ${fmtDate(today())}`, badge: { text: `${money(rev - fees)} net`, tone: "good" }, rows: [["Billed this month", money(charges.reduce((s, l) => s + l.amountCents, 0))], ["Collected", money(rev), "good"], ["Processing fees", money(fees), "muted"], ["Merch sales", money(merchSales)], ["Payroll paid", money(payroll), "muted"], ["Net after fees and payroll", money(rev - fees - payroll)]],
      progress: { label: `${money(rev)} collected of ${money(rev + outTotal)}`, value: rev, max: Math.max(1, rev + outTotal) },
      sections: [{ heading: `Outstanding · ${money(outTotal)}`, rows: owing.map(x => [`${x.f.name} family`, money(x.b), "warn"] as Row) }] };
  return post(db, "owner", over ? `${owing.length} families owe more than ${money(min)}.` : `Here is ${monthName()} so far.`, card, owing.filter(x => x.f.cardLast4).map(x => ({ label: `Charge ${x.f.name} ${money(x.b)}`, send: `collect from ${x.f.name}` })), true);
}

function clearButtons(db: DB, r: Request) { const m = db.messages.find(x => x.id === r.ownerMsgId); if (m) m.buttons = undefined; }
function resolveRequest(db: DB, rid: string, ok: boolean) {
  const r = db.requests.find(x => x.id === rid);
  if (!r || r.status !== "open") return post(db, "owner", `Request ${rid} is not open.`);
  r.status = ok ? "approved" : "declined"; clearButtons(db, r);
  const f = fam(db, r.familyId), s = r.studentId ? stu(db, r.studentId) : undefined;
  if (!ok) { post(db, parentThread(f), `The studio could not approve your request: ${r.text}. Reply here if you would like other options.`, { kind: "request", title: "Request declined", badge: { text: "Declined", tone: "bad" }, rows: [["Request", r.text]] }); return post(db, "owner", `Declined ${rid}. The ${f.name} family was told in their thread.`); }
  let card: Card;
  if (r.type === "switch" && s && r.toClassId) {
    const from = kls(db, s.classId), to = kls(db, r.toClassId); s.classId = to.id;
    card = { kind: "confirm", title: "Class switch confirmed", badge: { text: "Approved", tone: "good" }, rows: [["Dancer", s.name], ["From", className(from)], ["To", to.style], ["Day and time", `${to.day} ${to.time}`], ["First class", fmtDate(nextDate(to.day))], ["Amount", `${money(s.rateCents)} per month, no change`]] };
  } else if (r.type === "cancel" && s) {
    const k = kls(db, s.classId);
    card = { kind: "confirm", title: "Class cancellation confirmed", badge: { text: "Approved", tone: "good" }, rows: [["Dancer", s.name], ["Class", k.style], ["Date", fmtDate(r.date!)], ["Time", `${k.time} · ${k.room}`], ["Amount", "No charge, excused absence"]] };
  } else {
    const k = kls(db, r.toClassId!), feeC = 1500; charge(db, f, feeC, `Trial class for ${r.studentName}`, "owner");
    card = { kind: "confirm", title: "Trial class booked", badge: { text: "Approved", tone: "good" }, rows: [["Dancer", r.studentName!], ["Class", k.style], ["Date", fmtDate(r.date!)], ["Time", `${k.time} · ${k.room}`], ["Instructor", inst(db, k.instructorId).name], ["Amount", money(feeC)]] };
  }
  post(db, parentThread(f), "Good news, the studio approved your request.", card, r.type === "trial" ? payBtn(db, f) : undefined);
  return post(db, "owner", `Approved ${rid}. The ${f.name} family has their confirmation.`, card);
}

function execPending(db: DB, T: string, p: { action: string; data: any }) {
  if (p.action === "enroll") {
    const d = p.data; const [fn, last] = d.name.split(" ");
    let f = db.families.find(x => x.name.toLowerCase() === last.toLowerCase());
    if (!f) { f = { id: nid(db, "fam_"), name: last, parentName: `${last} family`, phone: "not on file", email: "not on file", cardLast4: d.card4 }; db.families.push(f); post(db, parentThread(f), "Welcome to Blue Ocean Dance Studio! This is your family thread."); }
    if (d.card4) f.cardLast4 = d.card4;
    let classId = d.classId; if (!classId) { const k = { ...d.newClass, id: nid(db, "c_") }; db.classes.push(k); classId = k.id; }
    const s: Student = { id: nid(db, "s_"), name: `${fn} ${last}`, familyId: f.id, classId, rateCents: d.rate, startDate: d.start, active: true, size: "Child M", age: 9 };
    db.students.push(s);
    const k = kls(db, classId);
    if (d.chargeNow) charge(db, f, d.rate, `${monthName()} tuition for ${fn}`, T);
    post(db, T, `${s.name} is enrolled in ${className(k)} and added to the roster.${d.chargeNow ? ` First charge of ${money(d.rate)} posted.` : ""} The ${f.name} family thread was notified.`, studentCard(db, s, "Student record created"));
    const bal = balance(db, f.id);
    return post(db, parentThread(f), `${fn} is enrolled in ${className(k)}.${bal > 0 ? ` You owe ${money(bal)}.` : ""}`, { kind: "confirm", title: "Enrollment confirmed", badge: { text: "Enrolled", tone: "good" }, rows: [["Dancer", s.name], ["Class", k.style], ["Date", `Starts ${fmtDate(d.start)}`], ["Time", `${k.day} ${k.time} · ${k.room}`], ["Amount", `${money(d.rate)} per month`]] }, bal > 0 ? payBtn(db, f) : undefined);
  }
  if (p.action === "tuition") {
    const act = db.students.filter(s => s.active); let total = 0;
    for (const s of act) { charge(db, fam(db, s.familyId), s.rateCents, `${p.data.month} tuition for ${first(s)}`, T); total += s.rateCents; }
    for (const f of db.families) if (act.some(s => s.familyId === f.id)) post(db, parentThread(f), `${p.data.month} tuition is posted. Your balance is ${money(balance(db, f.id))}.`, balanceCard(db, f), payBtn(db, f));
    return post(db, T, `Posted ${p.data.month} tuition: ${act.length} charges, ${money(total)} total. Each family was notified in their thread.`, { kind: "report", title: `${p.data.month} tuition posted`, badge: { text: "Posted", tone: "good" }, rows: [["Charges", String(act.length)], ["Total billed", money(total)], ["Outstanding now", money(db.families.reduce((s, f) => s + Math.max(0, balance(db, f.id)), 0)), "warn"]] });
  }
  if (p.action === "payroll") {
    const rows = payrollRows(db, p.data.month).filter(r => r.amount > r.paid); let tot = 0;
    rows.forEach(r => { db.payouts.push({ id: nid(db, "p"), instructorId: r.i.id, month: p.data.month, classes: r.classes, hours: r.hours, amountCents: r.amount - r.paid, date: today() }); tot += r.amount - r.paid; });
    return post(db, T, `Pay run approved. ${money(tot)} paid to ${rows.length} instructors for ${p.data.month}.`, { kind: "payrun", title: `Pay run complete · ${p.data.month}`, badge: { text: "Paid", tone: "good" }, rows: rows.map(r => [r.i.name, `${r.classes} classes · ${r.hours} hrs · ${money(r.amount - r.paid)}`, "good"] as Row), footer: `Total ${money(tot)}` });
  }
  if (p.action === "costumeLinks") {
    const byFam: Record<string, typeof db.assignments> = {};
    db.assignments.filter(a => !a.billed).forEach(a => (byFam[stu(db, a.studentId).familyId] ??= []).push(a));
    let tot = 0;
    Object.entries(byFam).forEach(([fid, list]) => {
      const f = fam(db, fid);
      list.forEach(a => { const c = db.costumes.find(c => c.id === a.costumeId)!; charge(db, f, c.priceCents, `${c.name} for ${first(stu(db, a.studentId))}`, T); tot += c.priceCents; a.billed = true; });
      post(db, parentThread(f), `Costume fees for the ${db.recital.name} are ready.`, { kind: "payment", title: "Costume payment link", subtitle: db.recital.name, badge: { text: "Due", tone: "warn" }, rows: [...list.map(a => { const c = db.costumes.find(c => c.id === a.costumeId)!; return [`${first(stu(db, a.studentId))} · ${c.name} · ${a.size}`, money(c.priceCents)] as Row; }), ["Balance due", money(balance(db, f.id)), "warn"]] }, payBtn(db, f));
    });
    return post(db, T, `Costume payment links sent to ${Object.keys(byFam).length} families, ${money(tot)} total. Fees posted to each family account.`);
  }
  if (p.action === "pay") {
    const f = fam(db, p.data.familyId), b = balance(db, f.id);
    if (b <= 0) return post(db, T, "You are all paid up.");
    return collect(db, f, Math.min(p.data.cents, b), p.data.desc, "parent");
  }
  if (p.action === "tickets") {
    const f = fam(db, p.data.familyId), cents = p.data.qty * db.recital.ticketCents;
    db.recital.sold += p.data.qty; db.recital.ticketSales.push({ familyId: f.id, qty: p.data.qty });
    charge(db, f, cents, `${p.data.qty} recital tickets`, T);
    post(db, "owner", `The ${f.name} family bought ${p.data.qty} tickets. ${db.recital.sold} of ${db.recital.seats} seats now sold.`);
    return collect(db, f, cents, `${p.data.qty} ${db.recital.name} tickets`, "parent");
  }
}

// ---------- parent ----------
function newRequest(db: DB, f: Family, r: Omit<Request, "id" | "status" | "familyId">, parentText: string, card: Card) {
  const req: Request = { ...r, id: `R${++db.seq}`, familyId: f.id, status: "open" };
  db.requests.push(req);
  const m = post(db, "owner", `New request from ${f.parentName}: ${r.text}`, { ...card, title: `${card.title} · ${req.id}`, badge: { text: "Waiting on you", tone: "warn" } },
    r.type === "question" ? [{ label: "Reply", send: `Reply to ${f.name}: ` }] : [{ label: "Approve", send: `approve request ${req.id}`, tone: "primary" }, { label: "Decline", send: `decline request ${req.id}` }], true);
  req.ownerMsgId = m.id;
  return post(db, parentThread(f), parentText, { ...card, badge: { text: "Sent to studio", tone: "muted" } });
}
function parentCmd(db: DB, T: string, raw: string) {
  const f = db.families.find(x => parentThread(x) === T)!; const n = norm(raw);
  const kids = db.students.filter(s => s.familyId === f.id);
  const pend = db.pending[T]; const b = balance(db, f.id);
  if (pend && /^(yes|y|confirm|ok|pay now|buy)\b/.test(n)) { db.pending[T] = undefined; return execPending(db, T, pend); }
  if (pend && /^(no|cancel|not now|n)$/.test(n)) { db.pending[T] = undefined; return post(db, T, "No problem. Nothing was changed."); }
  if (/^help|what can/.test(n)) return post(db, T, "Here is what you can ask.", { kind: "info", title: "Your family thread", rows: [["Balance", "What's my balance?"], ["Pay", "Pay October tuition"], ["Trial", "Book a trial for Sofia in Saturday 10am Contemporary"], ["Switch", "Can Maya switch to Thursday hip hop?"], ["Cancel", "Cancel next week's class"], ["Tickets", "Buy 4 recital tickets"], ["Question", "Ask anything, the studio will reply here"]] });
  if ((/^sign\b/.test(n) || /i agree/.test(n))) {
    const w = db.waivers.find(x => n.includes(x.name.toLowerCase().split(" ")[0])) ?? db.waivers.find(x => !db.signatures.some(s => s.familyId === f.id && s.waiverId === x.id));
    if (!w) return post(db, T, "Everything is signed. Thank you!");
    if (!db.signatures.some(s => s.familyId === f.id && s.waiverId === w.id)) db.signatures.push({ familyId: f.id, waiverId: w.id, date: today() });
    const card: Card = { kind: "compliance", title: w.name, badge: { text: "Signed", tone: "good" }, rows: [["Signed by", f.parentName], ["Date", fmtDate(today())]] };
    post(db, "owner", `${f.parentName} signed the ${w.name.toLowerCase()}.`, card);
    return post(db, T, `Thank you, the ${w.name.toLowerCase()} is signed.`, card);
  }
  if (/balance|owe|how much/.test(n)) {
    if (b <= 0) return post(db, T, "You are all paid up. Nothing is due.", balanceCard(db, f));
    db.pending[T] = { action: "pay", data: { familyId: f.id, cents: b, desc: `${monthName()} tuition` } };
    return post(db, T, `You owe ${money(b)} for ${monthName()}. Pay now?`, balanceCard(db, f), [{ label: `Pay ${money(b)} now`, send: "yes", tone: "primary" }, { label: "Not now", send: "no" }]);
  }
  if (/ticket/.test(n)) {
    const qty = parseInt(n.match(/\b(\d+)\b/)?.[1] ?? "2");
    db.pending[T] = { action: "tickets", data: { familyId: f.id, qty } };
    const r = db.recital;
    return post(db, T, `Buy ${qty} tickets to the ${r.name}?`, { kind: "confirm", title: `${r.name} tickets`, rows: [["Event", r.name], ["Date", fmtDate(r.date)], ["Time", `6pm · ${r.venue}`], ["Tickets", String(qty)], ["Amount", money(qty * r.ticketCents)]] }, [{ label: `Buy for ${money(qty * r.ticketCents)}`, send: "buy", tone: "primary" }, { label: "Cancel", send: "no" }]);
  }
  if (/^pay\b|pay now/.test(n)) {
    if (b <= 0) return post(db, T, "You are all paid up. Nothing is due.");
    const cents = amount(raw) ?? b;
    db.pending[T] = { action: "pay", data: { familyId: f.id, cents, desc: /tuition/.test(n) ? `${monthIn(raw)} tuition` : "Payment on account" } };
    return post(db, T, `Pay ${money(Math.min(cents, b))} with card ending ${f.cardLast4 ?? "on file"}?`, { kind: "confirm", title: "Confirm payment", rows: [["Amount", money(Math.min(cents, b))], ["Card", `ending ${f.cardLast4 ?? "on file"}`], ["Date", fmtDate(today())]] }, [{ label: "Yes, pay", send: "yes", tone: "primary" }, { label: "Cancel", send: "no" }]);
  }
  if (/trial/.test(n)) {
    const k = findClass(db, raw);
    const who = raw.match(/for\s+([A-Z][a-z]+)/)?.[1] ?? "your dancer";
    if (!k) return post(db, T, "Which class would you like to try? Here are our classes.", { kind: "roster", title: "Class schedule", rows: db.classes.map(c => [c.style, `${c.day} ${c.time} · ${inst(db, c.instructorId).name.split(" ")[0]}`] as Row) }, db.classes.slice(0, 4).map(c => ({ label: `${c.day} ${c.style}`, send: `Book a trial for ${who === "your dancer" ? (kids[0] ? first(kids[0]) : "my child") : who} in ${className(c)}` })));
    const date = nextDate(k.day);
    return newRequest(db, f, { type: "trial", studentName: who, toClassId: k.id, date, text: `Trial for ${who} in ${className(k)} on ${fmtDate(date)}` }, "Thanks! Your trial request is with the studio. You will get a confirmation here.", { kind: "request", title: "Trial class request", rows: [["Dancer", who], ["Class", k.style], ["Date", fmtDate(date)], ["Time", `${k.time} · ${k.room}`], ["Amount", "$15.00 trial fee"]] });
  }
  if (/switch|move to|change to/.test(n)) {
    const s = findStudent(db, raw, f.id) ?? kids[0]; const k = findClass(db, raw.replace(/switch|move/gi, ""));
    if (!s) return post(db, T, "Which dancer should switch?");
    if (!k || k.id === s.classId) return post(db, T, `Which class should ${first(s)} switch to?`, { kind: "roster", title: "Open classes", rows: db.classes.filter(c => c.id !== s.classId).map(c => [c.style, `${c.day} ${c.time}`] as Row) });
    return newRequest(db, f, { type: "switch", studentId: s.id, toClassId: k.id, text: `Switch ${first(s)} from ${className(kls(db, s.classId))} to ${className(k)}` }, `Got it. I asked the studio to move ${first(s)} to ${className(k)}.`, { kind: "request", title: "Class switch request", rows: [["Dancer", s.name], ["From", className(kls(db, s.classId))], ["To", className(k)], ["Amount", `${money(s.rateCents)} per month, no change`]] });
  }
  if (/cancel|miss|skip|absent/.test(n)) {
    const s = findStudent(db, raw, f.id) ?? kids[0]; if (!s) return post(db, T, "Which dancer?");
    const k = kls(db, s.classId), date = nextDate(k.day, /next week/.test(n) && nextDate(k.day) < (() => { const d = new Date(); d.setDate(d.getDate() + 7 - d.getDay()); return iso(d); })() ? 1 : 0);
    return newRequest(db, f, { type: "cancel", studentId: s.id, date, text: `Cancel ${first(s)}'s ${k.style} class on ${fmtDate(date)}` }, `Okay. I asked the studio to cancel ${first(s)}'s class.`, { kind: "request", title: "Cancel class request", rows: [["Dancer", s.name], ["Class", k.style], ["Date", fmtDate(date)], ["Time", `${k.time} · ${k.room}`], ["Amount", "No charge"]] });
  }
  return newRequest(db, f, { type: "question", text: raw.trim() }, "Thanks for your question. The studio will reply right here.", { kind: "request", title: "Question", rows: [["From", f.parentName], ["Question", raw.trim()]] });
}

export function handle(db: DB, thread: string, text: string) {
  if (!text.trim()) return;
  db.messages.push({ id: nid(db, "m"), thread, from: thread === "owner" ? "owner" : "parent", text: text.trim(), ts: new Date().toISOString() });
  if (thread === "owner") ownerCmd(db, text); else parentCmd(db, thread, text);
}
