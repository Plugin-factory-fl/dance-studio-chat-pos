import { DB, Family, Student, Card, Row, Button, ImportRow, Klass } from "./types";
import { catFor, post, nid, fam, kls, first, cap, norm, money, fmtDate, balance, charge, balanceCard, payBtn, parentThread, className, spots, findFamily, findClass, findStudent, monthName, hooks, moveClass, perClass, inst } from "./engine";
import { today, setDemoDate, nowDate, isoOf } from "./clock";
import { BILLING, SEASONS, REG_FEES, WAITLIST_HOLD_HOURS, CLOSURE_POLICY, TRIAL_FEE_CENTS } from "./policy";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const d0 = (iso: string) => new Date(iso + "T12:00:00");
const addDays = (iso: string, n: number) => { const d = d0(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const ymName = (ym: string) => `${cap(MONTHS[parseInt(ym.slice(5)) - 1])} ${ym.slice(0, 4)}`;
export const seasonFor = (iso: string) => SEASONS.find(s => iso >= s.start && iso <= s.end);
const classesOf = (db: DB, s: Student) => [s.classId, ...(s.extraClassIds ?? [])].map(id => kls(db, id)).filter(Boolean) as Klass[];
const meetingsIn = (k: Klass, ym: string) => { let n = 0; const [y, m] = ym.split("-").map(Number); for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) if (DAYS[d.getDay()] === k.day) n++; return n; };
const model = (db: DB) => (db.billingModel ?? BILLING.model) as typeof BILLING.model;

// ---------- tuition ----------
export function tuitionLines(db: DB, f: Family, ym: string) {
  const kids = db.students.filter(s => s.familyId === f.id && s.active && !s.paused);
  const priced = kids.map(s => {
    const cs = classesOf(db, s), hours = cs.reduce((a, k) => a + k.hours, 0);
    let base = 0, how = "";
    if (model(db) === "rateTable") { const r = BILLING.rateTable.find(t => hours <= t.maxHours)!; base = r.cents; how = `${hours} hrs weekly rate`; }
    else if (model(db) === "perClass") { const n = cs.reduce((a, k) => a + meetingsIn(k, ym), 0); base = n * BILLING.perClassCents; how = `${n} classes at ${money(BILLING.perClassCents)}`; }
    else { base = s.rateCents + cs.slice(1).reduce((a, k) => a + k.priceCents, 0); how = cs.map(k => k.style).join(" and "); }
    return { s, cs, base, how };
  }).sort((a, b) => b.base - a.base);
  const lines: { desc: string; cents: number; category: string; studentId?: string }[] = [];
  priced.forEach((p, i) => {
    lines.push({ desc: `${ymName(ym).split(" ")[0]} tuition for ${first(p.s)} (${p.how})`, cents: p.base, category: "Tuition", studentId: p.s.id });
    if (p.cs.length > 1 && BILLING.multiClassDiscountPct) lines.push({ desc: `Multi class discount ${BILLING.multiClassDiscountPct}% for ${first(p.s)}`, cents: -Math.round(p.base * BILLING.multiClassDiscountPct / 100), category: "Discount", studentId: p.s.id });
    if (i > 0 && BILLING.siblingDiscountPct) lines.push({ desc: `Sibling discount ${BILLING.siblingDiscountPct}% for ${first(p.s)}`, cents: -Math.round(p.base * BILLING.siblingDiscountPct / 100), category: "Discount", studentId: p.s.id });
  });
  const season = seasonFor(`${ym}-01`);
  if (season && kids.length) {
    if (!db.regCharged.includes(`${season.id}:${f.id}`) && REG_FEES.perFamilyPerSeasonCents) lines.push({ desc: `${season.name} registration fee, family`, cents: REG_FEES.perFamilyPerSeasonCents, category: "Registration" });
    kids.filter(s => !db.regCharged.includes(`${season.id}:${s.id}`)).forEach(s => REG_FEES.perStudentPerSeasonCents && lines.push({ desc: `${season.name} registration fee, ${first(s)}`, cents: REG_FEES.perStudentPerSeasonCents, category: "Registration", studentId: s.id }));
  }
  return { lines, total: lines.reduce((a, l) => a + l.cents, 0), season };
}
const parseYm = (n: string) => { const m = n.match(new RegExp(`\\b(${MONTHS.join("|")})\\b(?:\\s+(\\d{4}))?`)); const t = today(); if (!m) { const d = d0(t); d.setMonth(d.getMonth() + 1, 1); return isoOf(d).slice(0, 7); } const mi = MONTHS.indexOf(m[1]) + 1; let y = m[2] ? parseInt(m[2]) : parseInt(t.slice(0, 4)); if (!m[2] && mi < parseInt(t.slice(5, 7)) - 2) y++; return `${y}-${String(mi).padStart(2, "0")}`; };

export function billingPreview(db: DB, ym: string) {
  if (db.billedMonths.includes(ym)) return post(db, "owner", `${ymName(ym)} billing already ran.`);
  const rows = db.families.map(f => ({ f, ...tuitionLines(db, f, ym) })).filter(r => r.lines.length);
  const total = rows.reduce((a, r) => a + r.total, 0), due = `${ym}-${String(BILLING.dueDay).padStart(2, "0")}`;
  return post(db, "owner", `Billing preview for ${ymName(ym)}: ${rows.length} families, ${money(total)} total. Due ${fmtDate(due)}, late fee of ${money(BILLING.lateFeeCents)} after ${BILLING.graceDays} days.`, {
    kind: "report", title: `Billing run · ${ymName(ym)}`, subtitle: `Model: ${model(db) === "rateTable" ? "rate table by weekly hours" : model(db) === "perClass" ? "flat per class" : "each dancer's rate"} · sibling ${BILLING.siblingDiscountPct}% · multi class ${BILLING.multiClassDiscountPct}%`, badge: { text: "Preview", tone: "warn" }, rows: [],
    sections: rows.map(r => ({ heading: `${r.f.name} family · ${money(r.total)}`, rows: r.lines.map(l => [l.desc, money(l.cents), l.cents < 0 ? "good" : undefined].filter(Boolean) as Row) })), footer: `Total ${money(total)}` },
    [{ label: `Post ${ymName(ym)} billing`, send: `confirm billing ${ym}`, tone: "primary" }, { label: "Cancel", send: "no" }]);
}
export function runBilling(db: DB, ym: string, auto = false) {
  if (db.billedMonths.includes(ym)) return { families: 0, total: 0 };
  const due = `${ym}-${String(BILLING.dueDay).padStart(2, "0")}`; let total = 0, families = 0;
  for (const f of db.families) {
    const { lines, total: t, season } = tuitionLines(db, f, ym); if (!lines.length) continue;
    families++; total += t;
    for (const l of lines) {
      if (l.cents < 0) db.ledger.push({ id: nid(db, "l"), familyId: f.id, type: "credit", amountCents: -l.cents, description: l.desc, date: today(), thread: "owner", category: "Discount", dueDate: due });
      else charge(db, f, l.cents, l.desc, "owner", { category: l.category, dueDate: due, season: season?.id });
    }
    if (season) { if (lines.some(l => l.category === "Registration" && !l.studentId)) db.regCharged.push(`${season.id}:${f.id}`); lines.filter(l => l.category === "Registration" && l.studentId).forEach(l => db.regCharged.push(`${season.id}:${l.studentId}`)); }
    post(db, parentThread(f), `${ymName(ym)} statement is ready. ${money(t)} is due ${fmtDate(due)}.${f.plan && f.plan !== "monthly" ? "" : " Autopay will charge your card on file."}`, { kind: "balance", title: `${ymName(ym)} charges`, subtitle: `Due ${fmtDate(due)} · late fee ${money(BILLING.lateFeeCents)} after ${BILLING.graceDays} days`, rows: [...lines.map(l => [l.desc, money(l.cents), l.cents < 0 ? "good" : undefined].filter(Boolean) as Row), ["Balance due", money(balance(db, f.id)), "warn"]] },
      [...payBtn(db, f), { label: "Download statement", send: "statement", action: `pdf:${f.id}` }]);
  }
  db.billedMonths.push(ym);
  post(db, "owner", `${auto ? "Scheduled billing ran on the 1st. " : ""}${ymName(ym)} billing posted: ${families} families, ${money(total)} total, due ${fmtDate(due)}. Each family got their charges in their thread.`, { kind: "report", title: `${ymName(ym)} billing posted`, badge: { text: auto ? "Auto posted" : "Posted", tone: "good" }, rows: [["Families", String(families)], ["Total billed", money(total)], ["Due date", fmtDate(due)], ["Late fee", `${money(BILLING.lateFeeCents)} after ${fmtDate(addDays(due, BILLING.graceDays))}`]] },
    [{ label: "Statements for all families", send: "statements", action: "pdf:all" }], true);
  return { families, total };
}
export function applyLateFees(db: DB) {
  const t = today(), hit: string[] = [];
  for (const ym of db.billedMonths) {
    const due = `${ym}-${String(BILLING.dueDay).padStart(2, "0")}`; if (t <= addDays(due, BILLING.graceDays)) continue;
    for (const f of db.families) {
      const key = `${ym}:${f.id}`; if (db.lateFees.includes(key)) continue;
      const billed = db.ledger.some(l => l.familyId === f.id && l.dueDate === due && l.type === "charge"); if (!billed || balance(db, f.id) <= 0) continue;
      db.lateFees.push(key); charge(db, f, BILLING.lateFeeCents, `Late fee, ${ymName(ym)} balance unpaid after ${BILLING.graceDays} days`, "owner", { category: "Late fee" });
      post(db, parentThread(f), `A ${money(BILLING.lateFeeCents)} late fee was added because the ${ymName(ym)} balance was not paid by ${fmtDate(addDays(due, BILLING.graceDays))}.`, balanceCard(db, f), payBtn(db, f));
      hit.push(f.name);
    }
  }
  return hit;
}
export function advanceTo(db: DB, target: string) {
  const start = today(); if (target <= start) return post(db, "owner", `The demo date is already ${fmtDate(start)}. Pick a later date.`);
  const events: Row[] = [];
  for (let d = addDays(start, 1); d <= target; d = addDays(d, 1)) {
    db.demoDate = d; setDemoDate(d);
    if (d.endsWith(`-${String(BILLING.dueDay).padStart(2, "0")}`) && BILLING.autoPostOnFirst && !db.billedMonths.includes(d.slice(0, 7))) { const r = runBilling(db, d.slice(0, 7), true); events.push([fmtDate(d), `Tuition auto posted, ${r.families} families, ${money(r.total)}`]); }
    const late = applyLateFees(db); if (late.length) events.push([fmtDate(d), `Late fees applied: ${late.join(", ")}`]);
    const exp = expireOffers(db); if (exp.length) events.push([fmtDate(d), `Waitlist holds expired: ${exp.join(", ")}`]);
    db.closures.filter(c => c.start === d).forEach(c => events.push([fmtDate(d), `Studio closed for ${c.name}`]));
  }
  return post(db, "owner", `Demo date moved from ${fmtDate(start)} to ${fmtDate(target)}.`, { kind: "info", title: "Demo date advanced", subtitle: `Today is now ${fmtDate(target)}`, badge: { text: `${events.length} events`, tone: events.length ? "warn" : "good" }, rows: events.length ? events : [["Nothing scheduled", "No billing, late fees or holds in that range"]] });
}

// ---------- categories ----------
export function categoryReport(db: DB) {
  const ym = today().slice(0, 7), by: Record<string, number> = {};
  db.ledger.filter(l => l.date.startsWith(ym)).forEach(l => { const c = l.type === "payment" ? "Payment" : l.category ?? (l.type === "credit" ? "Credit" : catFor(l.description)); by[c] = (by[c] ?? 0) + l.amountCents; });
  return post(db, "owner", `Here is ${monthName()} by transaction category.`, { kind: "report", title: `${monthName()} by category`, rows: Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, money(v), k === "Payment" ? "good" : undefined].filter(Boolean) as Row) });
}

