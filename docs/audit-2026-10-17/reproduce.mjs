import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BrowserAgentRuntime, SafetyPolicy } from '../../packages/agent/dist/index.js';
import { openBrowser, getPageSnapshot, clickTarget } from '../../packages/browser/dist/index.js';
import { summarizeObservation } from '../../packages/shared/dist/index.js';
import { scoreRun } from '../../packages/evals/dist/index.js';

const output = path.resolve(process.argv[2] ?? 'docs/audit-2026-10-17/evidence');
await mkdir(output, { recursive: true });
const scratch = await mkdtemp(path.join(tmpdir(), 'chromeclaw-audit-'));
let commits = 0;
const server = createServer((request, response) => {
  if (request.url === '/commit') {
    commits += 1;
    response.end('recorded');
    return;
  }
  response.setHeader('Content-Type', 'text/html');
  response.end(`<!doctype html><title>Fixture</title>
    <p>${'ordinary content '.repeat(120)} EVIDENCE_AFTER_SUMMARY</p>
    <input id="field" type="password" value="SYNTHETIC_CREDENTIAL_ONLY">
    <button id="hidden" style="visibility:hidden">Invisible control</button>
    <button id="primary" onclick="fetch('/commit')">Confirm transfer</button>
    <button onclick="this.dataset.clicked='yes'">Choose</button>
    <button onclick="this.dataset.clicked='yes'">Choose</button>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const findings = [];
const record = (id, detail) => findings.push({ id, ...detail });
let session;
let runIndex = 0;

async function runScript(id, actions, task = 'Inspect the fixture', customPlan) {
  const inputs = [];
  let calls = 0;
  const planner = {
    name: 'audit-script', model: 'scripted-smoke-only',
    async plan(input) {
      inputs.push(input);
      calls += 1;
      if (customPlan) return customPlan(input, calls);
      const action = actions[calls - 1];
      assert.ok(action, 'audit script exhausted its actions');
      return action;
    }
  };
  const run = await new BrowserAgentRuntime().run({
    task, planner, headless: true, maxSteps: 5,
    profileDir: path.join(scratch, `runtime-${runIndex++}`),
    logDir: path.join(output, 'runs')
  });
  await writeFile(path.join(output, `${id}.json`), JSON.stringify({ run, inputs }, null, 2));
  return { run, inputs, calls };
}

try {
  session = await openBrowser({ headless: true, profileDir: path.join(scratch, 'capture') });
  await session.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await session.page.goto(base);
  const snapshot = await getPageSnapshot(session.page);
  assert.ok(snapshot.interactiveElements.some(node => node.text === 'SYNTHETIC_CREDENTIAL_ONLY'));
  record('credential-read', { reproduced: true, valuePresentInObservation: true });
  assert.ok(snapshot.interactiveElements.find(node => node.selector === '#hidden')?.isVisible);
  record('hidden-target', { reproduced: true, hiddenControlMarkedVisible: true });
  assert.match(snapshot.accessibilityTreeSummary, /unavailable/i);
  record('accessibility', { reproduced: true, message: snapshot.accessibilityTreeSummary });
  await clickTarget(session.page, { role: 'button', name: 'Choose' });
  assert.deepEqual(await session.page.getByRole('button', { name: 'Choose', exact: true }).evaluateAll(nodes => nodes.map(node => node.dataset.clicked ?? null)), ['yes', null]);
  record('duplicate-target', { reproduced: true, firstDuplicateClickedWithoutDisambiguation: true });
  await session.page.screenshot({ path: path.join(output, 'fixture.png') });
  await session.context.tracing.stop({ path: path.join(output, 'capture-trace.zip') });
  await writeFile(path.join(output, 'observation.json'), JSON.stringify(snapshot, null, 2));

  const policy = new SafetyPolicy();
  const credentialAction = { type: 'type', selector: '#field', text: 'SYNTHETIC_REPLACEMENT' };
  assert.equal(policy.assess(credentialAction, { task: 'Fill the field', observation: snapshot }).decision, 'allow');
  const credentialRun = await runScript('credential-write', [
    { type: 'navigate', url: base }, credentialAction, { type: 'finish', answer: 'Finished' }
  ], 'Fill the field');
  assert.equal(credentialRun.run.status, 'done');
  assert.ok(credentialRun.inputs[2].observation.interactiveElements.some(node => node.text === 'SYNTHETIC_REPLACEMENT'));
  record('credential-write', { reproduced: true, status: credentialRun.run.status });

  const commitRun = await runScript('ungated-commit', [
    { type: 'navigate', url: base }, { type: 'click', selector: '#primary' }, { type: 'finish', answer: 'Finished' }
  ]);
  assert.equal(commitRun.run.status, 'done');
  assert.equal(commits, 1);
  record('ungated-commit', { reproduced: true, independentlyRecordedCommits: commits });

  const ask = await runScript('ask-user', [
    { type: 'ask_user', question: 'Which option?' }, { type: 'finish', answer: 'Continued without an answer' }
  ]);
  assert.equal(ask.run.status, 'done');
  assert.equal(ask.calls, 2);
  assert.ok(!ask.inputs[1].recentSteps.includes('Which option?'));
  record('ask-user', { reproduced: true, plannerCalledAgainWithoutUserAnswer: true });

  const confirm = await runScript('confirmation', [{ type: 'click', selector: '#primary' }], 'Read postgres documentation');
  assert.equal(confirm.run.status, 'blocked');
  record('confirmation', { reproduced: true, harmlessTaskBlockedBeforeTargetResolution: true, completedAt: confirm.run.completedAt });

  const history = await runScript('history', [
    { type: 'navigate', url: base }, { type: 'extract_text' }, { type: 'finish', answer: 'Finished' }
  ]);
  assert.ok(history.run.steps[1].observationSummary.includes('EVIDENCE_AFTER_SUMMARY'));
  assert.ok(!history.inputs[2].observationSummary.includes('EVIDENCE_AFTER_SUMMARY'));
  assert.ok(!history.inputs[2].recentSteps.includes('EVIDENCE_AFTER_SUMMARY'));
  record('history', { reproduced: true, extractionResultMissingFromNextPlannerContext: true });

  const fabricated = await runScript('false-finish', [{ type: 'finish', answer: 'All requested page changes completed' }]);
  assert.equal(fabricated.run.status, 'done');
  assert.equal(fabricated.run.steps[0].observation.url, 'about:blank');
  record('false-finish', { reproduced: true, status: 'done', page: 'about:blank' });

  const malformed = await runScript('planner-error', [], 'Inspect the fixture', () => { throw new Error('synthetic malformed reply'); });
  assert.equal(malformed.run.status, 'failed');
  assert.equal(malformed.calls, 1);
  record('planner-error', { reproduced: true, callsBeforeTermination: malformed.calls });

  const blockedScore = scoreRun({ id: 'outcome', task: 'Complete a task', maxSteps: 3 }, confirm.run);
  assert.equal(blockedScore.success, true);
  record('blocked-score', { reproduced: true, blockedRunScoredAsSuccess: true });
  const echoScore = scoreRun({ id: 'echo', task: 'Find browser papers', maxSteps: 3, expectedSubstring: 'browser' }, {
    ...fabricated.run, finalAnswer: 'No papers were found',
    steps: [{ ...fabricated.run.steps[0], observationSummary: 'Search browser papers - Search engine' }]
  });
  assert.equal(echoScore.success, true);
  record('query-echo-score', { reproduced: true, searchTitleAloneScoredAsSuccess: true });

  const short = summarizeObservation({ ...snapshot, visibleText: 'short' });
  assert.ok(short.includes('SYNTHETIC_CREDENTIAL_ONLY'));
  record('credential-prompt', { reproduced: true, syntheticCredentialPresentInHostedPlannerSummaryOnShortPage: true });
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ auditedCommit: '50355b976c833f9bd9df3e0b8148d80a53205e00', browser: session.context.browser()?.version(), method: 'Local fixtures and injected scripted planners. No model-quality measurement.', findings }, null, 2));
  console.log(JSON.stringify({ output, reproduced: findings.length, findings }, null, 2));
} finally {
  await session?.close();
  await new Promise(resolve => server.close(resolve));
}
