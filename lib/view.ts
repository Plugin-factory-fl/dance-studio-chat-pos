import { DB } from "./types";
import { balance } from "./engine";
export const view = (db: DB) => ({
  studio: db.studio, processor: db.processor, messages: db.messages,
  openRequests: db.requests.filter(r => r.status === "open").length,
  families: db.families.map(f => ({ ...f, balanceCents: balance(db, f.id), kids: db.students.filter(s => s.familyId === f.id).map(s => s.name.split(" ")[0]) })),
});
