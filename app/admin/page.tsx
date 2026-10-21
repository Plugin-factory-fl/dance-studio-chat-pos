"use client";
import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import { Thread } from "@/components/Chat";
import { useDb } from "@/lib/client";
import { handle, money, balance, studioReply, fmtDate } from "@/lib/engine";
import { familyDetails } from "@/lib/details";
import { downloadPdf } from "@/lib/pdf";
import { importReview } from "@/lib/ops";
import { DEMO_SAMPLES, postReview, applyInventory, countWithOpenAI, inventoryItems, LOW_STOCK } from "@/lib/inventory";
import type { DB, Message } from "@/lib/types";

const OWNER_CHIPS = ["Run billing for November", "Advance date to Nov 12", "Statements for all families", "Revenue by category", "Billing rules", "Use rate table billing", "Close studio Nov 26 to 28 for Thanksgiving", "Waitlists", "Import families", "Inventory", "Open requests", "Show this month's revenue and outstanding balances", "Enroll Emma Chen in Monday 5pm Ballet, start next week, $75/month, charge card ending 4242", "Post October tuition for all active students", "Maya checked in", "Text the Tuesday class that recital rehearsal is moved to 5pm", "Run payroll for October", "How many pink tutus do we have left?", "Order 12 medium black leotards", "Merch stock", "Sell 2 hoodies to the Rossi family", "Recital status", "Add Maya to the opening number", "Send costume payment links to all families in the spring show", "Who still needs to sign the photo release?", "Compliance overview", "What did we pay in processing fees this month?", "help"];
const KEY_STORE = "blue-ocean-openai-key", DEMO_STORE = "blue-ocean-demo-mode";
const preview = (m?: Message) => m ? (m.from === "parent" ? "" : "Studio: ") + (m.text || m.card?.title || "") : "No messages yet";

function shrink(src: string, max: number): Promise<string> {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const r = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.8)); }; img.onerror = rej; img.src = src; });
}

function PhotoPanel({ db, update, onClose }: { db: DB; update: (fn: (d: DB) => void) => void; onClose: () => void }) {
  const [key, setKey] = useState(""); const [demo, setDemo] = useState(true); const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null); const base = process.env.NEXT_PUBLIC_BASE ?? "/dance-studio-chat-pos";
  useEffect(() => { setKey(localStorage.getItem(KEY_STORE) ?? ""); setDemo((localStorage.getItem(DEMO_STORE) ?? (localStorage.getItem(KEY_STORE) ? "0" : "1")) === "1"); }, []);
  const saveKey = (v: string) => { setKey(v); v ? localStorage.setItem(KEY_STORE, v) : localStorage.removeItem(KEY_STORE); };
  const saveDemo = (v: boolean) => { setDemo(v); localStorage.setItem(DEMO_STORE, v ? "1" : "0"); };
  const run = async (src: string, label: string, sample?: typeof DEMO_SAMPLES[number]) => {
    setErr(""); setBusy(demo ? "Simulating count" : "Counting with AI");
    try {
      const thumb = await shrink(src, 360);
      if (demo || !key) { const s = sample ?? DEMO_SAMPLES[0]; await new Promise(r => setTimeout(r, 500)); update(d => postReview(d, s.counts, { simulated: true, image: thumb, notes: [...s.notes, ...(sample ? [] : ["Your photo was not analyzed. Demo mode shows the sample shelf counts."])], source: `${label} · demo mode` })); }
      else { const big = await shrink(src, 1280); const r = await countWithOpenAI(db, key, big); update(d => postReview(d, r.counts, { simulated: false, image: thumb, notes: r.notes, source: `${label} · OpenAI vision` })); }
      onClose();
    } catch (e: any) { setErr(String(e?.message ?? e)); } finally { setBusy(""); }
  };
  const pick = (f?: File) => { if (!f) return; const r = new FileReader(); r.onload = () => run(String(r.result), f.name || "Camera photo"); r.readAsDataURL(f); };
  return <div className="photo-panel">
    <div className="pp-head"><b>Count inventory from photo</b><button className="x" onClick={onClose} aria-label="Close">×</button></div>
    <div className="pp-row">
      <button className="primary" onClick={() => file.current?.click()} disabled={!!busy}>Take or upload photo</button>
      <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={e => pick(e.target.files?.[0])} />
      <label className="toggle"><input type="checkbox" checked={demo} onChange={e => saveDemo(e.target.checked)} /> Demo mode (simulated, no key needed)</label>
    </div>
    <div className="pp-samples">{DEMO_SAMPLES.map(s => <button key={s.file} onClick={() => run(`${base}/${s.file}`, `Sample photo: ${s.name}`, s)} disabled={!!busy}><img src={`${base}/${s.file}`} alt={s.name} /><span>Try sample: {s.name}</span></button>)}</div>
    <details className="pp-settings" open={!demo && !key}><summary>Settings: your OpenAI API key</summary>
      <input type="password" placeholder="Paste your OpenAI API key" value={key} onChange={e => saveKey(e.target.value.trim())} />
      <small>Stored only in this browser (localStorage) and sent only to OpenAI when you count a photo with demo mode off. Never stored on the site.</small></details>
    {busy && <div className="pp-busy">{busy}…</div>}{err && <div className="pp-err">{err}</div>}
  </div>;
}

