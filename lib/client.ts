"use client";
import { useEffect, useState, useCallback } from "react";
import type { DB } from "./types";
import { seed, SEED_VERSION } from "./seed";

export const KEY = "blue-ocean-chat-pos-v2";
export const loadDb = (): DB => { try { const r = localStorage.getItem(KEY); if (r) { const d = JSON.parse(r); if (d.version === SEED_VERSION) return d; } } catch {} const d = seed(); saveDb(d); return d; };
export const saveDb = (d: DB) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage full: drop photo thumbnails and retry */ d.messages.forEach(m => { if (m.card?.image) m.card.image = undefined; }); localStorage.setItem(KEY, JSON.stringify(d)); } };

export function useDb() {
  const [db, setDb] = useState<DB | null>(null);
  useEffect(() => { setDb(loadDb()); const on = (e: StorageEvent) => { if (e.key === KEY) setDb(loadDb()); }; window.addEventListener("storage", on); return () => window.removeEventListener("storage", on); }, []);
  const update = useCallback((fn: (d: DB) => void) => { const d = loadDb(); fn(d); saveDb(d); setDb({ ...d }); }, []);
  const reset = useCallback(() => { const d = seed(); saveDb(d); setDb(d); }, []);
  return { db, update, reset };
}
