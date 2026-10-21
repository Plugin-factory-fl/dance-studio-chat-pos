import { nowDate } from "./clock";
import { DB, Card, Row } from "./types";
import { post, nid, fmtDate } from "./engine";
import { today } from "./seed";

export const CATEGORIES = ["Leotards", "Tights", "Ballet shoes", "Tap shoes", "Jazz shoes", "Tutus", "Costumes", "Studio store"];
export const LOW_STOCK = 2;
export interface InvItem { key: string; category: string; name: string; size: string; color: string; count: number }

const catOf = (id: string, name: string) => id === "mx_leotard" ? "Leotards" : id === "mx_tights" ? "Tights" : id === "mx_slippers" ? "Ballet shoes" : id === "mx_tap" ? "Tap shoes" : id === "mx_jazz" ? "Jazz shoes" : /tutu/i.test(name) ? "Tutus" : id.startsWith("co_") ? "Costumes" : "Studio store";
const colorOf = (name: string) => (name.match(/\b(black|pink|silver|red|tan|white|blue)\b/i)?.[1] ?? "").toLowerCase();

export function inventoryItems(db: DB): InvItem[] {
  const out: InvItem[] = [];
  for (const m of db.merch) {
    if (m.sizes) for (const [z, q] of Object.entries(m.sizes)) out.push({ key: `merch:${m.id}:${z}`, category: catOf(m.id, m.name), name: m.name, size: z, color: colorOf(m.name), count: q });
    else out.push({ key: `merch:${m.id}:One size`, category: "Studio store", name: m.name, size: "One size", color: colorOf(m.name), count: m.stock });
  }
  for (const c of db.costumes) for (const [z, q] of Object.entries(c.stock)) out.push({ key: `costume:${c.id}:${z}`, category: catOf(c.id, c.name), name: c.name, size: z, color: c.color, count: q });
  return out.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
}
const label = (i: InvItem) => `${i.name} · ${i.size}`;

export function inventoryCard(db: DB): Card {
  const items = inventoryItems(db), low = items.filter(i => i.count <= LOW_STOCK);
  return { kind: "inventory", title: "Inventory", subtitle: `${items.reduce((a, i) => a + i.count, 0)} items across ${CATEGORIES.length} categories`, badge: low.length ? { text: `${low.length} low stock`, tone: "warn" } : { text: "Stocked", tone: "good" }, rows: [],
    sections: CATEGORIES.map(c => ({ heading: `${c} · ${items.filter(i => i.category === c).reduce((a, i) => a + i.count, 0)}`, rows: items.filter(i => i.category === c).map(i => [label(i), i.count === 0 ? "0 · out of stock" : i.count <= LOW_STOCK ? `${i.count} · low` : String(i.count), i.count === 0 ? "bad" : i.count <= LOW_STOCK ? "warn" : undefined].filter(Boolean) as Row) })).filter(s => s.rows.length),
    footer: `Low stock means ${LOW_STOCK} or fewer. Count from a photo to update.` };
}
export function showInventory(db: DB) { return post(db, "owner", "Here is everything on the shelves right now.", inventoryCard(db)); }

export function setCount(db: DB, key: string, n: number) {
  const [src, id, size] = key.split(":");
  if (src === "merch") { const m = db.merch.find(x => x.id === id); if (!m) return; if (m.sizes) { m.sizes[size] = n; m.stock = Object.values(m.sizes).reduce((a, b) => a + b, 0); } else m.stock = n; }
  else { const c = db.costumes.find(x => x.id === id); if (c) c.stock[size] = n; }
}

/** Post a review card from detected counts (keys from inventoryItems). */
export function postReview(db: DB, detected: Record<string, number>, opts: { simulated: boolean; image?: string; notes?: string[]; source: string }) {
  const items = inventoryItems(db);
  const review = items.filter(i => detected[i.key] !== undefined).map(i => ({ key: i.key, label: label(i), category: i.category, system: i.count, detected: Math.max(0, Math.round(detected[i.key])) }));
  const diffs = review.filter(r => r.detected !== r.system).length;
  db.messages.push({ id: nid(db, "m"), thread: "owner", from: "owner", text: `Count inventory from photo (${opts.source})`, ts: nowDate().toISOString() });
  return post(db, "owner", review.length ? `${opts.simulated ? "Demo mode, simulated results. " : ""}I counted ${review.reduce((a, r) => a + r.detected, 0)} items in ${new Set(review.map(r => r.category)).size} categories. ${diffs} counts differ from the system. Edit anything that looks off, then tap Update inventory.` : "I could not match anything in that photo to your inventory categories.",
    { kind: "review", title: "Photo count review", subtitle: opts.source, badge: opts.simulated ? { text: "Simulated", tone: "warn" } : { text: "AI count", tone: "good" }, rows: [], review, simulated: opts.simulated, image: opts.image, notes: opts.notes });
}