function Field({ label, value, onSave, editing }: { label: string; value?: string; onSave: (v: string) => void; editing: boolean }) {
  const [v, setV] = useState(value ?? ""); useEffect(() => setV(value ?? ""), [value, editing]);
  return <div className="kv"><span>{label}</span>{editing ? <input className="edit" aria-label={label} value={v} onChange={e => setV(e.target.value)} onBlur={() => v !== (value ?? "") && onSave(v)} /> : <span>{value || "not on file"}</span>}</div>;
}
function Details({ db, famId, update }: { db: DB; famId: string; update: (fn: (d: DB) => void) => void }) {
  const d = familyDetails(db, famId); const [ed, setEd] = useState<string | null>(null);
  useEffect(() => setEd(null), [famId]);
  const setF = (fn: (f: any) => void) => update(x => fn(x.families.find(y => y.id === famId)!));
  const setS = (sid: string, fn: (s: any) => void) => update(x => fn(x.students.find(y => y.id === sid)!));
  const E = ed === "fam";
  return <aside className="details">
    <div className="d-card"><div className="d-top"><div><div className="d-name">{d.f.name} family</div><div className="d-sub">{d.f.parentName}</div></div><button className="edit-btn" onClick={() => setEd(E ? null : "fam")}>{E ? "Done" : "Edit"}</button></div>
      <Field editing={E} label="Guardian" value={d.f.parentName} onSave={v => setF(f => f.parentName = v)} />
      <Field editing={E} label="Phone" value={d.f.phone} onSave={v => setF(f => f.phone = v)} /><Field editing={E} label="Email" value={d.f.email} onSave={v => setF(f => f.email = v)} />
      <Field editing={E} label="Second guardian" value={d.f.guardian2?.name} onSave={v => setF(f => f.guardian2 = { ...(f.guardian2 ?? { phone: "", email: "" }), name: v })} />
      {(E || d.f.guardian2) && <Field editing={E} label="Second guardian phone" value={d.f.guardian2?.phone} onSave={v => setF(f => f.guardian2 = { ...(f.guardian2 ?? { name: "", email: "" }), phone: v })} />}
      <Field editing={E} label="Emergency contact" value={d.f.emergency ? `${d.f.emergency.name}${d.f.emergency.relation ? ` (${d.f.emergency.relation})` : ""}` : ""} onSave={v => setF(f => { const m = v.match(/^(.*?)\s*(?:\((.*)\))?$/)!; f.emergency = { ...(f.emergency ?? { phone: "" }), name: m[1], relation: m[2] ?? f.emergency?.relation ?? "" }; })} />
      <Field editing={E} label="Emergency phone" value={d.f.emergency?.phone} onSave={v => setF(f => f.emergency = { ...(f.emergency ?? { name: "", relation: "" }), phone: v })} />
      <div className="kv"><span>Balance</span><span className={d.bal > 0 ? "warn" : "good"}>{d.bal > 0 ? `${money(d.bal)} due` : d.bal < 0 ? `${money(-d.bal)} credit` : "Paid up"}</span></div>
      <div className="kv"><span>Payment plan</span><span>{d.plan.name}</span></div>
      <div className="kv"><span>Card on file</span><span>{d.f.cardLast4 ? `ending ${d.f.cardLast4}` : "none"} · {d.processor.name}</span></div>
      {d.f.signedUp && <div className="kv"><span>Signed up online</span><span>{fmtDate(d.f.signedUp)}</span></div>}
      <div className="d-h">Waivers</div>{d.waivers.map(w => <div className="kv" key={w.name}><span>{w.name}</span><span className={w.signed ? "good" : "bad"}>{w.signed ? `Signed ${w.signed}` : "Missing"}</span></div>)}
      <div className="btns"><button onClick={() => downloadPdf(db, `pdf:${famId}`)}>Statement PDF</button><button onClick={() => downloadPdf(db, `invoice:${famId}`)}>Invoice PDF</button></div>
    </div>
    {d.kids.length === 0 && <div className="d-card"><div className="d-sub">No dancers enrolled yet.</div></div>}
    {d.kids.map(k => { const SE = ed === k.s.id; return <div className="d-card child" key={k.s.id} data-child={k.s.name}>
      <div className="d-top"><div><div className="d-name">{k.s.name}</div><div className="d-sub">Age {k.s.age} · costume size {k.s.size}{k.s.paused ? " · paused" : ""}</div></div><button className="edit-btn" onClick={() => setEd(SE ? null : k.s.id)}>{SE ? "Done" : "Edit"}</button></div>
      {(k.s.allergies || k.s.medical) && !SE && <div className="alert">⚠ {[k.s.medical, k.s.allergies && `Allergy: ${k.s.allergies}`].filter(Boolean).join(" · ")}</div>}
      {SE && <><Field editing label="Name" value={k.s.name} onSave={v => setS(k.s.id, s => s.name = v)} /><Field editing label="Age" value={String(k.s.age)} onSave={v => setS(k.s.id, s => s.age = parseInt(v) || s.age)} />
        <Field editing label="Birthdate" value={k.s.birthdate} onSave={v => setS(k.s.id, s => s.birthdate = v)} /><Field editing label="Costume size" value={k.s.size} onSave={v => setS(k.s.id, s => s.size = v)} />
        <Field editing label="Medical" value={k.s.medical} onSave={v => setS(k.s.id, s => s.medical = v)} /><Field editing label="Allergies" value={k.s.allergies} onSave={v => setS(k.s.id, s => s.allergies = v)} /></>}
      <div className="d-h">Classes</div>{k.classes.map(c => <div className="kv" key={c.name + c.when}><span>{c.name}</span><span>{c.when} · {c.room}</span></div>)}
      <div className="d-h">Attendance this term <small>since {fmtDate(k.att.start)}</small></div>
      <div className="att"><div className="ring" style={{ background: `conic-gradient(var(--good) ${k.att.pct * 3.6}deg, #efe9dd 0)` }}><span>{k.att.pct}%</span></div>
        <div className="att-g"><div><b>{k.att.present}</b>present</div><div><b>{k.att.absent}</b>absent</div><div><b>{k.att.cancelled}</b>cancelled</div><div><b>{money(k.att.credits)}</b>credits</div></div></div>
      <div className="kv"><span>Last attended</span><span>{k.att.last ? fmtDate(k.att.last) : "not yet"}</span></div>
      {k.att.notes.length > 0 && <div className="kv"><span>Roll notes</span><span>{k.att.notes.join(" · ")}</span></div>}
      <div className="d-h">Recital</div><div className="kv"><span>Numbers</span><span>{k.numbers.join(", ") || "Not in a number yet"}</span></div>
      {k.costumes.length > 0 && <div className="kv"><span>Costumes</span><span>{k.costumes.join(", ")}</span></div>}
      <div className="d-h">Merch purchases</div>{k.merch.length ? k.merch.map((m, i) => <div className="kv" key={i}><span>{m.date}</span><span>{m.item} {m.size} · {m.amount}</span></div>) : <div className="kv"><span>None yet</span><span></span></div>}
      <div className="kv"><span>Medical pause</span><span className={k.s.paused ? "warn" : ""}>{k.medical}</span></div>
    </div>; })}
  </aside>;
}

