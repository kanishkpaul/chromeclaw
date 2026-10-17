import assert from 'node:assert/strict';
import { argv } from 'node:process';
import { log } from 'node:console';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openBrowser, getPageSnapshot, getAccessibilitySnapshot, typeIntoTarget, pressKey, screenshot } from '../dist/index.js';
import { BrowserAgentRuntime } from '../../agent/dist/index.js';
import { summarizeObservation } from '../../shared/dist/index.js';

const output = path.resolve(argv[2] ?? '.chromeclaw/credential-safety');
const profiles = await mkdtemp(path.join(tmpdir(), 'chromeclaw-credentials-'));
await mkdir(output, { recursive: true });
const checks = [];
const record = (id) => checks.push({ id, passed: true });
const pageHtml = `<!doctype html><title>Plain form</title>
<label>Field<input id="password" type="password" value="SYNTHETIC_PASSWORD"></label>
<label>Field<input id="current" autocomplete="section-auth CURRENT-PASSWORD" value="SYNTHETIC_CURRENT"></label>
<label>Field<input id="new" autocomplete="section-auth new-password" value="SYNTHETIC_NEW"></label>
<label>Field<input id="otp" autocomplete="section-auth one-time-code" value="SYNTHETIC_OTP"></label>
<span id="code-label">Verification code</span><input id="labelled" aria-labelledby="code-label" value="SYNTHETIC_LABELLED">
<label>Password<textarea id="area">SYNTHETIC_AREA</textarea></label>
<label>City<input id="ordinary" value="original"></label>
<input id="flip" value="original" onfocus="this.type='password'">
<input id="replace" value="original" onfocus="this.outerHTML='<input id=replace type=password value=original>'">
<div id="shadow"></div><script>
window.changes=[];
document.querySelector('#ordinary').addEventListener('input',()=>window.changes.push('input'));
document.querySelector('#ordinary').addEventListener('change',()=>window.changes.push('change'));
document.querySelector('#shadow').attachShadow({mode:'open'}).innerHTML='<label>Field<input id=shadow-code autocomplete=one-time-code value=SYNTHETIC_SHADOW></label>';
</script>`;
let requests = 0;
const server = createServer((_request, response) => {
  requests += 1;
  response.setHeader('Content-Type', 'text/html');
  response.end(pageHtml);
});
let session;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  session = await openBrowser({ headless: true, profileDir: path.join(profiles, 'driver') });
  await session.page.goto(origin);
  const snapshot = await getPageSnapshot(session.page, { screenshotsDir: path.join(output, 'screenshots') });
  assert.ok(!JSON.stringify(snapshot).includes('SYNTHETIC_'));
  assert.ok(!summarizeObservation(snapshot).includes('SYNTHETIC_'));
  assert.ok(snapshot.interactiveElements.filter(node => node.isCredential).length >= 7);
  assert.equal(snapshot.screenshotPath, undefined);
  record('capture-and-prompt-withhold-credential-values');
  record('autocomplete-token-lists-labels-textarea-shadow-root');

  for (const id of ['password', 'current', 'new', 'otp', 'labelled', 'area', 'shadow-code']) {
    const locator = session.page.locator(`#${id}`);
    const original = await locator.inputValue();
    const result = await typeIntoTarget(session.page, { selector: `#${id}`, value: 'ATTEMPTED_VALUE' });
    assert.equal(result.refused, true, id);
    assert.equal(await locator.inputValue(), original);
    await locator.focus();
    for (const key of ['x', 'Control+V', 'Meta+V', 'Enter', 'Space']) {
      assert.equal((await pressKey(session.page, key)).refused, true, `${id} ${key}`);
    }
    assert.equal(await locator.inputValue(), original);
  }
  record('driver-refuses-credential-fill-without-policy');
  record('keyboard-character-paste-submit-refused');

  for (const id of ['flip', 'replace']) {
    assert.equal((await typeIntoTarget(session.page, { selector: `#${id}`, value: 'ATTEMPTED_VALUE' })).refused, true);
    assert.equal(await session.page.locator(`#${id}`).inputValue(), 'original');
  }
  record('focus-time-credential-change-and-node-replacement');

  const ordinary = await typeIntoTarget(session.page, { selector: '#ordinary', value: 'Kolkata' });
  assert.equal(typeof ordinary, 'string');
  assert.equal(await session.page.locator('#ordinary').inputValue(), 'Kolkata');
  assert.deepEqual(await session.page.evaluate(() => globalThis.changes), ['input', 'change']);
  const implicit = await typeIntoTarget(session.page, { selector: '#ordinary', value: 'WRONG', submit: true });
  assert.equal(implicit.refused, true);
  assert.equal(await session.page.locator('#ordinary').inputValue(), 'Kolkata');
  record('ordinary-native-setter-and-events-work');
  record('implicit-submit-refused-before-writing');

  await session.page.setContent(`<title>Unwritable fields</title>
    <input id=hidden type=hidden value=original><input id=readonly readonly value=original>
    <input id=disabled disabled value=original><div style="opacity:0"><input id=transparent value=original></div>
    <input id=covered value=original style="position:absolute;left:20px;top:120px">
    <div style="position:absolute;left:20px;top:120px;width:250px;height:30px;z-index:2">Cover</div>`);
  for (const id of ['hidden', 'readonly', 'disabled', 'transparent', 'covered']) {
    assert.equal((await typeIntoTarget(session.page, { selector: `#${id}`, value: 'WRONG' })).refused, true, id);
    assert.equal(await session.page.locator(`#${id}`).inputValue(), 'original');
  }
  record('hidden-covered-disabled-readonly-writes-refused');

  await session.page.setContent('<title>Frame fixture</title><iframe srcdoc="<input type=password value=SYNTHETIC_FRAME>"></iframe>');
  const child = session.page.frames().find(frame => frame !== session.page.mainFrame());
  assert.ok(child);
  await child.locator('input').focus();
  assert.equal((await pressKey(session.page, 'Meta+V')).refused, true);
  assert.equal(await child.locator('input').inputValue(), 'SYNTHETIC_FRAME');
  assert.equal(await screenshot(session.page, path.join(output, 'screenshots')), undefined);
  record('focused-frame-credentials-and-framed-screenshots');

  await session.page.setContent('<title>Safe accessibility</title><button>Read source</button>');
  assert.match(await getAccessibilitySnapshot(session.page), /button.*Read source/);
  await session.page.setContent('<title>Masked field</title><label>City<input value=MASK_THIS_FIELD_VALUE></label>');
  const masked = await screenshot(session.page, path.join(output, 'screenshots'));
  assert.ok(masked);
  record('safe-dom-accessibility-summary');
  record('noncredential-screenshot-field-mask');

  const runtimeFilesBefore = await readdir(path.join(output, 'runtime-screenshots')).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const actions = [{ type: 'navigate', url: origin },
    { type: 'type', selector: 'input', text: 'ATTEMPTED_VALUE', thoughtSummary: 'ATTEMPTED_VALUE' }];
  const run = await new BrowserAgentRuntime().run({
    task: 'Fill the generic field', headless: true, maxSteps: 3,
    profileDir: path.join(profiles, 'runtime'), logDir: path.join(output, 'runs'),
    screenshotsDir: path.join(output, 'runtime-screenshots'),
    onStep(step, liveRun) {
      if (step.action?.type === 'type') {
        assert.equal(liveRun.status, 'blocked');
        assert.equal(step.action.text, '[withheld]');
        assert.equal(step.thoughtSummary, undefined);
      }
    },
    planner: { name: 'credential-script', model: 'scripted-smoke-only', async plan() {
      const action = actions.shift();
      assert.ok(action);
      return action;
    } }
  });
  assert.equal(run.status, 'blocked');
  assert.match(run.finalAnswer, /Credential entry is refused/);
  const trace = await readFile(path.join(output, 'runs', `${run.id}.jsonl`), 'utf8');
  assert.ok(!trace.includes('SYNTHETIC_'));
  assert.ok(!trace.includes('ATTEMPTED_VALUE'));
  assert.ok(trace.includes('[withheld]'));
  assert.equal(run.steps[1].observation.screenshotPath, undefined);
  assert.equal((await readdir(path.join(output, 'runtime-screenshots'))).length, runtimeFilesBefore.length + 1);
  record('runtime-driver-refusal-is-blocked-not-done');
  record('trace-and-screenshots-exclude-synthetic-secrets');
  assert.ok(requests > 0);
  const report = { suite: 'credential-safety', planner: 'scripted', browser: session.context.browser()?.version(), checks, runId: run.id, maskedScreenshot: masked };
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  log(JSON.stringify(report, null, 2));
} finally {
  await session?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
  await rm(profiles, { recursive: true, force: true });
}
