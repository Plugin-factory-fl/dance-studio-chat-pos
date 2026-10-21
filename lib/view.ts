import { DB } from "./types";
import { balance } from "./engine";
export const view = (db: DB) => ({
  studio: db.studio, processor: db.processor, messages: db.messages,
  parentFamily: db.families.find(f => f.id === "fam_chen"),
  families: db.families.map(f => ({ ...f, balanceCents: balance(db, f.id) })),
});
