"use client";
import { useEffect, useRef, useState } from "react";
import type { Message, Card } from "@/lib/types";

export function ReviewCard({ c, msgId, onApply }: { c: Card; msgId: string; onApply?: (id: string, v: Record<string, number>) => void }) {
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries((c.review ?? []).map(r => [r.key, r.detected])));
  const cats = [...new Set((c.review ?? []).map(r => r.category))];
  return <div className="card k-review">
    <div className="card-top"><div><div className="card-kind">Photo count</div><h4>{c.title}</h4>{c.subtitle && <div className="card-sub">{c.subtitle}</div>}</div>{c.badge && <span className={`badge ${c.badge.tone}`}>{c.badge.text}</span>}</div>
    {c.simulated && <div className="sim">Demo mode. These counts are simulated for the sample photo, not read by AI.</div>}
    {c.image && <img className="thumb" src={c.image} alt="Inventory photo" />}
    <div className="rv-head"><span>Item</span><span>System</span><span>Photo</span><span>Change</span></div>
    {cats.map(cat => <div key={cat}><div className="sec-h">{cat}</div>
      {(c.review ?? []).filter(r => r.category === cat).map(r => { const v = vals[r.key] ?? 0, d = v - r.system; return <div className="rv-row" key={r.key}>
        <span>{r.label}</span><span>{r.system}</span>
        <span>{c.applied ? <b>{v}</b> : <input type="number" min={0} value={v} aria-label={`Count for ${r.label}`} onChange={e => setVals({ ...vals, [r.key]: Math.max(0, parseInt(e.target.value || "0")) })} />}</span>
        <span className={d > 0 ? "pos" : d < 0 ? "neg" : "zero"}>{d === 0 ? "same" : d > 0 ? `plus ${d}` : `minus ${-d}`}</span></div>; })}</div>)}
    {c.notes?.length ? <div className="card-foot">{c.notes.join(" · ")}</div> : null}
    {!c.applied && onApply && <div className="btns"><button className="primary" onClick={() => onApply(msgId, vals)}>Update inventory</button></div>}
    {c.applied && <div className="card-foot">Applied to inventory and logged.</div>}
  </div>;
}

export function CardView({ c, msgId, onApply }: { c: Card; msgId: string; onApply?: (id: string, v: Record<string, number>) => void }) {
  if (c.kind === "review") return <ReviewCard c={c} msgId={msgId} onApply={onApply} />;
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

export function Thread({ thread, messages, isMine, send, chips, placeholder, cls, header, composerExtra, onApply, showButtons = true, above, onAction }: {
  thread: string; messages: Message[]; isMine: (m: Message) => boolean; send: (t: string) => void; chips?: string[]; placeholder: string; cls: string;
  header?: React.ReactNode; composerExtra?: React.ReactNode; onApply?: (id: string, v: Record<string, number>) => void; showButtons?: boolean; above?: React.ReactNode; onAction?: (a: string) => void;
}) {
  const [text, setText] = useState(""); const ref = useRef<HTMLDivElement>(null); const inp = useRef<HTMLInputElement>(null);
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [messages.length, thread]);
  const go = (s: string) => { if (s.endsWith(": ")) { setText(s); inp.current?.focus(); } else send(s); };
  return <section className={`thread ${cls}`} data-thread={thread}>
    {header}
    <div className="stream" ref={ref}>
      {messages.map(m => <div key={m.id} className={`msg ${isMine(m) ? "me" : "sys"} from-${m.from}`}>
        <div className="bubble">{m.text}</div>
        {m.card && <CardView c={m.card} msgId={m.id} onApply={onApply} />}
        {showButtons && m.buttons && (m.id === lastId || m.sticky) && <div className="btns">{m.buttons.map(b => <button key={b.label} className={b.tone === "primary" ? "primary" : ""} onClick={() => b.action && onAction ? onAction(b.action) : go(b.send)}>{b.label}</button>)}</div>}
        <div className="ts">{new Date(m.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
      </div>)}
    </div>
    {above}
    {chips && <div className="chips">{chips.map(c => <button key={c} onClick={() => go(c)}>{c}</button>)}</div>}
    <form onSubmit={e => { e.preventDefault(); if (text.trim()) { send(text); setText(""); } }}>
      {composerExtra}
      <input ref={inp} value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} /><button>Send</button>
    </form>
  </section>;
}
