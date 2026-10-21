"use client";
import { useEffect, useRef, useState } from "react";
import type { Message, DB, Card } from "@/lib/types";
import { seed, SEED_VERSION } from "@/lib/seed";
import { handle, money } from "@/lib/engine";
import { view } from "@/lib/view";

const KEY = "blue-ocean-chat-pos-v2";
const loadDb = (): DB => { try { const r = localStorage.getItem(KEY); if (r) { const d = JSON.parse(r); if (d.version === SEED_VERSION) return d; } } catch {} const d = seed(); localStorage.setItem(KEY, JSON.stringify(d)); return d; };
const saveDb = (d: DB) => localStorage.setItem(KEY, JSON.stringify(d));
type State = ReturnType<typeof view>;

const OWNER_CHIPS = ["Enroll Emma Chen in Monday 5pm Ballet, start next week, $75/month, charge card ending 4242", "Post October tuition for all active students", "Maya checked in", "Text the Tuesday class that recital rehearsal is moved to 5pm", "Show this month's revenue and outstanding balances", "Run payroll for October", "How many pink tutus do we have left?", "Order 12 medium black leotards", "Merch stock", "Sell 2 hoodies to the Rossi family", "Recital status", "Add Maya to the opening number", "Send costume payment links to all families in the spring show", "Who still needs to sign the photo release?", "Compliance overview", "Open requests", "What did we pay in processing fees this month?", "help"];
const parentChips = (kids: string[]) => { const k = kids[0] ?? "my child"; return ["What classes are available?", "My child is 5 years old, what classes are available for that age group?", "I want to enroll my kid for a trial class, she's 8 years old. What's available?", "What does my child need to wear to class?", "Are there leotards and tights available or do I need to buy those?", "My child is going to miss the next 3 classes, do I need to pay for those 3 classes or can I cancel?", "What's my balance?", "Pay October tuition", `Can ${k} switch to Thursday hip hop?`, "Cancel next week's class", "Buy 4 recital tickets", "Sign photo release", "Is there class on Thanksgiving?"]; };

function CardView({ c }: { c: Card }) {
  const rows = (rs: Card["rows"]) => rs.map((r, i) => <div className={`row ${r[2] ?? ""}`} key={i}><span>{r[0]}</span><span>{r[1]}</span></div>);
  return <div className={`card k-${c.kind}`}>
    <div className="card-top"><div><div className="card-kind">{c.kind === "payrun" ? "Pay run" : c.kind}</div><h4>{c.title}</h4>{c.subtitle && <div className="card-sub">{c.subtitle}</div>}</div>
      {c.badge && <span className={`badge ${c.badge.tone}`}>{c.badge.text}</span>}</div>
    {c.progress && <div className="progress"><div className="bar"><i style={{ width: `${Math.min(100, c.progress.value / c.progress.max * 100)}%` }} /></div><small>{c.progress.label}</small></div>}
    {rows(c.rows)}
    {c.sections?.map((s, i) => <div className="section" key={i}><div className="sec-h">{s.heading}</div>{rows(s.rows)}</div>)}
    {c.footer && <div className="card-foot">{c.footer}</div>}
  </div>;
}

function Thread({ title, sub, thread, cls, state, send, chips, extra }: { title: string; sub: React.ReactNode; thread: string; cls: string; state: State; send: (t: string, x: string) => void; chips: string[]; extra?: React.ReactNode }) {
  const [text, setText] = useState(""); const ref = useRef<HTMLDivElement>(null); const inp = useRef<HTMLInputElement>(null);
  const msgs = state.messages.filter((m: Message) => m.thread === thread);
  const lastId = msgs[msgs.length - 1]?.id;
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [msgs.length, thread]);
  const go = (s: string) => { if (s.endsWith(": ")) { setText(s); inp.current?.focus(); } else send(thread, s); };
  const mine = cls === "owner" ? "owner" : "parent";
  return <section className={`thread ${cls}`} data-thread={thread}>
    <header className="head"><div className="head-t">{title}</div><div className="head-s">{sub}</div>{extra}</header>
    <div className="stream" ref={ref}>
      {msgs.map((m: Message) => <div key={m.id} className={`msg ${m.from === mine ? "me" : "sys"}`}>
        <div className="bubble">{m.text}</div>
        {m.card && <CardView c={m.card} />}
        {m.buttons && (m.id === lastId || m.sticky) && <div className="btns">{m.buttons.map(b => <button key={b.label} className={b.tone === "primary" ? "primary" : ""} onClick={() => go(b.send)}>{b.label}</button>)}</div>}
        <div className="ts">{new Date(m.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
      </div>)}
    </div>
    <div className="chips">{chips.map(c => <button key={c} onClick={() => go(c)}>{c}</button>)}</div>
    <form onSubmit={e => { e.preventDefault(); if (text.trim()) { send(thread, text); setText(""); } }}>
      <input ref={inp} value={text} onChange={e => setText(e.target.value)} placeholder={cls === "owner" ? "Tell the studio what to do" : "Message Blue Ocean Dance Studio"} /><button>Send</button>
    </form>
  </section>;
}

export default function Page() {
  const [state, setState] = useState<State | null>(null);
  const [famId, setFamId] = useState("fam_chen");
  useEffect(() => { setState(view(loadDb())); }, []);
  const send = (thread: string, text: string) => { const d = loadDb(); handle(d, thread, text); saveDb(d); setState(view(d)); };
  const reset = () => { if (confirm("Reset the demo data? This clears every thread.")) { const d = seed(); saveDb(d); setState(view(d)); } };
  if (!state) return <div className="loading">Opening threads</div>;
  const pf = state.families.find(f => f.id === famId) ?? state.families[0];
  return <main>
    <div className="brand"><div><b>Blue Ocean Dance Studio</b><span>One owner thread. One thread per family. No menus.</span></div><button className="reset" onClick={reset}>Reset demo</button></div>
    <div className="wrap">
      <Thread title="Owner's chat thread" sub={<>Front desk and back office · Payments via {state.processor.name}{state.openRequests ? <span className="pill">{state.openRequests} open requests</span> : null}</>} thread="owner" cls="owner" state={state} send={send} chips={OWNER_CHIPS} />
      <Thread title={`${pf.name} family thread`} sub={<>{pf.parentName}{pf.kids.length ? ` · ${pf.kids.join(", ")}` : ""} · {pf.balanceCents > 0 ? `${money(pf.balanceCents)} due` : "paid up"}</>} thread={`parent:${pf.id}`} cls="parent" state={state} send={send} chips={parentChips(pf.kids)}
        extra={<div className="picker">{state.families.map(f => <button key={f.id} className={f.id === pf.id ? "on" : ""} onClick={() => setFamId(f.id)}>{f.name}{f.balanceCents > 0 && <i />}</button>)}</div>} />
    </div>
  </main>;
}