function Overview({ db }: { db: DB }) {
  const out = db.families.reduce((a, f) => a + Math.max(0, balance(db, f.id)), 0);
  const low = inventoryItems(db).filter(i => i.count <= LOW_STOCK);
  return <aside className="details"><div className="d-card"><div className="d-name">Studio overview</div><div className="d-sub">{db.families.length} families · {db.students.length} dancers</div>
    <div className="kv"><span>Open requests</span><span className={db.requests.some(r => r.status === "open") ? "warn" : "good"}>{db.requests.filter(r => r.status === "open").length}</span></div>
    <div className="kv"><span>Outstanding</span><span className="warn">{money(out)}</span></div>
    <div className="kv"><span>Processor</span><span>{db.processor.name}</span></div>
    <div className="d-h">Low stock</div>{low.slice(0, 12).map(i => <div className="kv" key={i.key}><span>{i.name} {i.size}</span><span className={i.count ? "warn" : "bad"}>{i.count}</span></div>)}
    <div className="d-h">Inventory log</div>{db.inventoryLog.length ? db.inventoryLog.slice(-5).reverse().map(l => <div className="kv" key={l.id}><span>{fmtDate(l.date)}</span><span>{l.changes.length} changes · {l.source}</span></div>) : <div className="kv"><span>No photo counts yet</span><span></span></div>}
  </div></aside>;
}

