import { DB, Card, Message, Family, Student, Klass } from "./types";
import { today } from "./seed";

const money = (c: number) => "$" + (c / 100).toFixed(2);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const monthName = () => new Date().toLocaleString("en-US", { month: "long" });
const id = (db: DB, p: string) => `${p}${++db.seq}`;

export function balance(db: DB, familyId: string) {
  return db.ledger.filter(l => l.familyId === familyId).reduce((s, l) => s + (l.type === "charge" ? l.amountCents : -l.amountCents), 0);
}
const fee = (db: DB, cents: number) => Math.round(cents * db.processor.ratePct / 100 + db.processor.fixedCents);
const className = (k: Klass) => `${k.day} ${k.time} ${k.style}`;

function post(db: DB, thread: string, from: Message["from"], text: string, card?: Card, buttons?: Message["buttons"]) {
  db.messages.push({ id: id(db, "m"), thread, from, text, card, buttons, ts: new Date().toISOString() });
}
const parentThread = (f: Family) => `parent:${f.id}`;

function findFamily(db: DB, t: string): Family | undefined {
  const n = norm(t);
  return db.families.find(f => new RegExp(`\\b${f.name.toLowerCase()}\\b`).test(n)) ||
    db.students.map(s => ({ s, first: s.name.split(" ")[0].toLowerCase() }))
      .filter(x => new RegExp(`\\b${x.first}\\b`).test(n)).map(x => db.families.find(f => f.id === x.s.familyId)).find(Boolean);
}
function findStudent(db: DB, t: string): Student | undefined {
  const n = norm(t);
  return db.students.find(s => n.includes(s.name.toLowerCase())) || db.students.find(s => new RegExp(`\\b${s.name.split(" ")[0].toLowerCase()}\\b`).test(n));
}
function findClass(db: DB, t: string): Klass | undefined {
  const n = norm(t).replace(/hip hop|hiphop/g, "hip hop");
  let best: Klass | undefined; let score = 0;
  for (const k of db.classes) {
    let s = 0;
    if (n.includes(k.day.toLowerCase())) s += 2;
    if (n.includes(k.style.toLowerCase())) s += 2;
    if (new RegExp(`\\b${k.time.replace("pm", "")}\\s?pm\\b`).test(n)) s += 1;
    if (s > score) { score = s; best = k; }
  }
  return score >= 2 ? best : undefined;
}
function parseClassSpec(t: string): Klass | undefined {
  const m = t.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2}(?::\d\d)?\s?[ap]m)\s+([a-z \-]+?)(?:,|$)/i);
  if (!m) return;
  const cap = (s: string) => s.replace(/-/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
  return { id: "", day: cap(m[1]), time: m[2].replace(/\s/g, "").toLowerCase(), style: cap(m[3]), instructor: "TBD" };
}

function studentCard(db: DB, s: Student): Card {
  const f = db.families.find(x => x.id === s.familyId)!; const k = db.classes.find(x => x.id === s.classId)!;
  return { kind: "student", title: `Student record · ${s.name}`, rows: [["Family", `${f.name} (${f.parentName})`], ["Class", className(k)], ["Tuition", `${money(s.rateCents)} per month`], ["Start", s.startDate], ["Card on file", f.cardLast4 ? `ending ${f.cardLast4}` : "none"], ["Family balance", money(balance(db, f.id))]] };
}
function balanceCard(db: DB, f: Family): Card {
  const items = db.ledger.filter(l => l.familyId === f.id).slice(-4).map(l => [`${l.date} ${l.description}`, (l.type === "charge" ? "+" : "paid ") + money(l.amountCents)] as [string, string]);
  return { kind: "balance", title: `${f.name} family balance`, rows: [...items, ["Balance due", money(balance(db, f.id))]] };
}

function charge(db: DB, f: Family, cents: number, desc: string, thread: string) {
  db.ledger.push({ id: id(db, "l"), familyId: f.id, type: "charge", amountCents: cents, description: desc, date: today(), thread });
}
function collect(db: DB, f: Family, cents: number, desc: string, by: "owner" | "parent") {
  const fe = fee(db, cents);
  db.ledger.push({ id: id(db, "l"), familyId: f.id, type: "payment", amountCents: cents, description: desc, date: today(), processor: db.processor.name, feeCents: fe, thread: by === "owner" ? "owner" : parentThread(f) });
  const card: Card = { kind: "payment", title: "Payment confirmation", rows: [["Family", f.name], ["Amount", money(cents)], ["For", desc], ["Method", f.cardLast4 ? `card ending ${f.cardLast4}` : "card"], ["Processor", db.processor.name + (db.processor.external ? " (your merchant)" : "")], ["Processing fee", money(fe)], ["Net to studio", money(cents - fe)], ["New balance", money(balance(db, f.id))]] };
  post(db, "owner", "system", `Payment of ${money(cents)} received from the ${f.name} family${by === "parent" ? " in their parent thread" : ""}.`, card);
  post(db, parentThread(f), "system", `Thank you! Your payment of ${money(cents)} is posted.`, card);
}

