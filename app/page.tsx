"use client";
import { useEffect, useRef, useState } from "react";
import type { Message, DB } from "@/lib/types";
import { seed } from "@/lib/seed";
import { handle } from "@/lib/engine";
import { view } from "@/lib/view";
const KEY = "dance-studio-chat-pos-v1";
const loadDb = (): DB => { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch {} const d = seed(); localStorage.setItem(KEY, JSON.stringify(d)); return d; };
const saveDb = (d: DB) => localStorage.setItem(KEY, JSON.stringify(d));
type State = { studio: string; processor: { name: string }; messages: Message[]; parentFamily?: { id: string; parentName: string; name: string } };

function Thread({ title, sub, thread, cls, state, send }: { title: string; sub: React.ReactNode; thread: string; cls: string; state: State; send: (t: string, x: string) => void }) {
  const [text, setText] = useState(""); const ref = useRef<HTMLDivElement>(null);
  const msgs = state.messages.filter(m => m.thread === thread);
  const lastId = msgs[msgs.length - 1]?.id;
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [msgs.length]);
  const mine = cls === "owner" ? "owner" : "parent";
  return <section className={`thread ${cls}`}>
    <div className="head">{title}<small>{sub}</small></div>
    <div className="stream" ref={ref}>
      {msgs.map(m => <div key={m.id} className={`msg ${m.from === mine ? "me" : "sys"}`}>
        {m.text}
        {m.card && <div className={`card ${m.card.kind}`}><h4>{m.card.title}</h4>{m.card.rows.map(([a, b], i) => <div className="row" key={i}><span>{a}</span><span>{b}</span></div>)}</div>}
        {m.buttons && m.id === lastId && <div className="btns">{m.buttons.map(b => <button key={b.label} onClick={() => send(thread, b.send)}>{b.label}</button>)}</div>}
        <div className="ts">{new Date(m.ts).toLocaleString()}</div>
      </div>)}
    </div>
    <form onSubmit={e => { e.preventDefault(); if (text.trim()) { send(thread, text); setText(""); } }}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a request" /><button>Send</button>
    </form>
  </section>;
}

export default function Page() {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => { setState(view(loadDb()) as State); }, []);
  const send = (thread: string, text: string) => { const d = loadDb(); handle(d, thread, text); saveDb(d); setState(view(d) as State); };
  const reset = () => { if (confirm("Reset the demo data?")) { const d = seed(); saveDb(d); setState(view(d) as State); } };
  if (!state) return <div style={{ padding: 20 }}>Loading threads</div>;
  const pf = state.parentFamily!;
  return <main className="wrap">
    <Thread title={`${state.studio} · Owner thread`} sub={<>Processor: {state.processor.name}. Type help for examples. <button className="reset" onClick={reset}>Reset demo</button></>} thread="owner" cls="owner" state={state} send={send} />
    <Thread title={`${pf.name} family thread`} sub={`${pf.parentName}, parent view`} thread={`parent:${pf.id}`} cls="parent" state={state} send={send} />
  </main>;
}