// ---------- statements ----------
export function statementCard(db: DB, f: Family): Card {
  const items = db.ledger.filter(l => l.familyId === f.id).slice(-8);
  return { kind: "balance", title: `Statement · ${f.name} family`, subtitle: `As of ${fmtDate(today())}`, badge: { text: balance(db, f.id) > 0 ? `${money(balance(db, f.id))} due` : "Paid up", tone: balance(db, f.id) > 0 ? "warn" : "good" }, rows: [...items.map(l => [`${fmtDate(l.date)} · ${l.type === "payment" ? "Payment" : l.category ?? (l.type === "credit" ? "Credit" : catFor(l.description))} · ${l.description}`, (l.type === "charge" ? "" : "minus ") + money(l.amountCents)] as Row), ["Balance due", money(balance(db, f.id)), "warn"]] };
}
export function statementCmd(db: DB, thread: string, f?: Family, all = false) {
  if (all) { const owe = db.families.filter(x => balance(db, x.id) > 0); return post(db, thread, `Statements are ready for all ${db.families.length} families, ${owe.length} with a balance.`, { kind: "report", title: "Statements", rows: db.families.map(x => [`${x.name} family`, money(balance(db, x.id)), balance(db, x.id) > 0 ? "warn" : "good"] as Row) }, [{ label: "Download all statements (PDF)", send: "statements", action: "pdf:all", tone: "primary" }, { label: "Only families with a balance", send: "statements", action: "pdf:balance" }], true); }
  if (!f) return post(db, thread, "Which family?");
  return post(db, thread, `Statement for the ${f.name} family.`, statementCard(db, f), [{ label: "Download PDF statement", send: "statement", action: `pdf:${f.id}`, tone: "primary" }, { label: "Download invoice", send: "invoice", action: `invoice:${f.id}` }], true);
}

