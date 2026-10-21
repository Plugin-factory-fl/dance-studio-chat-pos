"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDb } from "@/lib/client";
import { today, nowDate } from "@/lib/clock";
import { fmtDate } from "@/lib/engine";
import { saveRoll, isClosed } from "@/lib/ops";
import { ROLL_STATUSES } from "@/lib/policy";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Mark = { status: string; note: string };

export default function Staff() {
  const { db, update } = useDb();
  const [cid, setCid] = useState(""); const [marks, setMarks] = useState<Record<string, Mark>>({}); const [saved, setSaved] = useState("");
  const date = db ? today() : ""; const day = db ? DAYS[nowDate().getDay()] : "";
  const classes = useMemo(() => db ? db.classes.filter(c => c.day === day) : [], [db, day]);
  useEffect(() => { if (!cid && classes[0]) setCid(classes[0].id); }, [classes, cid]);
  useEffect(() => { if (!db || !cid) return; const roster = db.students.filter(s => s.active && !s.paused && (s.classId === cid || (s.extraClassIds ?? []).includes(cid)));
    setMarks(Object.fromEntries(roster.map(s => { const a = db.attendance.find(x => x.studentId === s.id && x.classId === cid && x.date === date); const c = db.cancellations.find(x => x.studentId === s.id && x.classId === cid && x.date === date); return [s.id, { status: a?.status ?? (a ? "present" : c ? "absent" : ""), note: a?.note ?? (c ? "Cancelled ahead by parent" : "") }]; }))); setSaved(""); }, [cid, db?.attendance.length]); // eslint-disable-line
  if (!db) return <div className="loading">Opening roll call</div>;
  const k = db.classes.find(c => c.id === cid); const closed = isClosed(db, date);
  const teacher = k ? db.instructors.find(i => i.id === k.instructorId)! : undefined;
  const roster = db.students.filter(s => s.active && !s.paused && (s.classId === cid || (s.extraClassIds ?? []).includes(cid)));
  const set = (sid: string, p: Partial<Mark>) => { setMarks({ ...marks, [sid]: { ...marks[sid], ...p } }); setSaved(""); };
  const done = roster.every(s => marks[s.id]?.status);
  return <main className="staff">
    <div className="brand"><div><b>Blue Ocean Dance Studio</b><span>Staff roll call · {fmtDate(date)}</span></div><div className="brand-actions"><Link className="admin-btn ghost" href="/">Parent view</Link><Link className="admin-btn" href="/admin">Admin</Link></div></div>
    <div className="staff-wrap">
      <section className="thread staff-card">
        <header className="head"><div className="head-t">Today&apos;s classes</div><div className="head-s">{day} · pick your class</div>
          <div className="picker">{classes.length ? classes.map(c => <button key={c.id} className={c.id === cid ? "on" : ""} onClick={() => setCid(c.id)}>{c.time} {c.style}</button>) : <span>No classes today</span>}</div></header>
        {closed ? <div className="closed">Studio closed today for {closed.name}. Roll call is skipped.</div> : k && <div className="stream">
          <div className="roll-h"><div><b>{k.style}</b> · {k.day} {k.time} · {k.room}</div><div>{teacher?.name} · {roster.length} dancers</div>
            <button onClick={() => { const m = { ...marks }; roster.forEach(s => { if (!m[s.id]?.status) m[s.id] = { status: "present", note: m[s.id]?.note ?? "" }; }); setMarks(m); }}>Mark everyone else present</button></div>
          {roster.map(s => { const fam = db.families.find(f => f.id === s.familyId)!; return <div className="card roll" key={s.id} data-student={s.name}>
            <div className="card-top"><div><h4>{s.name}</h4><div className="card-sub">Age {s.age} · {fam.parentName} · {fam.phone}</div></div>{marks[s.id]?.status && <span className={`badge ${marks[s.id].status === "present" ? "good" : marks[s.id].status === "absent" ? "bad" : "warn"}`}>{marks[s.id].status}</span>}</div>
            {(s.medical || s.allergies) && <div className="alert">⚠ {[s.medical, s.allergies && `Allergy: ${s.allergies}`].filter(Boolean).join(" · ")}</div>}
            <div className="btns">{ROLL_STATUSES.map(st => <button key={st} className={marks[s.id]?.status === st ? "primary" : ""} onClick={() => set(s.id, { status: st })}>{st[0].toUpperCase() + st.slice(1)}</button>)}</div>
            <input className="note" placeholder="Roll note, for example arrived 10 min late" value={marks[s.id]?.note ?? ""} onChange={e => set(s.id, { note: e.target.value })} />
          </div>; })}
        </div>}
        {k && !closed && <form onSubmit={e => { e.preventDefault(); const m = Object.fromEntries(Object.entries(marks).filter(([, v]) => v.status)); update(d => saveRoll(d, k.id, date, m, teacher?.name ?? "Staff")); setSaved(`Roll saved for ${Object.keys(m).length} dancers and synced to admin.`); }}>
          <div className="roll-status">{saved || (done ? "Everyone is marked." : `${roster.filter(s => !marks[s.id]?.status).length} still to mark`)}</div><button>Submit roll</button></form>}
      </section>
    </div>
  </main>;
}
