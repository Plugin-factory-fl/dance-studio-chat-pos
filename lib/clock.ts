// Demo clock. The owner can advance the date ("Advance date to Nov 12") to simulate billing runs and late fees.
let DEMO: string | undefined;
export const setDemoDate = (d?: string) => { DEMO = d; };
export const nowDate = () => { if (!DEMO) return new Date(); const r = new Date(); const [y, m, d] = DEMO.split("-").map(Number); r.setFullYear(y, m - 1, d); return r; };
export const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => isoOf(nowDate());
