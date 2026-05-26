import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("path");
  if (!requested) return NextResponse.json({ error: "path is required" }, { status: 400 });

  const resolved = path.resolve(requested);
  const allowedRoot = path.resolve(".chromeclaw");
  if (!resolved.startsWith(allowedRoot)) {
    return NextResponse.json({ error: "screenshot path outside ChromeClaw log directory" }, { status: 403 });
  }

  const bytes = await readFile(resolved);
  return new Response(bytes, {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store"
    }
  });
}
