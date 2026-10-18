"""Record real terminal discovery commands against a controlled browser/model fixture."""
import codecs
import html
import json
import os
from pathlib import Path
import pty
import re
import select
import signal
import subprocess
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / '.chromeclaw/phase7-terminal'
OUTPUT.mkdir(parents=True, exist_ok=True)
ARTIFACTS = Path(tempfile.mkdtemp(prefix='attempt-', dir=OUTPUT))
FACT = 'The amber atlas capacity is 31 units.'
seen, checks, citations = [], [], []

class Fixture(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass
    def respond(self, value, content_type='text/html'):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.end_headers()
        self.wfile.write(value.encode())
    def do_GET(self):
        seen.append(self.path)
        if self.path.startswith('/search?'):
            self.respond('<a href="' + ORIGIN + '/source">Atlas capacity notes</a>')
        else:
            self.respond('<h1>Atlas notes</h1><p>' + FACT + '</p>')
    def do_POST(self):
        if self.path != '/v1/chat/completions':
            raise AssertionError('Unexpected fixture write')
        request = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        prompt = request['messages'][-1]['content']
        page = re.search(r'<untrusted provenance="page">\n(.*?)\n</untrusted>', prompt, re.S)
        observation = json.loads(html.unescape(page[1]))
        passage = next(p for p in observation['passages'] if p['text'] == FACT)
        reference = {'snapshotId': passage['snapshotId'], 'passageId': passage['id'], 'quote': FACT}
        citations.append(reference)
        if 'finish.webFind' in prompt:
            action = {'type': 'finish', 'answer': 'Ranked target', 'webFind': {'outcome': 'matches', 'matches': [{'url': ORIGIN + '/source', 'reason': 'Read the capacity notes', 'evidence': [reference]}]}}
        else:
            action = {'type': 'finish', 'answer': FACT, 'claims': [{'text': FACT, 'kind': 'extract', 'evidence': [reference]}]}
        self.respond(json.dumps({'choices': [{'message': {'content': json.dumps(action)}}]}), 'application/json')

server = ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
ORIGIN = 'http://127.0.0.1:' + str(server.server_port)
threading.Thread(target=server.serve_forever, daemon=True).start()
selected = ARTIFACTS / 'selected.json'
selected.write_text(json.dumps({'version': 1, 'entries': [{'url': ORIGIN + '/source', 'title': 'Atlas notes', 'visitedAt': '2026-10-10T00:00:00Z', 'kind': 'bookmark'}]}))
log_dir = ARTIFACTS / 'runs'
master, slave = pty.openpty()
env = dict(os.environ, TERM='xterm-256color', NO_COLOR='1')
command = ['node', str(ROOT / 'apps/cli/dist/index.js'), 'tui', '--provider', 'local', '--model', 'phase7-fixture', '--base-url', ORIGIN + '/v1', '--headless', '--allow-loopback', '--origin', ORIGIN, '--no-stream', '--log-dir', str(log_dir), '--timeout-ms', '120000']
process = subprocess.Popen(command, stdin=slave, stdout=slave, stderr=slave, cwd=ROOT, env=env, start_new_session=True)
os.close(slave)
started = time.monotonic()
text, events = '', []
decoder = codecs.getincrementaldecoder('utf8')('replace')
def pump():
    global text
    if select.select([master], [], [], .1)[0]:
        try:
            chunk = os.read(master, 65536)
        except OSError:
            return
        part = decoder.decode(chunk)
        text += part
        events.append([time.monotonic() - started, 'o', part])
def wait_for(predicate, reason):
    deadline = time.monotonic() + 45
    while not predicate() and time.monotonic() < deadline and process.poll() is None:
        pump()
    assert predicate(), reason + '\n' + text[-2000:]
def send(value):
    os.write(master, (value + '\n').encode())
def done_count():
    return text.count('"status":"done"')
try:
    wait_for(lambda: 'Task + Enter' in text, 'Terminal did not start')
    send('/origins ' + ORIGIN)
    wait_for(lambda: 'future task origins' in text, 'Explicit future scope control missing')
    checks.append({'id': 'future-scope-control', 'passed': True})
    for mode, cmd in [('research', '/research'), ('web', '/find-web'), ('history', '/find-history')]:
        count = done_count()
        scope = {'mode': mode, 'engineUrl': ORIGIN + '/search', 'queries': ['amber atlas capacity'], 'maxSources': 5} if mode != 'history' else {'mode': mode, 'catalog': str(selected), 'from': '2026-10-01T00:00:00Z', 'to': '2026-10-17T00:00:00Z', 'terms': ['atlas']}
        send(cmd + ' ' + json.dumps(scope))
        wait_for(lambda: done_count() > count, mode + ' did not complete')
        checks.append({'id': 'tui-' + mode, 'passed': True})
    send('/sources')
    wait_for(lambda: 'source 1' in text, 'No inspectable sources')
    history_file = next(file for file in log_dir.glob('*.jsonl') if json.loads(file.read_text().splitlines()[0])['payload'].get('discovery', {}).get('mode') == 'history')
    history_events = [json.loads(line) for line in history_file.read_text().splitlines()]
    passage_id = next(event['payload']['passages'][0]['id'] for event in history_events if event['type'] == 'observation' and event['payload'].get('passages'))
    send('/passage ' + passage_id)
    wait_for(lambda: 'passage {' in text, 'No inspectable passage')
    checks.append({'id': 'terminal-source-and-passage-inspection', 'passed': True})
    last_id = next(json.loads(file.read_text().splitlines()[0])["runId"] for file in log_dir.glob("*.jsonl") if json.loads(file.read_text().splitlines()[0])["payload"].get("discovery", {}).get("mode") == "history")
    send('/forget ' + last_id)
    wait_for(lambda: 'Run and retained source notes deleted.' in text, 'Forget did not complete')
    assert not (log_dir / (last_id + '.jsonl')).exists()
    checks.append({'id': 'terminal-forget-retained-notes', 'passed': True})
    send('/quit')
    deadline = time.monotonic() + 15
    while process.poll() is None and time.monotonic() < deadline:
        pump()
    assert process.poll() == 0, "Terminal quit failed while draining output"
    for mode in ['research', 'web', 'history']:
        arguments = ['--research'] if mode == 'research' else ['--find-web'] if mode == 'web' else ['--find-history', str(selected), '--from', '2026-10-01T00:00:00Z', '--to', '2026-10-17T00:00:00Z', '--terms', 'atlas']
        result = subprocess.run(['node', 'apps/cli/dist/index.js', 'run', 'amber atlas capacity', '--provider', 'local', '--model', 'phase7-fixture', '--base-url', ORIGIN + '/v1', '--headless', '--allow-loopback', '--origin', ORIGIN, '--log-dir', str(log_dir), '--json', '--search-engine', ORIGIN + '/search', *arguments], cwd=ROOT, env=env, capture_output=True, text=True, timeout=45)
        assert result.returncode == 0, result.stderr + result.stdout
        parsed = json.loads(result.stdout)
        assert parsed['status'] == 'done' and not parsed['permissions']['write']
        checks.append({'id': 'machine-cli-' + mode, 'passed': True})
finally:
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=10)
    os.close(master)
    server.shutdown()
    server.server_close()
    (ARTIFACTS / 'terminal.txt').write_text(text)
    with (ARTIFACTS / 'terminal.cast').open('w') as stream:
        stream.write(json.dumps({'version': 2, 'width': 100, 'height': 32, 'timestamp': int(time.time()), 'env': {'TERM': 'xterm-256color'}}) + '\n')
        for event in events:
            stream.write(json.dumps(event) + '\n')
    (ARTIFACTS / 'report.json').write_text(json.dumps({'checks': checks, 'browserRequests': seen, 'model': 'synthetic HTTP adapter; not model quality'}, indent=2) + '\n')
print(json.dumps({'checks': checks, 'artifacts': str(ARTIFACTS)}))
