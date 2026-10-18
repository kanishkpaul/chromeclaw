"""Stage 6: the compiled TUI in a real PTY, on real Chrome tasks, scored against independent outcomes.

The scripted lane selects a loopback emulator as an explicit local endpoint. Its replies are frozen
and measure terminal mechanics only. --actual-local uses the explicitly configured local model and
never falls back to the emulator or a hosted provider.
"""
import codecs
import fcntl
import html
import json
import os
from pathlib import Path
import pty
import re
import select
import signal
import struct
import subprocess
import sys
import tempfile
import termios
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[3]
ACTUAL = '--actual-local' in sys.argv
LOCAL_URL = os.environ.get('CHROMECLAW_TEST_LOCAL_URL')
LOCAL_MODEL = os.environ.get('CHROMECLAW_TEST_LOCAL_MODEL')
if ACTUAL and (not LOCAL_URL or not LOCAL_MODEL):
    raise RuntimeError('Actual-local Stage 6 needs explicit endpoint/model variables; no fallback.')
if not ACTUAL and (LOCAL_URL or LOCAL_MODEL):
    # Stage 4 lesson: local variables without the flag silently produced an emulator run.
    raise RuntimeError('Local endpoint variables were supplied without --actual-local; refusing an ambiguous run.')
MANIFEST = json.loads((ROOT / 'packages/agent/tests/fixtures/live-stage6.json').read_text())
CASES = {case['id']: case for case in MANIFEST['cases']}
OUTPUT = ROOT / '.chromeclaw/phase8-live'
OUTPUT.mkdir(parents=True, exist_ok=True)
ARTIFACTS = Path(tempfile.mkdtemp(prefix='stage6-local-' if ACTUAL else 'stage6-scripted-', dir=OUTPUT))
MODEL = LOCAL_MODEL if ACTUAL else 'synthetic-stage6-model'
results, started = [], time.monotonic()
held_request = threading.Event()


def normalize(text):
    return ' '.join(text.split())


def block(prompt, name):
    match = re.search(r'<untrusted provenance="' + name + r'">\n(.*?)\n</untrusted>', prompt, re.S)
    return json.loads(html.unescape(match[1]))


def owned_chrome():
    # Playwright launches Chrome with a pipe transport; a personal Chrome session never has it.
    listing = subprocess.run(['ps', '-axo', 'pid,command'], capture_output=True, text=True, check=True).stdout
    return [line.strip()[:160] for line in listing.splitlines() if '--remote-debugging-pipe' in line]


class Emulator(BaseHTTPRequestHandler):
    """Frozen scripted replies for the explicit loopback endpoint, plus the loopback save fixture."""
    typed, saves = set(), []

    def log_message(self, *_args):
        return  # Requests that matter are retained as durable run events and in `saves`.

    def reply(self, body, content_type='text/html'):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.end_headers()
        try:
            self.wfile.write(body.encode())
        except (BrokenPipeError, ConnectionResetError):
            pass  # Cancellation closes an intentionally held response.

    def do_GET(self):
        if self.path == '/form':
            return self.reply('<!doctype html><title>Stage 6 note</title><form method=post action=/save>'
                              '<label>Note <input name=note></label><button>Save note</button></form>')
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        body = self.rfile.read(int(self.headers['Content-Length']))
        if self.path == '/save':
            Emulator.saves.append({key: values[0] for key, values in parse_qs(body.decode(), keep_blank_values=True).items()})
            return self.reply('<!doctype html><title>Saved</title><p>Note saved for review.</p>')
        if ACTUAL:
            # The actual lane must never be served synthetic model replies.
            self.send_response(410)
            self.end_headers()
            return
        prompt = json.loads(body)['messages'][1]['content']
        task = json.loads(prompt.split('Trusted user task: ', 1)[1].split('\n', 1)[0])
        page, offered = block(prompt, 'page'), block(prompt, 'offered-targets')['targets']
        scenario = task.split()[0]
        if scenario == 'stage6-compose':
            held_request.set()
            time.sleep(30)
            action = {'type': 'wait', 'ms': 100}
        elif page['url'] == 'about:blank':
            action = {'type': 'navigate', 'url': 'https://httpbin.org/forms/post'}
        elif scenario == 'stage6-deny' and scenario not in Emulator.typed:
            Emulator.typed.add(scenario)
            target = next(t for t in offered if t.get('name', '').startswith('Delivery instructions'))
            action = {'type': 'type', 'target': target['number'], 'snapshotId': page['snapshotId'], 'text': 'STAGE6-UNSENT'}
        elif scenario == 'stage6-deny':
            target = next(t for t in offered if 'Submit' in t.get('name', ''))
            action = {'type': 'click', 'target': target['number'], 'snapshotId': page['snapshotId']}
        else:
            passage = max(page['passages'], key=lambda p: len(p['text']))
            action = {'type': 'finish', 'answer': passage['text'],
                      'evidence': [{'snapshotId': page['snapshotId'], 'passageId': passage['id'], 'quote': passage['text']}]}
        self.reply(json.dumps({'choices': [{'message': {'content': json.dumps(action)}, 'finish_reason': 'stop'}],
                               'usage': {'prompt_tokens': 8, 'completion_tokens': 8}}), 'application/json')