// ---------- waitlist ----------
const position = (db: DB, w: { id: string; classId: string }) => db.waitlist.filter(x => x.classId === w.classId && x.status === "waiting").findIndex(x => x.id === w.id) + 1;
export function joinWaitlist(db: DB, f: Family, classId: string, raw: string) {
  const k = kls(db, classId); if (!k) return post(db, parentThread(f), "Which class?");
  const s = findStudent(db, raw, f.id); const name = s?.name ?? (raw.match(/for\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)?.[1] ?? "Your dancer");
  if (db.waitlist.some(w => w.classId === classId && w.familyId === f.id && w.studentName === name && ["waiting", "offered"].includes(w.status))) return post(db, parentThread(f), `${first({ name } as Student)} is already on the ${k.style} waitlist.`);
  const w = { id: nid(db, "wl"), classId, familyId: f.id, studentId: s?.id, studentName: name, age: s?.age ?? 8, status: "waiting" as const, added: today() };
  db.waitlist.push(w);
  const card: Card = { kind: "roster", title: "Waitlist", subtitle: className(k), badge: { text: `Number ${position(db, w)} in line`, tone: "warn" }, rows: [["Dancer", name], ["Class", className(k)], ["Hold when offered", `${WAITLIST_HOLD_HOURS} hours`]] };
  post(db, "owner", `${f.parentName} added ${name} to the ${className(k)} waitlist (number ${position(db, w)}).`, { ...card, kind: "message" });
  if (spots(db, k) > 0) offerNext(db, classId);
  return post(db, parentThread(f), `You are on the waitlist, number ${position(db, w) || 1} in line. When a spot opens you will get an offer right here.`, card);
}
export function offerNext(db: DB, classId: string) {
  const k = kls(db, classId); if (!k || spots(db, k) - db.waitlist.filter(w => w.classId === classId && w.status === "offered").length <= 0) return;
  const w = db.waitlist.find(x => x.classId === classId && x.status === "waiting"); if (!w) return;
  const f = fam(db, w.familyId); w.status = "offered"; w.holdUntil = addDays(today(), Math.ceil(WAITLIST_HOLD_HOURS / 24));
  const card: Card = { kind: "confirm", title: "A spot opened up!", subtitle: className(k), badge: { text: `Held until ${fmtDate(w.holdUntil)}`, tone: "warn" }, rows: [["Dancer", w.studentName], ["Class", `${k.style} · ${k.level}`], ["Day and time", `${k.day} ${k.time} · ${k.room}`], ["Instructor", inst(db, k.instructorId).name], ["Amount", `${money(k.priceCents)} per month`], ["Hold", `${WAITLIST_HOLD_HOURS} hours, until ${fmtDate(w.holdUntil)}`]] };
  const m = post(db, parentThread(f), `Good news! A spot opened in ${className(k)} for ${w.studentName.split(" ")[0]}. It is held for you for ${WAITLIST_HOLD_HOURS} hours.`, card, [{ label: "Accept spot", send: `accept waitlist ${w.id}`, tone: "primary" }, { label: "No thanks", send: `decline waitlist ${w.id}` }], true);
  w.msgId = m.id;
  post(db, "owner", `Spot opened in ${className(k)}. Offered to the ${f.name} family for ${w.studentName}, held until ${fmtDate(w.holdUntil)}.`, { ...card, kind: "message", title: "Waitlist offer sent", badge: { text: "Auto offered", tone: "muted" } });
}
export function respondWaitlist(db: DB, f: Family, id: string, accept: boolean) {
  const w = db.waitlist.find(x => x.id === id && x.familyId === f.id); const T = parentThread(f);
  if (!w || w.status !== "offered") return post(db, T, "That offer is no longer open.");
  const m = db.messages.find(x => x.id === w.msgId); if (m) m.buttons = undefined;
  const k = kls(db, w.classId);
  if (!accept) { w.status = "declined"; post(db, "owner", `The ${f.name} family declined the ${className(k)} spot.`); post(db, T, "No problem, we released the spot."); return offerNext(db, w.classId); }
  w.status = "accepted";
  let s = w.studentId ? db.students.find(x => x.id === w.studentId) : undefined;
  if (s) moveClass(db, s, k.id);
  else { s = { id: nid(db, "s_"), name: w.studentName.includes(" ") ? w.studentName : `${w.studentName} ${f.name}`, familyId: f.id, classId: k.id, rateCents: k.priceCents, startDate: today(), active: true, size: "Child M", age: w.age }; db.students.push(s); }
  const card: Card = { kind: "confirm", title: "Spot confirmed", badge: { text: "Enrolled", tone: "good" }, rows: [["Dancer", s.name], ["Class", k.style], ["Date", `Starts ${fmtDate(nextMeeting(k))}`], ["Time", `${k.day} ${k.time} · ${k.room}`], ["Amount", `${money(k.priceCents)} per month, billed on the next run`]] };
  post(db, "owner", `The ${f.name} family accepted the ${className(k)} spot. ${s.name} is on the roster.`, { ...card, kind: "message", badge: { text: "Done automatically", tone: "muted" } });
  return post(db, T, `${first(s)} is in! See you ${fmtDate(nextMeeting(k))}.`, card);
}
const nextMeeting = (k: Klass) => { for (let i = 1; i <= 7; i++) { const d = addDays(today(), i); if (DAYS[d0(d).getDay()] === k.day) return d; } return today(); };
export function expireOffers(db: DB) {
  const out: string[] = [];
  db.waitlist.filter(w => w.status === "offered" && w.holdUntil && w.holdUntil < today()).forEach(w => { w.status = "expired"; const f = fam(db, w.familyId); const m = db.messages.find(x => x.id === w.msgId); if (m) m.buttons = undefined; post(db, parentThread(f), `Your hold on the ${kls(db, w.classId).style} spot expired, so we offered it to the next family. Ask to rejoin the waitlist any time.`); out.push(f.name); offerNext(db, w.classId); });
  return out;
}
export function waitlistCard(db: DB) {
  const act = db.waitlist.filter(w => ["waiting", "offered"].includes(w.status));
  return post(db, "owner", act.length ? `${act.length} on waitlists.` : "No one is waiting.", { kind: "roster", title: "Waitlists", rows: [], sections: [...new Set(act.map(w => w.classId))].map(c => ({ heading: `${className(kls(db, c))} · ${spots(db, kls(db, c))} open`, rows: act.filter(w => w.classId === c).map(w => [`${w.studentName} · ${fam(db, w.familyId).name}`, w.status === "offered" ? `Offered, held until ${fmtDate(w.holdUntil!)}` : `Waiting since ${fmtDate(w.added)}`, w.status === "offered" ? "warn" : undefined].filter(Boolean) as Row) })) });
}
hooks.spotOpened = (db, classId) => offerNext(db, classId);
hooks.owner = opsOwner; hooks.parent = opsParent; hooks.signup = signupStep;

