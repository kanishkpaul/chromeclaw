"""Record the README's terminal images from the compiled TUI in a real PTY, in colour.

  python3 docs/media/record.py local    # actual local model: cited ask and find on info.cern.ch
  python3 docs/media/record.py gate     # loopback emulator replies: a submit held at the gate, denied

`local` needs CHROMECLAW_TEST_LOCAL_URL and CHROMECLAW_TEST_LOCAL_MODEL, exactly as the Phase 8
harnesses do. `gate` never sends a valid approval: Enter denies, so httpbin receives nothing.
Each run writes docs/media/<name>.cast; render.py turns a cast into the page images.
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
import struct
import subprocess
import sys
import tempfile
import termios
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[2]
SCENE = sys.argv[1] if len(sys.argv) > 1 else ''
if SCENE not in ('local', 'gate'):
    raise SystemExit('Choose local or gate.')
COLUMNS, ROWS = 104, 40
CERN = 'https://info.cern.ch/hypertext/WWW/TheProject.html'


def block(prompt, name):
    match = re.search(r'<untrusted provenance="' + name + r'">\n(.*?)\n</untrusted>', prompt, re.S)
    return json.loads(html.unescape(match[1]))


class Emulator(BaseHTTPRequestHandler):
    """Frozen replies for the gate scene only: navigate, type, then propose the submit button."""
    typed = False

    def log_message(self, *_args):
        return  # The run's own JSONL records every request that matters.

    def do_POST(self):
        prompt = json.loads(self.rfile.read(int(self.headers['Content-Length'])))['messages'][1]['content']
        page, offered = block(prompt, 'page'), block(prompt, 'offered-targets')['targets']
        if page['url'] == 'about:blank':
            action = {'type': 'navigate', 'url': 'https://httpbin.org/forms/post'}
        elif not Emulator.typed:
            Emulator.typed = True
            target = next(t for t in offered if t.get('name', '').startswith('Delivery instructions'))
            action = {'type': 'type', 'target': target['number'], 'snapshotId': page['snapshotId'], 'text': 'Leave at the side door'}
        else:
            target = next(t for t in offered if 'Submit' in t.get('name', ''))
            action = {'type': 'click', 'target': target['number'], 'snapshotId': page['snapshotId']}
        body = json.dumps({'choices': [{'message': {'content': json.dumps(action)}, 'finish_reason': 'stop'}],
                           'usage': {'prompt_tokens': 8, 'completion_tokens': 8}}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(body)


if SCENE == 'local':
    endpoint, model = os.environ.get('CHROMECLAW_TEST_LOCAL_URL'), os.environ.get('CHROMECLAW_TEST_LOCAL_MODEL')
    if not endpoint or not model:
        raise SystemExit('The local scene needs explicit endpoint and model variables; no fallback.')
    scope = ['--origin', 'https://info.cern.ch', '--max-steps', '4', '--response-format', 'llama-schema']
else:
    server = ThreadingHTTPServer(('127.0.0.1', 0), Emulator)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    endpoint, model = f'http://127.0.0.1:{server.server_port}/v1', 'scripted-replies'
    scope = ['--origin', 'https://httpbin.org', '--write', '--allow-commit', '--max-steps', '6']
logs = Path(tempfile.mkdtemp(prefix='chromeclaw-media-'))
env = {k: v for k, v in os.environ.items() if not k.startswith('CHROMECLAW_') and k not in ['OPENAI_API_KEY', 'HF_TOKEN', 'NO_COLOR']}
env.update(TERM='xterm-256color', COLORTERM='truecolor', DOTENV_CONFIG_PATH='/nonexistent-chromeclaw-env')
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', ROWS, COLUMNS, 0, 0))
command = ['node', str(ROOT / 'apps/cli/dist/index.js'), 'tui', '--provider', 'local', '--model', model, '--base-url', endpoint,
           '--theme', 'dark', '--color', 'always', '--no-stream', '--max-output-tokens', '1200',
           '--request-timeout-ms', '90000', '--timeout-ms', '300000', '--log-dir', str(logs), *scope]
process = subprocess.Popen(command, stdin=slave, stdout=slave, stderr=slave, cwd=logs, env=env, start_new_session=True)
os.close(slave)
decoder, started, events, text = codecs.getincrementaldecoder('utf-8')('replace'), time.monotonic(), [], ''


def drain(seconds=0.1):
    global text
    until = time.monotonic() + seconds
    while time.monotonic() < until:
        if select.select([master], [], [], 0.05)[0]:
            try:
                chunk = os.read(master, 65536)
            except OSError:
                return
            if not chunk:
                return
            decoded = decoder.decode(chunk)
            text += decoded
            events.append([round(time.monotonic() - started, 4), 'o', decoded])


def send(line):
    events.append([round(time.monotonic() - started, 4), 'i', line + '\n'])
    os.write(master, (line + '\n').encode())


def records():
    return [json.loads(line) for file in logs.glob('*.jsonl') for line in file.read_text().split('\n')[:-1]]


def wait(predicate, timeout):
    until = time.monotonic() + timeout
    while time.monotonic() < until and process.poll() is None:
        drain()
        if predicate():
            return
    raise SystemExit('The scene did not reach its expected state; nothing was written.')


def finished(count):
    return lambda: sum(1 for event in records() if event['type'] == 'run_completed') >= count and text.count('/resume <run-id>') >= count


wait(lambda: 'ready' in text, 20)
if SCENE == 'local':
    send('/ask ' + CERN + ' Quote the sentence that says what the WorldWideWeb (W3) is, with its captured passage citation.')
    wait(finished(1), 240)
    send('/sources')
    drain(1)
    send('/find ' + CERN + ' the link to the list of people involved in the project')
    wait(finished(2), 240)
else:
    send('Note a delivery instruction on the demo order form, then submit it.')
    wait(lambda: '/approve pending_' in text, 60)
    drain(1)
    send('')
    wait(finished(1), 60)
drain(1)
send('/quit')
wait(lambda: process.poll() is not None or 'Closed.' in text, 30)
drain(1)
os.close(master)
output = ROOT / 'docs/media' / (SCENE + '.cast')
header = {'version': 2, 'width': COLUMNS, 'height': ROWS, 'env': {'TERM': 'xterm-256color'},
          'title': 'ChromeClaw ' + ('actual local Qwen3-VL 8B: cited ask and find' if SCENE == 'local' else 'scripted replies: submit held and denied')}
output.write_text('\n'.join(json.dumps(item, ensure_ascii=False) for item in [header] + events) + '\n')
summary = [{k: e['payload'].get(k) for k in ('status', 'finalAnswer', 'error')} for e in records() if e['type'] == 'run_completed']
print(json.dumps({'cast': str(output.relative_to(ROOT)), 'runs': summary}, indent=1))
