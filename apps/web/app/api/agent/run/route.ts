import { BrowserAgentRuntime } from "@chromeclaw/agent";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    task?: string;
    provider?: string;
    model?: string;
    headless?: boolean;
    maxSteps?: number;
  };

  if (!body.task?.trim()) {
    return NextResponse.json({ error: "Task is required." }, { status: 400 });
  }

  const runtime = new BrowserAgentRuntime();
  const run = await runtime.run({
    task: body.task,
    provider: body.provider ?? process.env.CHROMECLAW_PROVIDER ?? "mock",
    model: body.model ?? process.env.CHROMECLAW_MODEL,
    headless: body.headless ?? process.env.CHROMECLAW_HEADLESS === "true",
    maxSteps: body.maxSteps ?? Number(process.env.CHROMECLAW_MAX_STEPS ?? 20),
    screenshotsDir: ".chromeclaw/screenshots"
  });

  return NextResponse.json(run);
}
