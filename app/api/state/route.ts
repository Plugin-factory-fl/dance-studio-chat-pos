import { NextResponse } from "next/server";
import { load, save, seed } from "@/lib/store";
import { view } from "@/lib/view";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(view(load())); }
export async function DELETE() { const db = seed(); save(db); return NextResponse.json(view(db)); }