// ---------- closures ----------
export function parseClosure(t: string) {
  const n = norm(t); const m = n.match(new RegExp(`(${MONTHS.join("|")}|${MONTHS.map(x => x.slice(0, 3)).join("|")})\\s+(\\d{1,2})(?:\\s*(?:to|through|thru|and|until)\\s*(?:(${MONTHS.join("|")}|${MONTHS.map(x => x.slice(0, 3)).join("|")})\\s+)?(\\d{1,2}))?`));
  if (!m) return;
  const mi = (s: string) => MONTHS.findIndex(x => x.startsWith(s)) + 1; const t0 = today(); let y = parseInt(t0.slice(0, 4));
  const m1 = mi(m[1]); if (m1 < parseInt(t0.slice(5, 7)) - 1) y++;
  const start = `${y}-${String(m1).padStart(2, "0")}-${m[2].padStart(2, "0")}`, m2 = m[3] ? mi(m[3]) : m1;
  const end = m[4] ? `${m2 < m1 ? y + 1 : y}-${String(m2).padStart(2, "0")}-${m[4].padStart(2, "0")}` : start;
  const name = cap(t.match(/\bfor\s+(?:the\s+)?([A-Za-z ']+?)\s*\.?$/i)?.[1] ?? "Studio closure");
  return { start, end, name };
}
function closureImpact(db: DB, start: string, end: string) {
  const hits: { s: Student; k: Klass; date: string; credit: number }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) for (const s of db.students.filter(x => x.active && !x.paused)) for (const k of classesOf(db, s)) if (DAYS[d0(d).getDay()] === k.day) hits.push({ s, k, date: d, credit: CLOSURE_POLICY.creditClosures ? perClass(s) : 0 });
  return hits;
}
export function closurePreview(db: DB, t: string) {
  const c = parseClosure(t); if (!c) return post(db, "owner", "Which dates? For example: Close studio Nov 26 to 28 for Thanksgiving.");
  const hits = closureImpact(db, c.start, c.end), fams = new Set(hits.map(h => h.s.familyId)), credit = hits.reduce((a, h) => a + h.credit, 0);
  const classes = [...new Set(hits.map(h => `${fmtDate(h.date)} · ${className(h.k)}`))];
  return post(db, "owner", `Closing ${fmtDate(c.start)}${c.end !== c.start ? ` to ${fmtDate(c.end)}` : ""} for ${c.name} cancels ${classes.length} classes for ${fams.size} families.`, { kind: "confirm", title: `Closure · ${c.name}`, subtitle: `${fmtDate(c.start)}${c.end !== c.start ? ` to ${fmtDate(c.end)}` : ""}`, badge: { text: "Needs confirm", tone: "warn" }, rows: [...classes.map(x => ["Cancelled", x] as Row), ["Dancers affected", String(new Set(hits.map(h => h.s.id)).size)], ["Credit applied", CLOSURE_POLICY.creditClosures ? money(credit) : "None per policy", "good"]], footer: CLOSURE_POLICY.note },
    [{ label: "Close and notify families", send: `confirm closure ${c.start} ${c.end} ${c.name}`, tone: "primary" }, { label: "Cancel", send: "no" }]);
}
export function confirmClosure(db: DB, start: string, end: string, name: string) {
  if (db.closures.some(c => c.start === start && c.end === end)) return post(db, "owner", "That closure is already on the calendar.");
  const hits = closureImpact(db, start, end), credit = hits.reduce((a, h) => a + h.credit, 0);
  db.closures.push({ id: nid(db, "cl"), name, start, end, creditCents: credit });
  hits.forEach(h => db.cancellations.push({ id: nid(db, "x"), studentId: h.s.id, classId: h.k.id, date: h.date, creditCents: h.credit }));
  const byFam: Record<string, typeof hits> = {}; hits.forEach(h => (byFam[h.s.familyId] ??= []).push(h));
  for (const [fid, hs] of Object.entries(byFam)) {
    const f = fam(db, fid), c = hs.reduce((a, h) => a + h.credit, 0);
    if (c) db.ledger.push({ id: nid(db, "l"), familyId: f.id, type: "credit", amountCents: c, description: `Closure credit, ${name}`, date: today(), thread: "owner", category: "Credit" });
    post(db, parentThread(f), `Studio closed ${fmtDate(start)}${end !== start ? ` to ${fmtDate(end)}` : ""} for ${name}. No classes those days.${c ? ` We credited ${money(c)} to your account.` : ""}`, { kind: "message", title: `Studio closed · ${name}`, badge: { text: "Closed", tone: "warn" }, rows: [...hs.map(h => [`${first(h.s)} · ${h.k.style}`, fmtDate(h.date)] as Row), ["Credit", c ? money(c) : "None", "good"]] });
  }
  return post(db, "owner", `${name} closure is on the calendar. ${hits.length} class meetings cancelled, ${Object.keys(byFam).length} families notified${credit ? `, ${money(credit)} credited` : ""}. Roll call is skipped on those days.`, { kind: "report", title: "Closure saved", badge: { text: "Notified", tone: "good" }, rows: Object.entries(byFam).map(([fid, hs]) => [`${fam(db, fid).name} family`, `${hs.length} classes · ${money(hs.reduce((a, h) => a + h.credit, 0))}`] as Row) });
}
export const isClosed = (db: DB, iso: string) => db.closures.find(c => iso >= c.start && iso <= c.end);

// ---------- CSV import ----------
export function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some(c => c.trim())) out.push(row); row = []; cell = ""; } else cell += ch; }
  row.push(cell); if (row.some(c => c.trim())) out.push(row); return out;
}
export function importReview(db: DB, text: string, source: string) {
  const rows = parseCsv(text); const head = (rows.shift() ?? []).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const col = (r: string[], ...names: string[]) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return (r[i] ?? "").trim(); } return ""; };
  const parsed: ImportRow[] = rows.map(r => {
    const x: ImportRow = { family: col(r, "family_name", "family", "last_name"), parent: col(r, "parent_name", "guardian", "parent"), email: col(r, "email", "parent_email"), phone: col(r, "phone", "parent_phone"), student: col(r, "student_name", "student", "dancer"), birthdate: col(r, "birthdate", "dob", "birth_date"), size: col(r, "costume_size", "size") || "Child M", className: col(r, "class", "class_name"), allergies: col(r, "allergies", "medical"), status: "new family" };
    if (!x.family || !x.parent || !x.student) { x.status = "error"; x.issue = "Missing family, parent or student name"; return x; }
    if (x.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email)) { x.status = "error"; x.issue = "Email looks invalid"; return x; }
    const k = x.className ? findClass(db, x.className) : undefined; if (!k) { x.status = "error"; x.issue = `Class not found: ${x.className || "blank"}`; return x; }
    x.classId = k.id;
    const f = db.families.find(ff => ff.name.toLowerCase() === x.family.toLowerCase());
    if (f && db.students.some(s => s.familyId === f.id && s.name.toLowerCase() === x.student.toLowerCase())) { x.status = "duplicate"; x.issue = "Already on file"; }
    else if (f) x.status = "new student";
    return x;
  });
  // later rows of a family that is new in this file are new students
  const seen = new Set<string>(); parsed.forEach(x => { if (x.status === "new family") { if (seen.has(x.family.toLowerCase())) x.status = "new student"; seen.add(x.family.toLowerCase()); } });
  const ok = parsed.filter(x => x.status === "new family" || x.status === "new student");
  db.messages.push({ id: nid(db, "m"), thread: "owner", from: "owner", text: `Import families (${source})`, ts: nowDate().toISOString() });
  const m = post(db, "owner", `I read ${parsed.length} rows: ${parsed.filter(x => x.status === "new family").length} new families, ${parsed.filter(x => x.status === "new student").length} new students, ${parsed.filter(x => x.status === "duplicate").length} duplicates skipped, ${parsed.filter(x => x.status === "error").length} with problems. Review, then apply.`,
    { kind: "report", title: "Import review", subtitle: source, badge: { text: `${ok.length} ready`, tone: ok.length ? "good" : "warn" }, rows: parsed.map(x => [`${x.student} · ${x.family}`, `${x.status === "error" || x.status === "duplicate" ? `${cap(x.status)}: ${x.issue}` : `${cap(x.status)} · ${x.classId ? className(kls(db, x.classId)) : ""}`}`, x.status === "error" ? "bad" : x.status === "duplicate" ? "muted" : "good"] as Row), importRows: parsed });
  m.buttons = ok.length ? [{ label: `Apply import (${ok.length} rows)`, send: `apply import ${m.id}`, tone: "primary" }, { label: "Discard", send: `discard import ${m.id}` }] : undefined; m.sticky = true;
  return m;
}
const ageFrom = (b: string) => { const d = new Date(b + "T12:00:00"); if (isNaN(d.getTime())) return 8; const n = nowDate(); let a = n.getFullYear() - d.getFullYear(); if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--; return a; };
export function applyImport(db: DB, msgId: string, discard = false) {
  const m = db.messages.find(x => x.id === msgId); if (!m?.card?.importRows || m.card.applied) return post(db, "owner", "That import was already handled.");
  m.card.applied = true; m.buttons = undefined;
  if (discard) return post(db, "owner", "Import discarded. Nothing changed.");
  let nf = 0, ns = 0;
  for (const x of m.card.importRows.filter(r => r.status === "new family" || r.status === "new student")) {
    let f = db.families.find(ff => ff.name.toLowerCase() === x.family.toLowerCase());
    if (!f) { f = { id: nid(db, "fam_"), name: cap(x.family), parentName: x.parent, phone: x.phone || "not on file", email: x.email || "not on file", plan: "monthly" }; db.families.push(f); nf++; post(db, parentThread(f), `Welcome to Blue Ocean Dance Studio, ${x.parent.split(" ")[0]}! This is your family thread.`); }
    const k = kls(db, x.classId!); db.students.push({ id: nid(db, "s_"), name: x.student, familyId: f.id, classId: k.id, rateCents: k.priceCents, startDate: today(), active: true, size: x.size, age: ageFrom(x.birthdate), birthdate: x.birthdate || undefined, allergies: x.allergies || undefined }); ns++;
  }
  return post(db, "owner", `Import applied: ${nf} new families and ${ns} students added. They now show in the inbox.`, { kind: "report", title: "Import complete", badge: { text: "Applied", tone: "good" }, rows: [["New families", String(nf)], ["Students added", String(ns)]] });
}