const HELP_OWNER: Card = { kind: "info", title: "Things you can ask", rows: [
  ["Enroll", "Enroll Emma Chen in Monday 5pm Ballet, start next week, $75/month, charge card ending 4242"],
  ["Tuition", "Post October tuition for all active students"], ["Charge", "Charge the Lopez family $85"],
  ["Check in", "Maya checked in for Hip Hop  /  Mark all present for Tuesday 4pm"],
  ["Report", "Show this month's revenue and outstanding balances  /  Show outstanding balances over $50"],
  ["Fees", "What did we pay in processing fees this month?"], ["Processor", "Use Square at 2.6% + 15c  /  Use Stripe"],
  ["Balance", "Lopez balance  /  Collect $85 from Lopez"], ["Roster", "Show roster for Tuesday 4pm Hip Hop"]] };

function ownerCmd(db: DB, raw: string) {
  const t = raw.trim(); const n = norm(t); const T = "owner";
  const pend = db.pending[T];
  if (pend && /^(yes|y|confirm|ok|yes confirm)\b/.test(n)) { db.pending[T] = undefined; return execPending(db, T, pend); }
  if (pend && /^(no|cancel|n)\b/.test(n)) { db.pending[T] = undefined; return post(db, T, "system", "Okay, cancelled. Nothing was changed."); }

  if (/^help|what can/.test(n)) return post(db, T, "system", "Here are the core commands.", HELP_OWNER);

  if (/^enroll\b/.test(n)) {
    const nm = t.match(/enroll\s+([A-Za-z']+\s+[A-Za-z']+)/i);
    if (!nm) return post(db, T, "system", "Who should I enroll? Try: Enroll Emma Chen in Monday 5pm Ballet, $75/month.");
    const name = nm[1].replace(/\b\w/g, c => c.toUpperCase());
    let k = findClass(db, t); const spec = !k ? parseClassSpec(t) : undefined;
    if (!k && !spec) return post(db, T, "system", "Which class? Include day, time and style, for example Monday 5pm Ballet.");
    const price = t.match(/\$\s?(\d+(?:\.\d\d)?)/); const rate = price ? Math.round(parseFloat(price[1]) * 100) : 7500;
    const card4 = t.match(/(?:ending|ends in|last four)\s*(\d{4})/i)?.[1];
    let start = today();
    if (/next week/i.test(t)) { const d = new Date(); d.setDate(d.getDate() + 7); start = d.toISOString().slice(0, 10); }
    const sm = t.match(/start(?:s|ing)?\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2}|\d{4}-\d\d-\d\d)/i); if (sm) start = sm[1];
    const chargeNow = /charge/i.test(t);
    const data = { name, classId: k?.id, newClass: spec, rate, card4, start, chargeNow };
    db.pending[T] = { action: "enroll", data };
    const last = name.split(" ")[1]; const fam = db.families.find(f => f.name.toLowerCase() === last.toLowerCase());
    return post(db, T, "system", `Confirm enroll?`, { kind: "student", title: `New enrollment · ${name}`, rows: [["Class", k ? className(k) : `${className(spec!)} (new class)`], ["Tuition", `${money(rate)} per month`], ["Start", start], ["Family", fam ? `${fam.name} (existing)` : `${last} (new family)`], ["Card", card4 ? `ending ${card4}` : fam?.cardLast4 ? `ending ${fam.cardLast4}` : "none"], ["First charge", chargeNow ? `${money(rate)} posted now` : "next tuition run"]] },
      [{ label: "Confirm enroll", send: "yes" }, { label: "Cancel", send: "no" }]);
  }

  if (/post .*tuition|run tuition|bill .*tuition/.test(n)) {
    const month = (t.match(/(january|february|march|april|may|june|july|august|september|october|november|december)/i)?.[1] ?? monthName()).replace(/^\w/, c => c.toUpperCase());
    const act = db.students.filter(s => s.active);
    const total = act.reduce((s, x) => s + x.rateCents, 0);
    db.pending[T] = { action: "tuition", data: { month } };
    return post(db, T, "system", `Post ${month} tuition for ${act.length} active students, ${money(total)} total?`, { kind: "report", title: `${month} tuition preview`, rows: act.map(s => [s.name, money(s.rateCents)] as [string, string]) }, [{ label: "Post tuition", send: "yes" }, { label: "Cancel", send: "no" }]);
  }

  if (/^(collect|take payment|charge card|run card)/.test(n) || /charge .*card on file/.test(n)) {
    const f = findFamily(db, t); if (!f) return post(db, T, "system", "Which family should I collect from?");
    const amt = t.match(/\$\s?(\d+(?:\.\d\d)?)/); const cents = amt ? Math.round(parseFloat(amt[1]) * 100) : balance(db, f.id);
    if (cents <= 0) return post(db, T, "system", `The ${f.name} family has no balance due.`, balanceCard(db, f));
    return collect(db, f, cents, "Payment on account", "owner");
  }

  if (/^charge\b/.test(n)) {
    const f = findFamily(db, t); const amt = t.match(/\$\s?(\d+(?:\.\d\d)?)/);
    if (!f || !amt) return post(db, T, "system", "Tell me the family and amount, for example: Charge the Lopez family $85.");
    const cents = Math.round(parseFloat(amt[1]) * 100); const desc = t.match(/\bfor\s+(.+)$/i)?.[1] ?? "Studio charge";
    charge(db, f, cents, desc, T);
    post(db, parentThread(f), "system", `A charge of ${money(cents)} for ${desc} was added to your account. Your balance is ${money(balance(db, f.id))}.`, balanceCard(db, f), [{ label: "Pay now", send: "pay now" }]);
    return post(db, T, "system", `Charged the ${f.name} family ${money(cents)}. Posted to their account and shared in their thread.`, balanceCard(db, f), f.cardLast4 ? [{ label: `Collect ${money(balance(db, f.id))} from card ${f.cardLast4}`, send: `collect from ${f.name}` }] : undefined);
  }

  if (/mark all present/.test(n)) {
    const k = findClass(db, t) ?? db.classes.find(c => n.includes(c.day.toLowerCase()) && n.includes(c.time.replace("pm", "")));
    if (!k) return post(db, T, "system", "Which class? For example: Mark all present for Tuesday 4pm.");
    const ss = db.students.filter(s => s.classId === k.id && s.active);
    ss.forEach(s => db.attendance.push({ id: id(db, "a"), studentId: s.id, classId: k.id, date: today() }));
    return post(db, T, "system", `Marked ${ss.length} present for ${className(k)}.`, { kind: "roster", title: `Attendance · ${className(k)} · ${today()}`, rows: ss.map(s => [s.name, "present"] as [string, string]) });
  }
  if (/checked in|check in/.test(n)) {
    const s = findStudent(db, t); if (!s) return post(db, T, "system", "I could not find that student.");
    const k = db.classes.find(c => c.id === s.classId)!;
    db.attendance.push({ id: id(db, "a"), studentId: s.id, classId: k.id, date: today() });
    const count = db.attendance.filter(a => a.studentId === s.id).length;
    return post(db, T, "system", `${s.name} is checked in for ${className(k)}.`, { kind: "roster", title: "Check in", rows: [["Student", s.name], ["Class", className(k)], ["Date", today()], ["Classes attended", String(count)]] });
  }

  if (/processing fee|fees/.test(n)) {
    const pays = db.ledger.filter(l => l.type === "payment" && l.date.slice(0, 7) === today().slice(0, 7));
    const tot = pays.reduce((s, l) => s + (l.feeCents ?? 0), 0); const gross = pays.reduce((s, l) => s + l.amountCents, 0);
    const byProc: Record<string, number> = {}; pays.forEach(p => byProc[p.processor ?? "?"] = (byProc[p.processor ?? "?"] ?? 0) + (p.feeCents ?? 0));
    return post(db, T, "system", `This month you paid ${money(tot)} in processing fees on ${money(gross)} collected.`, { kind: "report", title: "Processing fees this month", rows: [["Payments", String(pays.length)], ["Collected", money(gross)], ...Object.entries(byProc).map(([k, v]) => [`Fees via ${k}`, money(v)] as [string, string]), ["Effective rate", gross ? (tot / gross * 100).toFixed(2) + "%" : "n/a"], ["Current processor", `${db.processor.name} at ${db.processor.ratePct}% + ${db.processor.fixedCents}c`]] });
  }

  if (/^(use|switch to|set processor|processor)\b/.test(n) || /as (our )?processor/.test(n)) {
    const pm = t.match(/(?:use|switch to|processor(?: to| is)?)\s+([A-Za-z][\w ]*?)(?:\s+(?:at|as|with)\b|$)/i);
    const name = (pm?.[1] ?? "").trim(); if (!name) return post(db, T, "system", `Current processor is ${db.processor.name}. Say: Use Square at 2.6% + 15c.`);
    const rate = t.match(/(\d+(?:\.\d+)?)\s?%/); const fixed = t.match(/\+\s?(\d+)\s?c/i) ?? t.match(/\+\s?\$0?\.(\d\d)/);
    const isStripe = /^stripe$/i.test(name);
    db.processor = { name: name.replace(/^\w/, c => c.toUpperCase()), ratePct: rate ? parseFloat(rate[1]) : isStripe ? 2.9 : db.processor.ratePct, fixedCents: fixed ? parseInt(fixed[1]) : isStripe ? 30 : db.processor.fixedCents, external: !isStripe };
    return post(db, T, "system", `Noted. New payments will run through ${db.processor.name}. Family accounts and parent payment links keep working the same way.`, { kind: "info", title: "Payment processor", rows: [["Processor", db.processor.name], ["Type", db.processor.external ? "Bring your own merchant" : "Default (published rates)"], ["Rate", `${db.processor.ratePct}% + ${db.processor.fixedCents}c per charge`]] });
  }

  if (/revenue|outstanding|report|who owes/.test(n)) {
    const over = t.match(/over\s+\$?(\d+)/i); const min = over ? parseInt(over[1]) * 100 : 1;
    const owing = db.families.map(f => ({ f, b: balance(db, f.id) })).filter(x => x.b >= min).sort((a, b) => b.b - a.b);
    const pays = db.ledger.filter(l => l.type === "payment" && l.date.slice(0, 7) === today().slice(0, 7));
    const charges = db.ledger.filter(l => l.type === "charge" && l.date.slice(0, 7) === today().slice(0, 7));
    const rev = pays.reduce((s, l) => s + l.amountCents, 0); const fees = pays.reduce((s, l) => s + (l.feeCents ?? 0), 0);
    const outTotal = owing.reduce((s, x) => s + x.b, 0);
    const rows: [string, string][] = over ? [] : [["Billed this month", money(charges.reduce((s, l) => s + l.amountCents, 0))], ["Collected this month", money(rev)], ["Processing fees", money(fees)], ["Net revenue", money(rev - fees)]];
    rows.push(["Outstanding total", money(outTotal)], ...owing.map(x => [`${x.f.name} family`, money(x.b)] as [string, string]));
    return post(db, T, "system", over ? `${owing.length} families owe more than ${money(min)}.` : `Here is ${monthName()} so far.`, { kind: "report", title: over ? `Balances over ${money(min)}` : `${monthName()} revenue and outstanding`, rows },
      owing.filter(x => x.f.cardLast4).map(x => ({ label: `Charge ${x.f.name} ${money(x.b)}`, send: `collect from ${x.f.name}` })));
  }

  if (/roster/.test(n)) {
    const k = findClass(db, t); if (!k) return post(db, T, "system", "Which class roster?");
    return post(db, T, "system", `${className(k)} with ${k.instructor}.`, { kind: "roster", title: `Roster · ${className(k)}`, rows: db.students.filter(s => s.classId === k.id).map(s => [s.name, money(s.rateCents)] as [string, string]) });
  }
  if (/balance/.test(n)) {
    const f = findFamily(db, t); if (!f) return post(db, T, "system", "Which family?");
    return post(db, T, "system", `The ${f.name} family owes ${money(balance(db, f.id))}.`, balanceCard(db, f));
  }
  const s = findStudent(db, t);
  if (s) return post(db, T, "system", `Here is ${s.name}.`, studentCard(db, s));
  return post(db, T, "system", "I did not catch that. Type help for examples.");
}

