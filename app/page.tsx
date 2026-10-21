"use client";
import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/types";
type State = { studio: string; processor: { name: string }; messages: Message[]; parentFamily?: { id: string; parentName: string; name: string } };

function Thread({ title, sub, thread, cls, state, send }: { title: string; sub: string; thread: string; cls: string; state: State; send: (t: string, x: string) => void }) {
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
  const refresh = () => fetch("/api/state").then(r => r.json()).then(setState);
  useEffect(() => { refresh(); const i = setInterval(refresh, 4000); return () => clearInterval(i); }, []);
  const send = async (thread: string, text: string) => {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thread, text }) });
    setState(await r.json());
  };
  if (!state) return <div style={{ padding: 20 }}>Loading threads</div>;
  const pf = state.parentFamily!;
  return <main className="wrap">
    <Thread title={`${state.studio} · Owner thread`} sub={`Processor: ${state.processor.name}. Type help for examples.`} thread="owner" cls="owner" state={state} send={send} />
    <Thread title={`${pf.name} family thread`} sub={`${pf.parentName}, parent view`} thread={`parent:${pf.id}`} cls="parent" state={state} send={send} />
  </main>;
}