// ---------- signup ----------
type Step = "parent" | "email" | "phone" | "g2" | "g2phone" | "student" | "birthdate" | "medical" | "allergies" | "class" | "another" | "emergency" | "ephone" | "waiver" | "card" | "review" | "done";
const Q: Record<Step, string> = { parent: "Welcome to Blue Ocean Dance Studio! Let's set up your family. What is your full name?", email: "Thanks! What is the best email for you?", phone: "And a mobile number for class texts?", g2: "Is there a second parent or guardian? Type their full name, or tap Skip.", g2phone: "What is their phone number?", student: "Now your dancer. What is your dancer's full name?", birthdate: "What is their birthdate? For example 2018-04-12 or April 12 2018.", medical: "Any medical conditions we should know about? Type them, or tap None.", allergies: "Any allergies? Type them, or tap None.", class: "Pick a class. These fit their age.", another: "Would you like to add another dancer?", emergency: "Who is your emergency contact (someone other than you)? Full name and relationship, for example Rosa Diaz, grandmother.", ephone: "Their phone number?", waiver: "Please review and agree to our liability release, photo release and medical info form.", card: "Last step: add a card for autopay. This demo stores only the last four digits. Type a card number, or tap Use test card.", review: "Please review everything. Tap Create my account when it looks right.", done: "" };
const qButtons = (db: DB, st: Step, d: any): Button[] | undefined => {
  if (st === "g2" || st === "medical" || st === "allergies") return [{ label: st === "g2" ? "Skip" : "None", send: st === "g2" ? "skip" : "none" }];
  if (st === "another") return [{ label: "Add another dancer", send: "yes", tone: "primary" }, { label: "No, continue", send: "no" }];
  if (st === "waiver") return [{ label: "I agree to all three", send: "i agree", tone: "primary" }];
  if (st === "card") return [{ label: "Use test card ending 4242", send: "4242 4242 4242 4242", tone: "primary" }];
  if (st === "review") return [{ label: "Create my account", send: "create my account", tone: "primary" }, { label: "Start over", send: "start over" }];
  if (st === "class") { const age = d.cur.age; const fit = db.classes.filter(k => age >= k.ageMin && age <= k.ageMax); return [...fit.map(k => ({ label: `${spots(db, k) > 0 ? "" : "Waitlist · "}${k.day} ${k.time} ${k.style}`, send: `class ${k.id}`, tone: spots(db, k) > 0 ? "primary" as const : undefined })), { label: "Decide later", send: "later" }]; }
};
export function startSignup(db: DB) {
  const id = nid(db, "su"), t = `signup:${id}`; db.signups[id] = { step: "parent", data: { kids: [] } };
  post(db, t, Q.parent, { kind: "info", title: "New family signup", subtitle: "About 2 minutes, all in this chat", rows: [["You will need", "Guardian contacts, dancer birthdates, medical and allergy info, an emergency contact, and a card"]] });
  return t;
}
const ask = (db: DB, t: string, st: Step, d: any, card?: Card) => { db.signups[t.slice(7)].step = st; const m = post(db, t, Q[st], card, qButtons(db, st, d)); return m; };
const parseBirth = (s: string) => { const iso = s.match(/(\d{4})[\/.\s-](\d{1,2})[\/.\s-](\d{1,2})/); if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`; const us = s.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/); if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`; const d = new Date(s); return isNaN(d.getTime()) ? undefined : isoOf(d); };
export function signupStep(db: DB, t: string, raw: string) {
  const id = t.slice(7), S = db.signups[id]; if (!S) return post(db, t, "This signup has ended.");
  const d = S.data, v = raw.trim(), n = norm(v), st = S.step as Step;
  db.messages.push({ id: nid(db, "m"), thread: t, from: "parent", text: st === "card" ? `Card ending ${v.replace(/\D/g, "").slice(-4)}` : v, ts: nowDate().toISOString() });
  if (n === "start over") { db.signups[id] = { step: "parent", data: { kids: [] } }; return ask(db, t, "parent", {}); }
  switch (st) {
    case "parent": if (v.split(/\s+/).length < 2) return post(db, t, "Please type your first and last name."); d.parent = cap(v); return ask(db, t, "email", d);
    case "email": if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return post(db, t, "That email does not look right. Try again?"); d.email = v; return ask(db, t, "phone", d);
    case "phone": if (v.replace(/\D/g, "").length < 10) return post(db, t, "Please include the area code, 10 digits."); d.phone = v; return ask(db, t, "g2", d);
    case "g2": if (n === "skip" || n === "no" || n === "none") return ask(db, t, "student", d); d.g2 = cap(v); return ask(db, t, "g2phone", d);
    case "g2phone": if (v.replace(/\D/g, "").length < 10) return post(db, t, "Please include the area code, 10 digits."); d.g2phone = v; return ask(db, t, "student", d);
    case "student": if (v.split(/\s+/).length < 2) return post(db, t, "Please type your dancer's first and last name."); d.cur = { name: cap(v) }; return ask(db, t, "birthdate", d);
    case "birthdate": { const b = parseBirth(v); if (!b) return post(db, t, "I could not read that date. Try 2018-04-12."); d.cur.birthdate = b; d.cur.age = ageFrom(b); if (d.cur.age < 2 || d.cur.age > 19) return post(db, t, `That makes them ${d.cur.age}. Our classes are for ages 3 to 18. Double check the year?`); return ask(db, t, "medical", d); }
    case "medical": d.cur.medical = /^(none|no|n a|na)$/.test(n) ? "" : v; return ask(db, t, "allergies", d);
    case "allergies": d.cur.allergies = /^(none|no|n a|na)$/.test(n) ? "" : v; return ask(db, t, "class", d);
    case "class": { const cid = v.match(/class\s+(\S+)/)?.[1]; const k = cid ? kls(db, cid) : findClass(db, v); if (!k && n !== "later") return post(db, t, "Tap one of the classes above, or Decide later.", undefined, qButtons(db, "class", d)); d.cur.classId = k?.id; d.cur.waitlist = k ? spots(db, k) <= 0 : false; d.kids.push(d.cur); d.cur = undefined; return ask(db, t, "another", d); }
    case "another": return /^(yes|y|add)/.test(n) ? ask(db, t, "student", d) : ask(db, t, "emergency", d);
    case "emergency": { const [nm, rel] = v.split(/,\s*/); if (!nm || nm.split(/\s+/).length < 2) return post(db, t, "Please type their full name, then a comma and the relationship."); d.ename = cap(nm); d.erel = rel ? cap(rel) : "Emergency contact"; return ask(db, t, "ephone", d); }
    case "ephone": if (v.replace(/\D/g, "").length < 10) return post(db, t, "Please include the area code, 10 digits."); d.ephone = v; return ask(db, t, "waiver", d, { kind: "compliance", title: "Waivers", rows: db.waivers.map(w => [w.name, "Required"] as Row) });
    case "waiver": if (!/agree|yes/.test(n)) return post(db, t, "We need your agreement to continue.", undefined, qButtons(db, "waiver", d)); d.signed = today(); return ask(db, t, "card", d);
    case "card": { const dig = v.replace(/\D/g, ""); if (dig.length < 13) return post(db, t, "Card numbers are 13 to 19 digits. Try the test card?", undefined, qButtons(db, "card", d)); d.card4 = dig.slice(-4); return ask(db, t, "review", d, reviewCard(db, d)); }
    case "review": if (!/create/.test(n)) return post(db, t, "Tap Create my account to finish.", undefined, qButtons(db, "review", d)); return createFamily(db, t, d);
  }
  return post(db, t, "This signup is complete.");
}
function reviewCard(db: DB, d: any): Card {
  return { kind: "confirm", title: "Review your signup", rows: [["Guardian", `${d.parent} · ${d.phone}`], ["Email", d.email], ["Second guardian", d.g2 ? `${d.g2} · ${d.g2phone}` : "None"], ["Emergency contact", `${d.ename} (${d.erel}) · ${d.ephone}`], ["Waivers", `All signed ${fmtDate(d.signed)}`], ["Card", `ending ${d.card4}`]],
    sections: d.kids.map((k: any) => ({ heading: `${k.name} · age ${k.age}`, rows: [["Birthdate", fmtDate(k.birthdate)], ["Class", k.classId ? `${className(kls(db, k.classId))}${k.waitlist ? " (waitlist)" : ""}` : "Decide later"], ["Medical", k.medical || "None"], ["Allergies", k.allergies || "None"]] as Row[] })) };
}
function createFamily(db: DB, t: string, d: any) {
  const last = d.parent.split(" ").slice(-1)[0];
  const f: Family = { id: nid(db, `fam_${last.toLowerCase()}`), name: db.families.some(x => x.name === last) ? `${last} (${d.parent.split(" ")[0]})` : last, parentName: d.parent, phone: d.phone, email: d.email, cardLast4: d.card4, plan: "monthly", guardian2: d.g2 ? { name: d.g2, phone: d.g2phone, email: "" } : undefined, emergency: { name: d.ename, phone: d.ephone, relation: d.erel }, signedUp: today() };
  db.families.push(f); db.waivers.forEach(w => db.signatures.push({ familyId: f.id, waiverId: w.id, date: d.signed }));
  const enrolled: string[] = [];
  for (const k of d.kids) {
    const cls = k.classId ? kls(db, k.classId) : undefined;
    if (cls && !k.waitlist) { db.students.push({ id: nid(db, "s_"), name: k.name, familyId: f.id, classId: cls.id, rateCents: cls.priceCents, startDate: today(), active: true, size: "Child M", age: k.age, birthdate: k.birthdate, medical: k.medical || undefined, allergies: k.allergies || undefined }); enrolled.push(`${k.name.split(" ")[0]} in ${className(cls)}`); }
    else if (cls) db.waitlist.push({ id: nid(db, "wl"), classId: cls.id, familyId: f.id, studentName: k.name, age: k.age, status: "waiting", added: today() });
  }
  const season = seasonFor(today()); let fees = 0;
  if (season && REG_FEES.perFamilyPerSeasonCents) { charge(db, f, REG_FEES.perFamilyPerSeasonCents, `${season.name} registration fee, family`, parentThread(f), { category: "Registration", season: season.id }); db.regCharged.push(`${season.id}:${f.id}`); fees += REG_FEES.perFamilyPerSeasonCents; }
  if (season) db.students.filter(s => s.familyId === f.id).forEach(s => { charge(db, f, REG_FEES.perStudentPerSeasonCents, `${season.name} registration fee, ${first(s)}`, parentThread(f), { category: "Registration", season: season.id }); db.regCharged.push(`${season.id}:${s.id}`); fees += REG_FEES.perStudentPerSeasonCents; });
  db.signups[t.slice(7)].step = "done";
  const card = reviewCard(db, d); card.title = "Account created"; card.badge = { text: "Welcome", tone: "good" }; card.rows.push(["Registration fees", money(fees)]);
  post(db, parentThread(f), `Welcome to Blue Ocean, ${d.parent.split(" ")[0]}! This is your family thread.${enrolled.length ? ` ${enrolled.join(", ")}.` : ""}`, card, fees ? payBtn(db, f) : undefined);
  post(db, "owner", `New family signed up online: ${d.parent}, ${d.kids.length} dancer${d.kids.length > 1 ? "s" : ""}.`, { ...card, kind: "message", title: `New family · ${f.name}`, badge: { text: "Online signup", tone: "good" } });
  return post(db, t, `You are all set! ${enrolled.length ? enrolled.join(", ") + "." : ""} ${money(fees)} in registration fees was posted to your account.`, card, [{ label: "Open my family thread", send: "open", action: `open:${f.id}`, tone: "primary" }]);
}