server = ThreadingHTTPServer(('127.0.0.1', 0), Emulator)
threading.Thread(target=server.serve_forever, daemon=True).start()
LOOPBACK = 'http://127.0.0.1:' + str(server.server_port)


class Terminal:
    def __init__(self, name, args, width=100):
        self.name, self.width, self.initial_width = name, width, width
        self.log_dir = ARTIFACTS / name / 'runs'
        self.log_dir.mkdir(parents=True)
        self.decoder = codecs.getincrementaldecoder('utf-8')(errors='replace')
        self.master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, width, 0, 0))
        env = {k: v for k, v in os.environ.items() if not k.startswith('CHROMECLAW_') and k not in ['OPENAI_API_KEY', 'HF_TOKEN', 'HUGGINGFACE_API_KEY', 'OPENAI_BASE_URL']}
        env.update(TERM='xterm-256color', NO_COLOR='1', DOTENV_CONFIG_PATH='/nonexistent-chromeclaw-env')
        if os.environ.get('STAGE_PW_DEBUG'):
            # Diagnostic only: one Playwright API log per terminal process, never scored.
            env.update(DEBUG='pw:api,pw:browser,pw:protocol', DEBUG_FILE=str(ARTIFACTS / (name + '-playwright.log')))
        endpoint = LOCAL_URL if ACTUAL else LOOPBACK + '/v1'
        command = ['node', str(ROOT / 'apps/cli/dist/index.js'), 'tui', '--provider', 'local', '--model', MODEL, '--base-url', endpoint,
                   '--no-stream', '--max-output-tokens', '1200', '--request-timeout-ms', '90000', '--timeout-ms', '300000',
                   '--log-dir', str(self.log_dir), *args]
        if ACTUAL:
            command.extend(['--response-format', 'llama-schema'])
        self.command = command
        self.process = subprocess.Popen(command, stdin=slave, stdout=slave, stderr=slave, cwd=tempfile.mkdtemp(prefix='chromeclaw-stage6-'), env=env, start_new_session=True)
        os.close(slave)
        self.text, self.events, self.started = '', [], time.monotonic()
        self.wait(lambda: 'ready' in self.plain(), 20)

    def drain(self, seconds=0.1):
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            if select.select([self.master], [], [], 0.05)[0]:
                try:
                    chunk = os.read(self.master, 65536)
                except OSError:
                    return
                if not chunk:
                    return
                decoded = self.decoder.decode(chunk)
                self.text += decoded
                self.events.append([round(time.monotonic() - self.started, 4), 'o', decoded])

    def plain(self):
        return re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', self.text).replace('\r', '')

    def wait(self, predicate, timeout):
        until = time.monotonic() + timeout
        while time.monotonic() < until:
            self.drain()
            if predicate():
                return
            if self.process.poll() is not None:
                break
        # Exit can race the predicate; inspect the final state once more.
        self.drain()
        if not predicate():
            raise AssertionError(f'{self.name}: expected state not reached; inspect the recording.')

    def send(self, line):
        mark = len(self.plain())
        self.events.append([round(time.monotonic() - self.started, 4), 'i', line + '\n'])
        os.write(self.master, (line + '\n').encode())
        return mark

    def key(self, data):
        self.events.append([round(time.monotonic() - self.started, 4), 'i', data.decode()])
        os.write(self.master, data)

    def resize(self, width, deliver_signal):
        self.width = width
        self.events.append([round(time.monotonic() - self.started, 4), 'r', f'{width}x40'])
        fcntl.ioctl(self.master, termios.TIOCSWINSZ, struct.pack('HHHH', 40, width, 0, 0))
        if deliver_signal:
            os.kill(self.process.pid, signal.SIGWINCH)
        self.drain(0.5)

    def records(self):
        events = []
        for file in sorted(self.log_dir.glob('*.jsonl')):
            # A concurrent append may expose an incomplete final record; read whole lines only.
            events.extend(json.loads(line) for line in file.read_text().split('\n')[:-1])
        return events

    def run_records(self, run_id):
        return [event for event in self.records() if event['runId'] == run_id]

    def new_run(self, prior):
        runs = [event['runId'] for event in self.records() if event['type'] == 'run_started' and event['runId'] not in prior]
        return runs[0] if runs else None

    def completion(self, run_id):
        return next((event['payload'] for event in self.run_records(run_id) if event['type'] == 'run_completed'), None)

    def pending(self, run_id, kind, exclude=()):
        states = [event['payload'] for event in self.run_records(run_id) if event['type'] == 'state']
        pending = states[-1].get('pending') if states else None
        return pending if pending and pending['kind'] == kind and pending['id'] not in exclude else None

    def rows(self, mark, prefix):
        # Rows are redrawn after the prompt; strip prompt residue before reading a row prefix.
        lines = [re.sub(r'^(❯ )+', '', line) for line in self.plain()[mark:].split('\n')]
        return [line[len(prefix):] for line in lines if line.startswith(prefix)]

    def widest(self, mark):
        lines = [re.sub(r'^(❯ )+', '', line) for line in self.plain()[mark:].split('\n')]
        return max((len(line) for line in lines), default=0)

    def close(self, eof=False):
        if self.process.poll() is None:
            self.key(b'\x04') if eof else self.send('/quit')
            try:
                self.wait(lambda: self.process.poll() is not None, 20)
            except AssertionError:
                self.process.kill()
                self.process.wait(timeout=5)
        self.drain()
        os.close(self.master)
        (ARTIFACTS / self.name / 'terminal.txt').write_text(self.plain())
        header = {'version': 2, 'width': self.initial_width, 'height': 40, 'title': 'ChromeClaw Stage 6: ' + self.name}
        (ARTIFACTS / self.name / 'terminal.cast').write_text('\n'.join(json.dumps(item, ensure_ascii=False) for item in [header] + self.events) + '\n')
        (ARTIFACTS / self.name / 'command.json').write_text(json.dumps(self.command, indent=2) + '\n')
        return self.process.returncode


