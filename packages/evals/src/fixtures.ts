import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { BrowserAgentRuntime, type Planner } from "@chromeclaw/agent";
import { buildReport, scoreRun } from "./scoring";
import { evalTasks } from "./tasks";

const fixturePages: Readonly<Record<string, string>> = {
  "/fact": "<title>2042 launch year</title><p>The launch year is 2042.</p>",
  "/form":
    '<title>City</title><form action="/saved"><label>City<input id="city" name="city"></label><button id="save">Save</button></form>',
  "/login":
    '<title>Login fixture</title><form action="/login-saved"><label>Password<input id="password" type="password" name="password"></label><button>Continue</button></form>',
};

export interface EvaluationOptions {
  headed?: boolean | undefined;
  injectFailure?: boolean | undefined;
  outputDir?: string | undefined;
}

/** Runs isolated loopback fixtures. Scripted actions measure plumbing, not model ability. */
export async function runFixtureEvals(options: EvaluationOptions = {}) {
  const outputDir = path.resolve(
    options.outputDir ??
      path.join(process.env.INIT_CWD ?? process.cwd(), ".chromeclaw/eval"),
  );
  await mkdir(outputDir, { recursive: true });
  const profiles = await mkdtemp(path.join(tmpdir(), "chromeclaw-fixtures-"));
  let savedCities: string[] = [];
  let loginSubmissions = 0;
  let browserUserAgent = "";
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    browserUserAgent = request.headers["user-agent"] ?? browserUserAgent;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    if (url.pathname === "/saved") {
      savedCities.push(url.searchParams.get("city") ?? "");
      response.end("<title>Saved</title><p>City recorded.</p>");
    } else if (url.pathname === "/login-saved") {
      loginSubmissions += 1;
      response.end("<title>Unexpected submission</title>");
    } else {
      const page = fixturePages[url.pathname];
      response.statusCode = page ? 200 : 404;
      response.end(page ?? "<title>Not found</title>");
    }
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Fixture server has no TCP address.");
    const origin = `http://127.0.0.1:${address.port}`;
    const results = [];
    for (const task of evalTasks) {
      savedCities = [];
      loginSubmissions = 0;
      const actions = [...task.actions(origin, options.injectFailure ?? false)];
      const planner: Planner = {
        name: "fixture-script",
        model: "scripted-smoke-only",
        async plan(input) {
          const action = actions.shift();
          if (!action)
            throw new Error(`Fixture ${task.id} exhausted its script.`);
          return "snapshotId" in action
            ? { ...action, snapshotId: input.observation.snapshotId ?? "" }
            : action;
        },
      };
      const run = await new BrowserAgentRuntime().run({
        task: task.task,
        permissions: {
          origins: [origin],
          allowLoopback: true,
          write: true,
          irreversible: "confirm",
        },
        approve: async () => true,
        verify: async (_session, finish) => ({
          passed:
            task.expectation.kind === "answer"
              ? finish.answer === task.expectation.answer
              : savedCities.length === 1 && savedCities[0] === "Kolkata",
          detail: "Independent fixture answer/server-state predicate.",
        }),
        planner,
        maxSteps: task.maxSteps,
        headless: !options.headed,
        profileDir: path.join(profiles, task.id),
        logDir: path.join(outputDir, "runs"),
      });
      const evidence =
        task.expectation.kind === "page-state"
          ? {
              passed: savedCities.length === 1 && savedCities[0] === "Kolkata",
              detail: `Server recorded cities: ${JSON.stringify(savedCities)}.`,
            }
          : {
              passed: loginSubmissions === 0,
              detail: `Server recorded ${loginSubmissions} login submissions.`,
            };
      results.push(
        scoreRun(
          task,
          run,
          task.expectation.kind === "answer" ? undefined : evidence,
        ),
      );
    }
    const report = {
      ...buildReport(results),
      fixtureVersion: "phase1-v1",
      fixtureHash: createHash("sha256")
        .update(JSON.stringify(fixturePages))
        .digest("hex"),
      browserUserAgent,
      nodeVersion: process.version,
      platform: process.platform,
      injectedFailure: options.injectFailure ?? false,
    };
    const reportPath = path.join(outputDir, "report.json");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return { ...report, reportPath };
  } finally {
    if (server.listening)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    await rm(profiles, { recursive: true, force: true });
  }
}

export async function runEvaluationCli(
  options: EvaluationOptions = {},
): Promise<void> {
  const report = await runFixtureEvals(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.taskCount || report.results.some((result) => !result.success))
    process.exitCode = 1;
}