// ---------- staff roll ----------
export function saveRoll(db: DB, classId: string, date: string, marks: Record<string, { status: string; note: string }>, by: string) {
  const k = kls(db, classId);
  db.attendance = db.attendance.filter(a => !(a.classId === classId && a.date === date && marks[a.studentId]));
  Object.entries(marks).forEach(([sid, m]) => db.attendance.push({ id: nid(db, "a"), studentId: sid, classId, date, status: m.status as any, note: m.note || undefined }));
  const c = (st: string) => Object.values(marks).filter(m => m.status === st).length;
  post(db, "owner", `${by} submitted roll for ${className(k)} on ${fmtDate(date)}.`, { kind: "roster", title: `Roll · ${className(k)}`, subtitle: `${fmtDate(date)} · ${by}`, badge: { text: `${c("present") + c("late") + c("left early")} attended`, tone: "good" }, rows: Object.entries(marks).map(([sid, m]) => [db.students.find(s => s.id === sid)!.name, `${cap(m.status)}${m.note ? ` · ${m.note}` : ""}`, m.status === "absent" ? "bad" : m.status === "present" ? "good" : "warn"] as Row) });
}

// ---------- owner and parent routing ----------
export function opsOwner(db: DB, raw: string): boolean {
  const n = norm(raw); let m: RegExpMatchArray | null;
  if ((m = raw.match(/^confirm billing (\d{4}-\d{2})/i))) { runBilling(db, m[1]); return true; }
  if (/^(run|preview) billing|^bill (all|everyone|families) for|^run (\w+ )?tuition billing/.test(n)) { billingPreview(db, parseYm(n)); return true; }
  if ((m = raw.match(/^confirm closure (\d{4}-\d\d-\d\d) (\d{4}-\d\d-\d\d) (.+)$/i))) { confirmClosure(db, m[1], m[2], m[3]); return true; }
  if (/^(close|closed|closing) (the )?studio|^studio (is )?closed|^add (a )?(holiday|closure)/.test(n)) { closurePreview(db, raw); return true; }
  if (/^(closures|holidays|show closures)$/.test(n)) { post(db, "owner", db.closures.length ? "Studio closures on the calendar." : "No closures yet.", { kind: "info", title: "Closures", rows: db.closures.map(c => [c.name, `${fmtDate(c.start)}${c.end !== c.start ? ` to ${fmtDate(c.end)}` : ""} · ${money(c.creditCents)} credited`] as Row) }); return true; }
  if ((m = n.match(/^advance (?:the )?(?:demo )?date (?:by )?(\d+) days?/)) || (m = n.match(/^advance (\d+) days?/))) { advanceTo(db, addDays(today(), parseInt(m[1]))); return true; }
  if (/^(advance|set|move) (the )?(demo )?date to|^jump to/.test(n)) { const iso = raw.match(/(\d{4}-\d\d-\d\d)/)?.[1]; let target = iso; if (!target) { const c = parseClosure(raw.replace(/advance|date|to|the|demo|set|move|jump/gi, " ")); target = c?.start; } if (!target) { post(db, "owner", "Which date? For example: Advance date to Nov 12."); return true; } advanceTo(db, target); return true; }
  if (/^(next month|advance (to )?next month)$/.test(n)) { const d = d0(today()); d.setMonth(d.getMonth() + 1, 1); advanceTo(db, isoOf(d)); return true; }
  if (/^(what s the date|what is the date|demo date|today s date)/.test(n)) { post(db, "owner", `The demo date is ${fmtDate(today())}.`); return true; }
  if (/^use (rate table|per class|flat per class|student rate|each dancer s rate) billing/.test(n)) { db.billingModel = /rate table/.test(n) ? "rateTable" : /per class/.test(n) ? "perClass" : "studentRate"; post(db, "owner", `Billing model set to ${/rate table/.test(n) ? "rate table by weekly hours" : /per class/.test(n) ? "flat per class" : "each dancer's own rate"}. Run billing to preview it.`, { kind: "info", title: "Tuition model", rows: [["Rate table", BILLING.rateTable.map(r => `${r.maxHours > 10 ? "more" : `up to ${r.maxHours} hrs`} ${money(r.cents)}`).join(" · ")], ["Per class", money(BILLING.perClassCents)], ["Sibling discount", `${BILLING.siblingDiscountPct}%`], ["Multi class discount", `${BILLING.multiClassDiscountPct}%`], ["Registration", `${money(REG_FEES.perFamilyPerSeasonCents)} per family, ${money(REG_FEES.perStudentPerSeasonCents)} per dancer, each season`]] }); return true; }
  if (/^(billing rules|billing settings|tuition rules|seasons)/.test(n)) { post(db, "owner", "Here are the billing rules from the policy file.", { kind: "info", title: "Billing rules", rows: [["Model", model(db)], ["Due", `Day ${BILLING.dueDay} of the month`], ["Late fee", `${money(BILLING.lateFeeCents)} after ${BILLING.graceDays} days`], ["Auto post", BILLING.autoPostOnFirst ? "On the 1st" : "Off"], ["Sibling discount", `${BILLING.siblingDiscountPct}%`], ["Multi class discount", `${BILLING.multiClassDiscountPct}%`], ["Registration", `${money(REG_FEES.perFamilyPerSeasonCents)} per family, ${money(REG_FEES.perStudentPerSeasonCents)} per dancer`]], sections: [{ heading: "Seasons", rows: SEASONS.map(s => [s.name, `${fmtDate(s.start)} to ${fmtDate(s.end)} · registration ${fmtDate(s.regOpen)} to ${fmtDate(s.regClose)}`] as Row) }] }); return true; }
  if (/by category|transaction categories|category report/.test(n)) { categoryReport(db); return true; }
  if (/^(statements?|invoices?)( for)? (all|everyone|every family|families with a balance)/.test(n)) { statementCmd(db, "owner", undefined, true); return true; }
  if (/^(statement|invoice)s?\b/.test(n)) { statementCmd(db, "owner", findFamily(db, raw)); return true; }
  if (/^(waitlists?|show waitlist)/.test(n)) { waitlistCard(db); return true; }
  if ((m = raw.match(/^(apply|discard) import (\S+)/i))) { applyImport(db, m[2], m[1].toLowerCase() === "discard"); return true; }
  if (/^import (families|students|csv)/.test(n)) { post(db, "owner", "Import families and students from a CSV. Columns: family_name, parent_name, email, phone, student_name, birthdate, costume_size, class, allergies. You will see a review card before anything changes.", { kind: "info", title: "Import families", rows: [["Format", "CSV with a header row"], ["Class", "Day, time and style, for example Monday 5pm Ballet"], ["Duplicates", "Skipped automatically"]] }, [{ label: "Upload CSV", send: "import", action: "import:file", tone: "primary" }, { label: "Use sample CSV", send: "import", action: "import:sample" }], true); return true; }
  if ((m = raw.match(/^(?:remove|withdraw|drop) ([A-Za-z]+)(?: [A-Za-z]+)? from (.+)$/i))) { const s = findStudent(db, m[1]); const k = findClass(db, m[2]) ?? (s ? kls(db, s.classId) : undefined); if (!s || !k) { post(db, "owner", "Which dancer and class?"); return true; } if (s.classId === k.id) s.active = false; else s.extraClassIds = (s.extraClassIds ?? []).filter(x => x !== k.id); post(db, "owner", `${s.name} withdrawn from ${className(k)}.`); offerNext(db, k.id); return true; }
  return false;
}
export function opsParent(db: DB, f: Family, raw: string): boolean {
  const n = norm(raw), T = parentThread(f); let m: RegExpMatchArray | null;
  if ((m = n.match(/^(accept|decline) waitlist (\S+)/))) { respondWaitlist(db, f, m[2].replace(/\s/g, ""), m[1] === "accept"); return true; }
  if ((m = raw.match(/^join (?:the )?waitlist (c_\S+)/i))) { joinWaitlist(db, f, m[1], raw); return true; }
  if (/join (the )?waitlist|put (me|us|her|him) on (the )?waitlist|waitlist for/.test(n)) { const k = findClass(db, raw); if (!k) { post(db, T, "Which class? For example: Join waitlist for Tuesday 4pm hip hop."); return true; } joinWaitlist(db, f, k.id, raw); return true; }
  if (/(send|get|see|download|need) (me )?(my )?(a )?(statement|invoice)|^(my )?(statement|invoice)/.test(n)) { statementCmd(db, T, f); return true; }
  if (/closed|closure|holiday|thanksgiving|christmas|winter break|spring break/.test(n) && db.closures.length) { post(db, T, "Here are the dates the studio is closed.", { kind: "info", title: "Studio closures", rows: db.closures.map(c => [c.name, `${fmtDate(c.start)}${c.end !== c.start ? ` to ${fmtDate(c.end)}` : ""}`] as Row), footer: CLOSURE_POLICY.note }); return true; }
  return false;
}
export { TRIAL_FEE_CENTS };