function execPending(db: DB, T: string, p: { action: string; data: any }) {
  if (p.action === "enroll") {
    const d = p.data; const [first, last] = d.name.split(" ");
    let f = db.families.find(x => x.name.toLowerCase() === last.toLowerCase());
    if (!f) { f = { id: id(db, "fam_"), name: last, parentName: `${last} family`, cardLast4: d.card4 }; db.families.push(f); }
    if (d.card4) f.cardLast4 = d.card4;
    let classId = d.classId; if (!classId) { const k = { ...d.newClass, id: id(db, "c_") }; db.classes.push(k); classId = k.id; }
    const s: Student = { id: id(db, "s_"), name: `${first} ${last}`, familyId: f.id, classId, rateCents: d.rate, startDate: d.start, active: true };
    db.students.push(s);
    const k = db.classes.find(c => c.id === classId)!;
    if (d.chargeNow) charge(db, f, d.rate, `${monthName()} tuition for ${first}`, T);
    post(db, T, "system", `${s.name} is enrolled in ${className(k)} and added to the roster.${d.chargeNow ? ` First charge of ${money(d.rate)} posted.` : ""} The ${f.name} family thread was notified.`, studentCard(db, s));
    const bal = balance(db, f.id);
    return post(db, parentThread(f), "system", `${first} is enrolled in ${className(k)} starting ${d.start}. Tuition is ${money(d.rate)} per month.${bal > 0 ? ` You owe ${money(bal)}.` : ""}`, studentCard(db, s), bal > 0 ? [{ label: "Pay now", send: "pay now" }] : undefined);
  }
  if (p.action === "tuition") {
    const act = db.students.filter(s => s.active); let total = 0;
    for (const s of act) { const f = db.families.find(x => x.id === s.familyId)!; charge(db, f, s.rateCents, `${p.data.month} tuition for ${s.name.split(" ")[0]}`, T); total += s.rateCents; }
    for (const f of db.families) if (act.some(s => s.familyId === f.id)) post(db, parentThread(f), "system", `${p.data.month} tuition is posted. Your balance is ${money(balance(db, f.id))}.`, balanceCard(db, f), [{ label: "Pay now", send: "pay now" }]);
    return post(db, T, "system", `Posted ${p.data.month} tuition: ${act.length} charges, ${money(total)} total. Each family was notified in their thread.`, { kind: "report", title: `${p.data.month} tuition posted`, rows: [["Charges", String(act.length)], ["Total billed", money(total)], ["Outstanding now", money(db.families.reduce((s, f) => s + Math.max(0, balance(db, f.id)), 0))]] });
  }
  if (p.action === "pay") {
    const f = db.families.find(x => x.id === p.data.familyId)!; const b = balance(db, f.id);
    if (b <= 0) return post(db, T, "system", "You are all paid up.");
    return collect(db, f, Math.min(p.data.cents, b), p.data.desc, "parent");
  }
}