def record(case_id, criteria, **detail):
    results.append({'id': case_id, 'lane': CASES[case_id]['lane'], 'passed': all(criteria.values()), 'criteria': criteria, **detail})


def scripted_deny_public_submit():
    case = CASES['scripted-deny-public-submit']
    terminal = Terminal('deny-public-submit', ['--origin', 'https://httpbin.org', '--write', '--allow-commit', '--max-steps', '8'])
    runs, criteria = [], {}
    try:
        # A denial stops its run (PHASE3.md), so the Esc denial uses a second run of the same task.
        for denial in ['enter', 'escape']:
            Emulator.typed.clear()
            prior = {event['runId'] for event in terminal.records()}
            terminal.send('stage6-deny ' + case['task'])
            terminal.wait(lambda: terminal.new_run(prior), 20)
            run_id = terminal.new_run(prior)
            terminal.wait(lambda: terminal.pending(run_id, 'approval'), 60)
            pending = terminal.pending(run_id, 'approval')
            terminal.wait(lambda: '/approve ' + pending['id'] in terminal.plain(), 10)
            if denial == 'enter':
                criteria['cardShowsDurablePendingId'] = pending['proposal']['action']['type'] == 'click' and 'Submit' in (pending['proposal'].get('targetName') or '')
                # Safety rail: this case never sends a currently valid approval to a public site.
                mark = terminal.send('/approve not-' + pending['id'])
                terminal.wait(lambda: 'Copy the current pending ID' in terminal.plain()[mark:], 10)
                terminal.drain(1)
                criteria['wrongIdRefusedAndStillPending'] = (terminal.pending(run_id, 'approval') or {}).get('id') == pending['id']
                terminal.send('')
            else:
                terminal.key(b'\x1b')
            terminal.wait(lambda: terminal.completion(run_id), 30)
            # The durable record lands before the TUI settles; its result row ends the busy state.
            terminal.wait(lambda: run_id in ''.join(terminal.rows(0, '  result ')), 30)
            runs.append(run_id)
        events = [event for run_id in runs for event in terminal.run_records(run_id)]
        gates = [event['payload']['gate'] for event in events if event['type'] == 'gate']
        acts = [event['payload']['action'] for event in events if event['type'] == 'act_started']
        urls = [event['payload']['url'] for event in events if event['type'] == 'observation']
        criteria['enterAndEscDenied'] = [terminal.completion(run_id)['status'] for run_id in runs] == ['blocked', 'blocked'] and sum(1 for gate in gates if gate.get('reason') == 'The exact action was denied.') == 2
        criteria['noActivationOrNavigationAway'] = not any(act['type'] == 'click' for act in acts) and all(url in ['about:blank', case['url']] for url in urls)
        record(case['id'], criteria, runIds=runs, acts=[act['type'] for act in acts], observationUrls=urls, gates=gates)
    finally:
        terminal.close()


