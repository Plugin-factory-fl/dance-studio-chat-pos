"use client";
import Link from "next/link";
import { useState } from "react";
import { Thread } from "@/components/Chat";
import { useDb } from "@/lib/client";
import { handle, money, balance } from "@/lib/engine";

const parentChips = (kids: string[]) => { const k = kids[0] ?? "my child"; return ["Show me how many pairs of tights I've purchased this year for my 12 year old and 14 year old.", "Are there any competition groups or specialty classes my child can enroll in?", "Do you offer solos, duos and trios?", "Is there a dance recital every year?", "Are there any payment plans?", "What if my child gets sick and can't continue or there is an accident? Are there refunds or partial payment refunds?", "What classes are available?", "My child is 5 years old, what classes are available for that age group?", "I want to enroll my kid for a trial class, she's 8 years old. What's available?", "What does my child need to wear to class?", "Are there leotards and tights available or do I need to buy those?", "My child is going to miss the next 3 classes, do I need to pay for those 3 classes or can I cancel?", "What's my balance?", "Pay October tuition", `Can ${k} switch to Thursday hip hop?`, "Cancel next week's class", "Buy 4 recital tickets", "Sign photo release", "Is there class on Thanksgiving?"]; };

export default function Page() {
  const { db, update, reset } = useDb();
  const [famId, setFamId] = useState("fam_chen");
  if (!db) return <div className="loading">Opening your thread</div>;
  const f = db.families.find(x => x.id === famId) ?? db.families[0];
  const kids = db.students.filter(s => s.familyId === f.id).map(s => s.name.split(" ")[0]);
  const bal = balance(db, f.id); const thread = `parent:${f.id}`;
  return <main className="parent-page">
    <div className="brand"><div><b>Blue Ocean Dance Studio</b><span>Your family thread. Ask anything, pay, book and manage classes right here.</span></div>
      <div className="brand-actions"><button className="reset" onClick={() => { if (confirm("Reset the demo data? This clears every thread.")) reset(); }}>Reset demo</button><Link className="admin-btn" href="/admin">Admin</Link></div></div>
    <div className="single">
      <Thread thread={thread} cls="parent" messages={db.messages.filter(m => m.thread === thread)} isMine={m => m.from === "parent"} send={t => update(d => handle(d, thread, t))} chips={parentChips(kids)} placeholder="Message Blue Ocean Dance Studio"
        header={<header className="head"><div className="head-t">{f.name} family thread</div><div className="head-s">{f.parentName}{kids.length ? ` · ${kids.join(", ")}` : ""} · {bal > 0 ? `${money(bal)} due` : "paid up"} · Demo: pick a family</div>
          <div className="picker">{db.families.map(x => <button key={x.id} className={x.id === f.id ? "on" : ""} onClick={() => setFamId(x.id)}>{x.name}{balance(db, x.id) > 0 && <i />}</button>)}</div></header>} />
    </div>
  </main>;
}
