import { JsonlRunStore } from "@chromeclaw/agent";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = new JsonlRunStore();
  const runs = await store.listRuns();
  return NextResponse.json({ runs });
}