export function applyInventory(db: DB, msgId: string, values: Record<string, number>) {
  const m = db.messages.find(x => x.id === msgId); if (!m?.card?.review || m.card.applied) return;
  const items = inventoryItems(db), changes: { key: string; label: string; from: number; to: number }[] = [];
  for (const r of m.card.review) { const to = Math.max(0, Math.round(values[r.key] ?? r.detected)); const cur = items.find(i => i.key === r.key)?.count ?? 0; r.detected = to; if (to !== cur) { changes.push({ key: r.key, label: r.label, from: cur, to }); setCount(db, r.key, to); } }
  m.card.applied = true;
  db.inventoryLog.push({ id: nid(db, "inv"), date: today(), source: m.card.simulated ? "Photo count, demo mode" : "Photo count, AI", changes });
  post(db, "owner", changes.length ? `Inventory updated. ${changes.length} counts changed and logged.` : "Inventory confirmed. No counts changed, logged as a stock check.",
    { kind: "inventory", title: "Inventory ledger entry", subtitle: `${fmtDate(today())} · ${m.card.simulated ? "photo count, demo mode" : "photo count, AI"}`, badge: { text: "Applied", tone: "good" }, rows: changes.length ? changes.map(c => [c.label, `${c.from} to ${c.to} (${c.to > c.from ? "plus" : "minus"} ${Math.abs(c.to - c.from)})`, c.to < c.from ? "warn" : "good"] as Row) : [["Result", "All counts matched"]] });
  return post(db, "owner", "Updated inventory.", inventoryCard(db));
}

// ---------- vision ----------
export const DEMO_SAMPLES: { file: string; name: string; counts: Record<string, number>; notes: string[] }[] = [
  { file: "samples/inventory-shelf.jpg", name: "Storage shelf",
    counts: { "merch:mx_leotard:Child S": 6, "merch:mx_leotard:Child M": 5, "merch:mx_leotard:Child L": 4, "merch:mx_tights:Child S": 5, "merch:mx_tights:Child M": 6, "merch:mx_tights:Child L": 4, "merch:mx_slippers:Child S": 4, "merch:mx_slippers:Child M": 5, "merch:mx_slippers:Child L": 3, "merch:mx_tap:Child S": 3, "merch:mx_tap:Child M": 4, "merch:mx_tap:Child L": 2, "merch:mx_jazz:Child S": 2, "merch:mx_jazz:Child M": 3, "merch:mx_jazz:Child L": 2, "costume:co_tutu:Child S": 2, "costume:co_jazz:Child M": 1 },
    notes: ["Black leotards counted from three folded stacks, sizes estimated from shelf position", "Tights sizes read from the S and M bin labels", "Tap shoes and jazz shoes counted as pairs"] },
  { file: "samples/inventory-closet.jpg", name: "Costume closet",
    counts: { "costume:co_tutu:Child XS": 2, "costume:co_tutu:Child S": 3, "costume:co_tutu:Child M": 2, "costume:co_jacket:Child S": 1, "costume:co_jacket:Child M": 2, "costume:co_jacket:Child L": 1, "costume:co_leo:Child S": 3, "costume:co_leo:Child M": 3, "merch:mx_tights:Child M": 7, "merch:mx_slippers:Child M": 4 },
    notes: ["Pink tutus counted on hangers, sizes from hanger tags", "Silver hip hop jackets counted on the rail", "Boxes below hold tights and ballet slippers, counts approximate"] },
];

export async function countWithOpenAI(db: DB, apiKey: string, dataUrl: string): Promise<{ counts: Record<string, number>; notes: string[] }> {
  const items = inventoryItems(db);
  const catalog = items.map(i => `${i.key} = ${i.category}, ${i.name}, size ${i.size}${i.color ? `, ${i.color}` : ""}`).join("\n");
  const sys = `You count dance studio inventory in photos. Only count items you can actually see. Map every item to one key from this catalog. If the size is not visible, use the most likely size key for that item. Return JSON only: {"items":[{"key":"<catalog key>","count":<integer>}],"unmatched":[{"description":"<what you saw>","count":<integer>}],"notes":["<short note>"]}. Shoes are counted in pairs.\n\nCatalog:\n${catalog}`;
  const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-4o-mini", response_format: { type: "json_object" }, temperature: 0, messages: [{ role: "system", content: sys }, { role: "user", content: [{ type: "text", text: "Count the inventory in this photo by category, size and color." }, { type: "image_url", image_url: { url: dataUrl } }] }] }) });
  if (!r.ok) throw new Error(`OpenAI returned ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json(); const out = JSON.parse(j.choices[0].message.content);
  const keys = new Set(items.map(i => i.key)), counts: Record<string, number> = {};
  for (const it of out.items ?? []) if (keys.has(it.key)) counts[it.key] = (counts[it.key] ?? 0) + Number(it.count || 0);
  const notes = [...(out.notes ?? []), ...(out.unmatched ?? []).map((u: any) => `Not in catalog: ${u.count} ${u.description}`)];
  return { counts, notes };
}
