import { NextResponse } from "next/server";
import { load, save } from "@/lib/store";
import { handle } from "@/lib/engine";
import { view } from "@/lib/view";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { thread, text } = await req.json();
  if (thread !== "owner" && !/^parent:/.test(thread)) return NextResponse.json({ error: "bad thread" }, { status: 400 });
  const db = load(); handle(db, thread, String(text ?? "")); save(db);
  return NextResponse.json(view(db));
}