function parentCmd(db: DB, T: string, raw: string) {
  const f = db.families.find(x => parentThread(x) === T)!; const n = norm(raw);
  const pend = db.pending[T]; const b = balance(db, f.id);
  if (pend && /^(yes|y|confirm|ok|pay now)\b/.test(n)) { db.pending[T] = undefined; return execPending(db, T, pend); }
  if (pend && /^(no|cancel|not now|n)\b/.test(n)) { db.pending[T] = undefined; return post(db, T, "system", "No problem. Your balance stays as is."); }
  if (/balance|owe|how much/.test(n)) {
    if (b <= 0) return post(db, T, "system", "You are all paid up. Nothing is due.", balanceCard(db, f));
    db.pending[T] = { action: "pay", data: { familyId: f.id, cents: b, desc: `${monthName()} tuition` } };
    return post(db, T, "system", `You owe ${money(b)} for ${monthName()}. Pay now?`, balanceCard(db, f), [{ label: `Pay ${money(b)} now`, send: "yes" }, { label: "Not now", send: "no" }]);
  }
  if (/^pay|pay now/.test(n)) {
    if (b <= 0) return post(db, T, "system", "You are all paid up. Nothing is due.");
    const amt = raw.match(/\$\s?(\d+(?:\.\d\d)?)/); const cents = amt ? Math.round(parseFloat(amt[1]) * 100) : b;
    db.pending[T] = { action: "pay", data: { familyId: f.id, cents, desc: /tuition/.test(n) ? `${monthName()} tuition` : "Payment on account" } };
    return post(db, T, "system", `Pay ${money(Math.min(cents, b))} with card ending ${f.cardLast4 ?? "on file"}?`, undefined, [{ label: "Yes, pay", send: "yes" }, { label: "Cancel", send: "no" }]);
  }
  if (/switch|move|cancel/.test(n)) {
    post(db, "owner", "system", `Request from the ${f.name} family: "${raw}"`, undefined, undefined);
    return post(db, T, "system", "Got it. I sent your request to the studio and they will confirm here.");
  }
  return post(db, T, "system", "You can ask what's my balance, pay tuition, or ask to switch or cancel a class.");
}

export function handle(db: DB, thread: string, text: string) {
  if (!text.trim()) return;
  post(db, thread, thread === "owner" ? "owner" : "parent", text.trim());
  if (thread === "owner") ownerCmd(db, text); else parentCmd(db, thread, text);
}