def scripted_long_output_and_resize():
    case = CASES['scripted-long-output-and-narrow-resize']
    with urlopen(case['url'], timeout=20) as response:
        page = response.read().decode()
    expected = normalize(html.unescape(re.sub(r'<[^>]+>', '', re.search(r'<p>(.*?)</p>', page, re.S)[1])))
    (ARTIFACTS / 'long-output-expected.txt').write_text(expected + '\n')
    terminal = Terminal('long-output-resize', ['--origin', 'https://httpbin.org', '--max-steps', '4'])
    try:
        mark = terminal.send('/ask ' + case['url'] + ' stage6-long ' + case['task'])
        terminal.wait(lambda: terminal.new_run(set()) and terminal.completion(terminal.new_run(set())), 90)
        run_id = terminal.new_run(set())
        terminal.wait(lambda: terminal.rows(mark, '  result ') and terminal.rows(mark, '  result ')[-1].endswith('}'), 10)
        done = terminal.completion(run_id)
        shown = json.loads(''.join(terminal.rows(mark, '  result ')))
        # Rendering fidelity and capture completeness are reported apart; the frozen criterion needs both.
        rows_equal_durable = shown['answer'] == done['finalAnswer']
        durable_equals_independent = normalize(done['finalAnswer'] or '') == expected
        # The earlier live harnesses resized with TIOCSWINSZ alone; record whether that reached Node.
        terminal.resize(48, deliver_signal=False)
        mark = terminal.send('/sources')
        terminal.drain(1)
        ioctl_only_width = terminal.widest(mark)
        mark = len(terminal.plain())
        terminal.resize(48, deliver_signal=True)
        terminal.drain(1)
        narrow_status = any(re.fullmatch(r'(❯ )* \S+ │ done', line) for line in terminal.plain()[mark:].split('\n'))
        mark = terminal.send('/source 1')
        terminal.drain(2)
        observation = next(event['payload'] for event in terminal.run_records(run_id) if event['type'] == 'observation')
        durable = json.dumps(observation, ensure_ascii=False, separators=(',', ':'))
        displayed = ''.join(terminal.rows(mark, '  source '))
        shortened_notice = 'shortened' in terminal.plain()[mark:].lower() or 'truncated' in terminal.plain()[mark:].lower()
        record(case['id'], {
            'doneWithRuntimeCitation': done['status'] == 'done',
            'rowsReproduceFullAnswer': rows_equal_durable and durable_equals_independent,
            'narrowStatusAfterSignal': narrow_status,
            'rowsWithinNarrowWidth': terminal.widest(mark) <= 48,
            'sourceCompleteOrMarkedShortened': displayed == durable or shortened_notice,
        }, runId=run_id, rowsEqualDurableAnswer=rows_equal_durable, durableAnswerEqualsIndependentText=durable_equals_independent,
            capturedOmittedPassages=observation.get('omittedPassages'), expectedChars=len(expected),
            answerChars=len(done['finalAnswer'] or ''), ioctlOnlyWidestRow=ioctl_only_width,
            ioctlOnlyReachedNode=ioctl_only_width <= 48, sourceDurableChars=len(durable), sourceDisplayedChars=len(displayed))
    finally:
        terminal.close()


