"""Drive the compiled terminal through a real PTY and independently scored Chrome fixtures."""
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
import shutil
import struct
import subprocess
import tempfile
import termios
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.chromeclaw/phase5-terminal'
OUTPUT.mkdir(parents=True, exist_ok=True)
ARTIFACTS = Path(tempfile.mkdtemp(prefix='attempt-', dir=OUTPUT))
ANSWER = 'The fixture launch year is 2042.'
INJECTION = 'INJECT_MARK\x1b[2J\rFAKE_GATE\x1b]52;c;stolen\x07\u202e'
saved, checks, sessions = [], [], []
counts = {}
slow_request = threading.Event()


def block(prompt, name):
    match = re.search(r'<untrusted provenance="' + name + r'">\n(.*?)\n</untrusted>', prompt, re.S)
    return json.loads(html.unescape(match[1]))


class Fixture(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def send(self, text, content_type='text/html'):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.end_headers()
        try:
            self.wfile.write(text.encode())
        except (BrokenPipeError, ConnectionResetError):
            pass  # Cancellation closes an intentionally waiting fixture response.

    def do_GET(self):
        self.send('<title>City</title><form method=post action=/saved><label>City<input name=city></label><button>Save</button></form>'
                  if self.path == '/form' else '<title>Launch fact</title><p>' + ANSWER + '</p>')

    def do_POST(self):
        body = self.rfile.read(int(self.headers['Content-Length']))
        if self.path == '/saved':
            saved.append(parse_qs(body.decode()).get('city', [None])[0])
            self.send('<title>Saved</title><p>The city was saved.</p>')
            return
        payload = json.loads(body)
        assert payload["model"] == "synthetic-tui-model", "Reopen changed the saved model"
        prompt = payload['messages'][1]['content']
        task = json.loads(prompt.split('Trusted user task: ', 1)[1].split('\n', 1)[0])
        scenario = task.split()[0]
        counts[scenario] = counts.get(scenario, 0) + 1
        page, offered = block(prompt, 'page'), block(prompt, 'offered-targets')
        if scenario == 'slow-fixture':
            slow_request.set()
            time.sleep(5)
            return
        if page['url'] == 'about:blank':
            action = {'type': 'navigate', 'url': endpoint + ('/form' if scenario in ['form-fixture', 'approved-fixture', 'restart-fixture'] else '/read')}
        elif scenario == 'pause-fixture' and counts[scenario] == 2:
            action = {'type': 'wait', 'ms': 1500}
        elif scenario == 'injection-fixture':
            action = {'type': 'ask_user', 'question': INJECTION}
        elif scenario == 'ask-fixture' and counts[scenario] == 2:
            action = {'type': 'ask_user', 'question': 'Which city should I use?'}
        elif scenario in ['form-fixture', 'approved-fixture', 'restart-fixture'] and page['url'].endswith('/form'):
            if counts[scenario] == 2:
                action = {'type': 'type', 'target': 1, 'snapshotId': page['snapshotId'], 'text': 'Kolkata'}
            else:
                action = {'type': 'click', 'target': 2, 'snapshotId': page['snapshotId']}
        elif scenario in ['form-fixture', 'approved-fixture', 'restart-fixture']:
            action = {'type': 'finish', 'answer': 'The city was saved.', 'evidence': [{'snapshotId': page['snapshotId'], 'quote': 'The city was saved.'}]}
        else:
            action = {'type': 'finish', 'answer': ANSWER, 'evidence': [{'snapshotId': page['snapshotId'], 'quote': ANSWER}]}
        self.send(json.dumps({'choices': [{'message': {'content': json.dumps(action)}, 'finish_reason': 'stop'}],
                              'usage': {'prompt_tokens': 8, 'completion_tokens': 8}}), 'application/json')


server = ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
threading.Thread(target=server.serve_forever, daemon=True).start()
endpoint = 'http://127.0.0.1:' + str(server.server_port)


class Terminal:
    def __init__(self, name, width=100, no_color=False, cwd=None, log_dir=None):
        self.name, self.width, self.initial_width = name, width, width
        self.decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        self.owns_work = cwd is None
        self.work = Path(cwd or tempfile.mkdtemp(prefix='chromeclaw-tui-'))
        self.master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, width, 0, 0))
        clean = {k: v for k, v in os.environ.items() if not k.startswith('CHROMECLAW_') and k not in ['OPENAI_API_KEY', 'HF_TOKEN', 'NO_COLOR']}
        clean.update(TERM='xterm-256color', COLORTERM='truecolor', DOTENV_CONFIG_PATH='/nonexistent-chromeclaw-env')
        if no_color:
            clean['NO_COLOR'] = '1'
        self.log_dir = Path(log_dir) if log_dir else ARTIFACTS / name / 'runs'
        command = ['node', str(ROOT / 'apps/cli/dist/index.js'), 'tui', '--provider', 'local', '--model', 'synthetic-tui-model',
                   '--base-url', endpoint + '/v1', '--origin', endpoint, '--allow-loopback', '--write', '--allow-commit',
                   '--headless', '--timeout-ms', '300000', '--log-dir', str(self.log_dir)]
        self.process = subprocess.Popen(command, stdin=slave, stdout=slave, stderr=slave, cwd=self.work, env=clean, start_new_session=True)
        os.close(slave)
        self.text, self.events = '', []
        self.started = time.monotonic()
        self.wait('ready')
        sessions.append(self)

    def drain(self, seconds=0.1):
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            if select.select([self.master], [], [], min(0.1, max(0, until - time.monotonic())))[0]:
                try:
                    chunk = os.read(self.master, 65536)
                except OSError:
                    break
                if not chunk:
                    break
                text = self.decoder.decode(chunk)
                self.text += text
                self.events.append([round(time.monotonic() - self.started, 4), 'o', text])

    def wait(self, text, start=0, timeout=30):
        until = time.monotonic() + timeout
        while time.monotonic() < until:
            # ANSI styling and wrapping belong to the renderer; assertions inspect readable text.
            if text in self.plain()[start:]:
                return
            self.drain()
            if self.process.poll() is not None:
                break
        raise AssertionError(f'{self.name}: missing {text!r}\n' + self.plain()[-2500:])

    def plain(self):
        return re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', self.text).replace('\r', '')

    def send(self, line):
        start = len(self.plain())
        os.write(self.master, (line + '\n').encode())
        return start

    def pending(self):
        # The authoritative pending ID is durable runtime state, not text copied from the model.
        until = time.monotonic() + 20
        while time.monotonic() < until:
            self.drain()
            for file in self.log_dir.glob('*.jsonl'):
                for line in reversed(file.read_text().splitlines()):
                    event = json.loads(line)
                    if event['type'] == 'state' and event['payload'].get('pending', {}).get('kind') == 'approval':
                        pending = event['payload']['pending']
                        if pending['id'] not in getattr(self, 'used_pending', set()):
                            self.used_pending = getattr(self, 'used_pending', set()) | {pending['id']}
                            self.wait('/approve ')
                            return event['runId'], pending['id']
            time.sleep(0.05)
        raise AssertionError('No pending approval')

    def resize(self, width):
        self.width = width
        self.events.append([round(time.monotonic() - self.started, 4), 'r', f'{width}x40'])
        fcntl.ioctl(self.master, termios.TIOCSWINSZ, struct.pack('HHHH', 40, width, 0, 0))
        os.kill(self.process.pid, signal.SIGWINCH)
        self.drain()

    def close(self, eof=False):
        if self.process.poll() is None:
            if eof:
                os.write(self.master, b'\x04')
            else:
                self.send('/quit\nignored-after-close-fixture')
            until = time.monotonic() + 15
            while self.process.poll() is None and time.monotonic() < until:
                self.drain()
            if self.process.poll() is None:
                self.process.kill()
                raise AssertionError('Terminal did not close')
        self.drain()
        os.close(self.master)
        assert self.process.returncode == 0, (self.name, self.process.returncode)
        self.archive()

    def archive(self):
        (ARTIFACTS / (self.name + '.txt')).write_text(self.plain())
        header = {'version': 2, 'width': self.initial_width, 'height': 40, 'env': {'TERM': 'xterm-256color'}, 'title': 'ChromeClaw synthetic fixture: ' + self.name}
        (ARTIFACTS / (self.name + '.cast')).write_text('\n'.join(json.dumps(x, ensure_ascii=False) for x in [header] + self.events) + '\n')