export default function Admin() {
  const { db, update, reset } = useDb();
  const csvRef = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState("owner"); const [q, setQ] = useState(""); const [photo, setPhoto] = useState(false);
  useEffect(() => { if (db && sel !== "owner") update(d => { d.lastRead[sel] = new Date().toISOString(); }); }, [sel, db?.messages.length]); // eslint-disable-line
  const fams = useMemo(() => db ? db.families.map(f => { const t = `parent:${f.id}`; const ms = db.messages.filter(m => m.thread === t); const lr = db.lastRead[t] ?? "";
    return { f, t, last: ms[ms.length - 1], unread: ms.filter(m => m.from === "parent" && m.ts > lr).length, reqs: db.requests.filter(r => r.familyId === f.id && r.status === "open").length, bal: balance(db, f.id) }; })
    .filter(x => !q || `${x.f.name} ${x.f.parentName} ${db.students.filter(s => s.familyId === x.f.id).map(s => s.name).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.last?.ts ?? "").localeCompare(a.last?.ts ?? "")) : [], [db, q]);
  if (!db) return <div className="loading">Opening admin</div>;
  const ownerMsgs = db.messages.filter(m => m.thread === "owner");
  const famId = sel.startsWith("parent:") ? sel.slice(7) : "";
  const f = db.families.find(x => x.id === famId);
  const openReqs = db.requests.filter(r => r.familyId === famId && r.status === "open");
  const apply = (id: string, v: Record<string, number>) => update(d => applyInventory(d, id, v));
  const base = "/dance-studio-chat-pos";
  const onAction = async (act: string) => {
    if (/^(pdf|invoice):/.test(act)) { await downloadPdf(db, act); return; }
    if (act === "import:sample") { const t = await (await fetch(`${base}/samples/families-import.csv`)).text(); update(d => importReview(d, t, "Sample CSV: families-import.csv")); }
    if (act === "import:file") csvRef.current?.click();
  };
  return <main className="admin">
    <div className="brand"><div><b>Blue Ocean Dance Studio</b><span>Admin inbox · demo date {fmtDate(db.demoDate ?? new Date().toISOString().slice(0, 10))}</span></div><div className="brand-actions"><button className="reset" onClick={() => { if (confirm("Reset the demo data? This clears every thread.")) reset(); }}>Reset demo</button><Link className="admin-btn ghost" href="/staff">Staff</Link><Link className="admin-btn" href="/">Parent view</Link></div></div>
    <div className="cols">
      <nav className="list">
        <input className="search" placeholder="Search families or dancers" value={q} onChange={e => setQ(e.target.value)} />
        <button className={`li pinned ${sel === "owner" ? "on" : ""}`} onClick={() => setSel("owner")}><div className="av owner">OA</div><div className="li-b"><div className="li-t">Owner assistant <span className="pin">Pinned</span></div><div className="li-p">{preview(ownerMsgs[ownerMsgs.length - 1]).replace(/^Studio: /, "")}</div></div></button>
        {fams.map(x => <button key={x.f.id} className={`li ${sel === x.t ? "on" : ""}`} onClick={() => setSel(x.t)} data-family={x.f.name}>
          <div className="av">{x.f.name.slice(0, 2)}</div>
          <div className="li-b"><div className="li-t">{x.f.name} family {x.bal > 0 && <i className="dot" title="Balance due" />}</div><div className="li-p">{preview(x.last)}</div></div>
          <div className="li-r">{x.last && <small>{new Date(x.last.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</small>}{x.reqs > 0 ? <span className="bdg req">{x.reqs} request{x.reqs > 1 ? "s" : ""}</span> : x.unread > 0 ? <span className="bdg">{x.unread}</span> : null}</div>
        </button>)}
      </nav>
      {sel === "owner" ? <Thread thread="owner" cls="owner" messages={ownerMsgs} isMine={m => m.from === "owner"} send={t => update(d => handle(d, "owner", t))} chips={OWNER_CHIPS} placeholder="Tell the studio what to do" onApply={apply} onAction={onAction}
        header={<header className="head"><div className="head-t">Owner assistant</div><div className="head-s">Front desk and back office · Payments via {db.processor.name}</div></header>}
        above={photo ? <PhotoPanel db={db} update={update} onClose={() => setPhoto(false)} /> : null}
        composerExtra={<><input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={e => { const fl = e.target.files?.[0]; if (fl) fl.text().then(t => update(d => importReview(d, t, fl.name))); e.target.value = ""; }} /><button type="button" className="cam" onClick={() => setPhoto(!photo)} title="Count inventory from photo">📷 Count inventory from photo</button></>} />
        : f && <Thread thread={sel} cls="parent admin-view" messages={db.messages.filter(m => m.thread === sel)} isMine={m => m.from !== "parent"} showButtons={false} send={t => update(d => studioReply(d, f.id, t))} placeholder={`Reply to ${f.parentName} as the studio`}
          header={<header className="head"><div className="head-t">{f.name} family</div><div className="head-s">{f.parentName} · replies post in their thread as Blue Ocean Dance Studio</div></header>}
          above={openReqs.length ? <div className="req-bar">{openReqs.map(r => <div className="req" key={r.id}><div><b>{r.id}</b> {r.text}</div><div className="btns">{r.type === "question" ? <span className="hint">Reply below to answer</span> : <><button className="primary" onClick={() => update(d => handle(d, "owner", `approve request ${r.id}`))}>Approve</button><button onClick={() => update(d => handle(d, "owner", `decline request ${r.id}`))}>Decline</button></>}</div></div>)}</div> : null} />}
      {f ? <Details db={db} famId={f.id} update={update} /> : <Overview db={db} />}
    </div>
  </main>;
}