def scripted_compose_interrupt_and_eof():
    case = CASES['scripted-compose-interrupt-and-eof']
    before = owned_chrome()
    terminal = Terminal('compose-interrupt-eof', ['--origin', 'https://httpbin.org', '--max-steps', '4'])
    lines = ['stage6-compose Read https://httpbin.org/robots.txt', 'Quote its complete visible text with its captured passage citation.']
    terminal.send('/compose')
    for line in lines:
        terminal.send(line)
    mark = terminal.send('/discard')
    terminal.wait(lambda: 'Draft discarded.' in terminal.plain()[mark:], 10)
    terminal.drain(1)
    discarded = terminal.new_run(set()) is None
    terminal.send('/compose')
    for line in lines:
        terminal.send(line)
    terminal.send('/send')
    terminal.wait(lambda: held_request.is_set() and terminal.new_run(set()), 60)
    run_id = terminal.new_run(set())
    terminal.wait(lambda: any(event['type'] == 'crossing' for event in terminal.run_records(run_id)), 10)
    terminal.key(b'\x03')
    terminal.wait(lambda: terminal.completion(run_id), 30)
    mark = terminal.send('/help')
    terminal.wait(lambda: 'Task + Enter' in terminal.plain()[mark:], 10)
    events = terminal.run_records(run_id)
    crossing = next(index for index, event in enumerate(events) if event['type'] == 'crossing')
    runs = {event['runId'] for event in terminal.records() if event['type'] == 'run_started'}
    task = next(event['payload']['task'] for event in events if event['type'] == 'run_started')
    exit_code = terminal.close(eof=True)
    time.sleep(3)
    leftover = [line for line in owned_chrome() if line not in before]
    record(case['id'], {
        'discardStartsNoRun': discarded,
        'sendStartsOneRunWithBothLines': len(runs) == 1 and task == '\n'.join(lines),
        'ctrlCStopsWithoutLaterAct': terminal.completion(run_id)['status'] == 'stopped' and not any(event['type'] in ['proposal', 'act_started'] for event in events[crossing + 1:]),
        'promptReturnsAfterInterrupt': True,
        'eofExitsCleanlyWithoutOwnedChrome': exit_code == 0 and not leftover,
    }, runId=run_id, exitCode=exit_code, leftoverChrome=leftover)