def record(name):
    checks.append({'id': name, 'passed': True})


try:
    terminal = Terminal('controls')
    terminal.send('/compose')
    terminal.wait('Compose multiple lines')
    terminal.send('ask-fixture')
    terminal.send('Read the launch fact.')
    terminal.send('/send')
    terminal.wait('Which city should I use?')
    terminal.send('/answer Kolkata')
    terminal.wait('"status":"done"')
    record('multiline-task-live-steps-answer-and-independent-known-fact')
    terminal.send('/settings')
    terminal.wait('"keyConfigured":false')
    terminal.send('/sources')
    terminal.wait('source 1')
    terminal.send('/source 1')
    terminal.wait('"visibleText":')
    terminal.send('/history')
    terminal.send('/trace')
    terminal.wait('trace crossing')
    record('key-free-settings-history-source-and-durable-crossing-inspection')
    start = terminal.send('pause-fixture')
    until = time.monotonic() + 20
    while counts.get('pause-fixture', 0) < 2 and time.monotonic() < until:
        terminal.drain()
    terminal.send('/pause')
    terminal.wait('Paused.', start)
    assert counts['pause-fixture'] == 2
    terminal.send('/continue')
    terminal.wait('"status":"done"', start)
    record('pause-stops-before-another-model-call-and-continue-recaptures')
    terminal.send('form-fixture')
    run_id, pending_id = terminal.pending()
    start = terminal.send('')
    terminal.wait('\"status\":\"blocked\"', start)
    assert saved == [], saved
    start = terminal.send('approved-fixture')
    _, next_id = terminal.pending()
    assert next_id != pending_id
    terminal.send('/approve ' + pending_id)
    terminal.drain(0.2)
    assert saved == [], saved
    terminal.send('/approve ' + next_id)
    terminal.wait('"status":"done"', start)
    assert saved == ['Kolkata'], saved
    record('enter-denies-stale-id-refuses-and-one-exact-approval-saves-correct-city')
    start = terminal.send('injection-fixture')
    terminal.wait('INJECT_MARK', start)
    assert '\x1b[2J' not in terminal.text and '\x1b]52;' not in terminal.text
    assert '\\u001b' in terminal.plain()[start:]
    terminal.send('/cancel')
    terminal.wait('"status":"stopped"', start)
    record('model-terminal-controls-stay-visible-data-and-cannot-spoof-gates')
    start = terminal.send('slow-fixture')
    assert slow_request.wait(15)
    os.write(terminal.master, b'\x03')
    terminal.wait('"status":"stopped"', start)
    terminal.close()
    record('ctrl-c-cancels-http-and-preserves-session')

    narrow = Terminal('narrow-no-color', width=40, no_color=True)
    assert '⋔ ChromeClaw' in narrow.plain()
    assert not re.search(r'\x1b\[[0-9;]*m', narrow.text)
    narrow.resize(60)
    start = narrow.send('restart-fixture')
    interrupted_id, old_pending = narrow.pending()
    narrow.close(eof=True)
    assert saved == ['Kolkata']
    record('narrow-resize-no-color-and-eof-cancel-without-commit')
    reopened = Terminal('reopened', width=60, no_color=True, cwd=narrow.work, log_dir=narrow.log_dir)
    reopened.send('/model future-model')
    reopened.wait('future-model')
    start = reopened.send('/resume ' + interrupted_id)
    reopened.wait('Paused.', start)
    before = counts['restart-fixture']
    reopened.send('/approve ' + old_pending)
    reopened.drain(0.2)
    assert counts['restart-fixture'] == before and saved == ['Kolkata']
    reopened.send('/continue')
    reopened.wait('Approve once?', start)
    _, fresh_id = reopened.pending()
    assert fresh_id != old_pending
    os.write(reopened.master, b'\x1b')
    reopened.wait('"status":"blocked"', start)
    reopened.close()
    assert saved == ['Kolkata']
    record('reopen-pauses-before-planning-and-rejects-stale-approval')

    pipe = subprocess.run(['node', str(ROOT / 'apps/cli/dist/index.js'), 'tui'], input='form-fixture\n', capture_output=True, text=True)
    assert pipe.returncode == 2 and 'interactive terminal' in pipe.stdout and '\x1b' not in pipe.stdout
    record('noninteractive-tui-refuses-without-opening-browser')
    assert counts.get('ignored-after-close-fixture', 0) == 0
    report = {'suite': 'phase5-terminal-start', 'checks': checks, 'savedCities': saved, 'evidenceDir': ARTIFACTS.name,
              'planner': 'synthetic-loopback-http', 'modelRequests': counts,
              'limitations': ['No actual hosted/local inference in this terminal fixture.', 'Owned ChromeClaw profile only; personal-session attachment is unmeasured.', 'Streaming token replies and 20-task ask acceptance remain open.']}
    (ARTIFACTS / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    (OUTPUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
finally:
    for terminal in sessions:
        terminal.archive()
        if terminal.process.poll() is None:
            terminal.process.terminate()
            try:
                terminal.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                # Each fixture starts a private process group; never target a user's browser.
                os.killpg(terminal.process.pid, signal.SIGKILL)
                terminal.process.wait(timeout=5)
    for terminal in sessions:
        if terminal.owns_work:
            shutil.rmtree(terminal.work, ignore_errors=True)
    server.shutdown()