def local_read_find_and_inspect():
    ask, find, inspect = CASES['local-ask-held-out-public-page'], CASES['local-find-held-out-public-link'], CASES['local-inspect-sources-and-open-cited-passage']
    terminal = Terminal('local-read-find-inspect', ['--origin', 'https://info.cern.ch', '--max-steps', '4'])
    try:
        terminal.send('/ask ' + ask['url'] + ' ' + ask['task'])
        terminal.wait(lambda: terminal.new_run(set()) and terminal.completion(terminal.new_run(set())), 330)
        ask_run = terminal.new_run(set())
        done = terminal.completion(ask_run)
        record(ask['id'], {
            'doneWithRuntimeCitation': done['status'] == 'done',
            'answerContainsFrozenSentence': normalize(ask['expected']) in normalize(done.get('finalAnswer') or ''),
        }, runId=ask_run, status=done['status'], answer=done.get('finalAnswer'), error=done.get('error'))
        events = terminal.run_records(ask_run)
        finish = next((event['payload']['action'] for event in reversed(events) if event['type'] == 'step' and event['payload'].get('action', {}).get('type') == 'finish'), {})
        cited = next((reference for reference in finish.get('evidence', []) if reference.get('passageId')), None)
        terminal.drain(2)
        if done['status'] != 'done' or not cited:
            record(inspect['id'], {'skippedBecauseNoCitation': False}, skipped=True, runId=ask_run)
        else:
            observation_url = next(event['payload']['url'] for event in events if event['type'] == 'observation' and event['payload']['snapshotId'] == cited['snapshotId'])
            mark = terminal.send('/history')
            terminal.drain(1)
            for command in ['/sources', '/source 1', '/passage ' + cited['passageId']]:
                terminal.send(command)
                terminal.drain(1)
            open_mark = terminal.send('/open ' + cited['passageId'])
            terminal.wait(lambda: terminal.rows(open_mark, '  opened source ') or 'Source window could not' in terminal.plain()[open_mark:], 60)
            opened = terminal.rows(open_mark, '  opened source ')
            close_mark = terminal.send('/close-source')
            terminal.wait(lambda: 'Source window closed.' in terminal.plain()[close_mark:] or 'cleanup failed' in terminal.plain()[close_mark:], 30)
            for command in ['/trace', '/settings']:
                terminal.send(command)
                terminal.drain(1)
            segment = terminal.plain()[mark:]
            record(inspect['id'], {
                'commandsRenderWithoutErrorRows': not re.search(r'^(❯ )*(  error |error: )', segment, re.M) and 'Trace unavailable' not in segment and 'Choose a' not in segment,
                'openedUrlEqualsCitedObservation': bool(opened) and json.loads(''.join(opened)) == observation_url,
                'sourceWindowClosed': 'Source window closed.' in segment,
            }, runId=ask_run, citedUrl=observation_url, opened=opened)
        prior = {event['runId'] for event in terminal.records()}
        terminal.send('/find ' + find['url'] + ' ' + find['task'])
        terminal.wait(lambda: terminal.new_run(prior) and terminal.completion(terminal.new_run(prior)), 330)
        find_run = terminal.new_run(prior)
        found = terminal.completion(find_run)
        events = terminal.run_records(find_run)
        finish = next((event['payload']['action'] for event in reversed(events) if event['type'] == 'step' and event['payload'].get('action', {}).get('type') == 'finish'), {})
        matches = (finish.get('pageFind') or {}).get('matches') or []
        observations = {event['payload']['snapshotId']: event['payload'] for event in events if event['type'] == 'observation'}
        first = matches[0] if matches else {}
        element = next((node for node in observations.get(first.get('snapshotId'), {}).get('interactiveElements', []) if node.get('number') == first.get('target')), {})
        acts = [event['payload']['action'] for event in events if event['type'] == 'act_started']
        record(find['id'], {
            'doneWithValidatedMatch': found['status'] == 'done' and bool(matches),
            'firstMatchIsPeopleLink': element.get('name', '').strip() == find['expected']['name'] and find['expected']['href'] in [element.get('href'), element.get('destination')],
            'noActivationOrLaterNavigation': [act['type'] for act in acts] == ['navigate'],
        }, runId=find_run, status=found['status'], firstMatch=first, element={k: element.get(k) for k in ['name', 'role', 'href', 'destination']}, error=found.get('error'))
    finally:
        terminal.close()


def local_loopback_save():
    case = CASES['local-edit-and-approved-save-on-loopback-fixture']
    terminal = Terminal('local-loopback-save', ['--origin', LOOPBACK, '--allow-loopback', '--write', '--allow-commit', '--max-steps', '8'])
    approvals, denials, interventions = [], [], []
    try:
        # The fixture address is harness-supplied location, not part of the frozen task or criteria.
        terminal.send('Open ' + LOOPBACK + '/form. ' + case['task'])
        terminal.wait(lambda: terminal.new_run(set()), 20)
        run_id = terminal.new_run(set())
        seen = set()
        deadline = time.monotonic() + 600
        while time.monotonic() < deadline and not terminal.completion(run_id):
            terminal.drain(0.2)
            approval = terminal.pending(run_id, 'approval', seen)
            answer = terminal.pending(run_id, 'answer', seen)
            if approval:
                seen.add(approval['id'])
                terminal.wait(lambda: '/approve ' + approval['id'] in terminal.plain(), 10)
                acts = [event['payload']['action'] for event in terminal.run_records(run_id) if event['type'] == 'act_started']
                proposal = approval['proposal']
                # Operator policy, fixed before the run: approve one Save note click after a field write.
                if proposal['action']['type'] == 'click' and proposal.get('targetName') == 'Save note' and any(act['type'] == 'type' for act in acts) and not approvals:
                    approvals.append(approval['id'])
                    terminal.send('/approve ' + approval['id'])
                else:
                    denials.append({'id': approval['id'], 'action': proposal['action'], 'targetName': proposal.get('targetName')})
                    terminal.send('/deny')
            elif answer:
                seen.add(answer['id'])
                interventions.append({'question': answer.get('question'), 'response': '/cancel'})
                terminal.send('/cancel')
        if not terminal.completion(run_id):
            terminal.send('/cancel')
            terminal.wait(lambda: terminal.completion(run_id), 30)
        done = terminal.completion(run_id)
        acts = [event['payload']['action'] for event in terminal.run_records(run_id) if event['type'] == 'act_started']
        type_acts = [act for act in acts if act['type'] == 'type']
        record(case['id'], {
            'serverRecordsExactlyOneCorrectSave': Emulator.saves == [{'note': 'STAGE6-LOCAL-NOTE'}],
            'saveOnlyAfterExactApproval': len(approvals) == 1,
            'noRepeatedWriteOrSecondSave': len(type_acts) == 1 and not any(d['targetName'] == 'Save note' for d in denials),
        }, runId=run_id, status=done['status'], answer=done.get('finalAnswer'), error=done.get('error'), saves=Emulator.saves,
            approvals=approvals, denials=denials, interventions=interventions, acts=[act['type'] for act in acts])
    finally:
        terminal.close()


try:
    for scenario in ([local_read_find_and_inspect, local_loopback_save] if ACTUAL else
                     [scripted_deny_public_submit, scripted_long_output_and_resize, scripted_compose_interrupt_and_eof]):
        try:
            scenario()
        except Exception as error:  # noqa: BLE001 - every attempt is retained, including harness failures.
            results.append({'id': scenario.__name__, 'passed': False, 'harnessError': repr(error)})
finally:
    server.shutdown()
    server.server_close()
    (ARTIFACTS / 'report.json').write_text(json.dumps({
        'suite': 'live-01-stage6-terminal', 'lane': 'actualLocal' if ACTUAL else 'scripted', 'actualLocal': ACTUAL,
        'hostedInference': False, 'model': MODEL, 'manifestSha256': __import__('hashlib').sha256((ROOT / 'packages/agent/tests/fixtures/live-stage6.json').read_bytes()).hexdigest(),
        'results': results, 'leftoverOwnedChrome': owned_chrome(), 'latencyMs': round((time.monotonic() - started) * 1000)}, indent=2) + '\n')
print(ARTIFACTS)
assert results and all(result['passed'] for result in results)
