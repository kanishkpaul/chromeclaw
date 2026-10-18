"""One bounded live TUI read, with actual local inference and a disposable profile."""
import codecs
import fcntl
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import pty
import select
import shutil
import signal
import struct
import subprocess
import sys
import tempfile
import termios
import time
import threading
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[3]
MODEL = os.environ.get('CHROMECLAW_TEST_LOCAL_MODEL')
ENDPOINT = os.environ.get('CHROMECLAW_TEST_LOCAL_URL')
if not MODEL or not ENDPOINT:
    raise RuntimeError('Explicit local endpoint/model required; no fallback.')
DAY2 = '--day2' in sys.argv
STAGE3 = '--stage3' in sys.argv
STAGE4 = '--stage4' in sys.argv
if sum([DAY2, STAGE3, STAGE4]) > 1:
    raise RuntimeError('Choose one terminal scenario.')
SITE = 'https://httpbin.org/robots.txt' if DAY2 or STAGE4 else 'https://example.com/'
ORIGIN = 'https://httpbin.org' if DAY2 or STAGE4 else 'https://example.com'
ARTIFACTS = Path(tempfile.mkdtemp(prefix='terminal-stage4-' if STAGE4 else 'terminal-stage3-' if STAGE3 else 'terminal-session2-' if DAY2 else 'terminal-', dir=ROOT / '.chromeclaw/phase8-live'))
WORK = Path(tempfile.mkdtemp(prefix='chromeclaw-live-tui-'))
LOGS = ARTIFACTS / 'runs'
LOGS.mkdir()
expected = 'User-agent: *\nDisallow: /deny' if DAY2 or STAGE4 else 'This domain is for use in documentation examples without needing permission. This is not a service; avoid relying on it for testing and monitoring purposes.'
question = 'Quote the complete visible robots.txt text exactly, including its newline, with its captured passage citation.' if DAY2 or STAGE4 else 'Quote the complete English paragraph describing this domain use, with its exact captured passage citation.'
index_server, index_requests = None, []
source_urls = ['https://httpbin.org/robots.txt', 'https://httpbin.org/html']
if STAGE3:
    SITE = source_urls[0]
    question = 'Create an inventory of the selected HTTP demo resources. Quote the complete robots.txt text and the Moby-Dick heading, one complete captured passage from each source. Return two extract claims, one per source, and join their texts with newline. Do not infer production policy.'

    class CandidateIndex(BaseHTTPRequestHandler):
        def do_GET(self):
            parsed = urlsplit(self.path)
            admitted = parsed.path == '/index' and parse_qs(parsed.query).get('q') == [question]
            index_requests.append({'path': parsed.path, 'queryMatches': admitted})
            self.send_response(200 if admitted else 404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            if admitted:
                self.wfile.write(('Controlled candidate list, not live search. ' + ''.join('<a href="' + url + '">Selected source</a>' for url in source_urls)).encode())

        def log_message(self, *_args):
            # Structured candidate-index requests are retained with the terminal report.
            return

    index_server = ThreadingHTTPServer(('127.0.0.1', 0), CandidateIndex)
    threading.Thread(target=index_server.serve_forever, daemon=True).start()
    ORIGIN = 'http://127.0.0.1:' + str(index_server.server_port)
    expected = ['User-agent: *\nDisallow: /deny', 'Herman Melville - Moby-Dick']
clean = {key: value for key, value in os.environ.items() if not key.startswith('CHROMECLAW_') and key not in ['OPENAI_API_KEY', 'HF_TOKEN', 'HUGGINGFACE_API_KEY', 'OPENAI_BASE_URL']}
clean.update(TERM='xterm-256color', NO_COLOR='1', DOTENV_CONFIG_PATH='/nonexistent-chromeclaw-env')
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 100, 0, 0))
command = ['node', str(ROOT / 'apps/cli/dist/index.js'), 'tui', '--provider', 'local', '--model', MODEL,
           '--base-url', ENDPOINT, '--origin', ORIGIN, *(['https://httpbin.org'] if STAGE3 else []), '--no-stream', '--response-format', 'llama-schema',
           '--max-output-tokens', '1200', '--request-timeout-ms', '90000', '--timeout-ms', '180000', '--max-steps', '4', '--log-dir', str(LOGS)]
if STAGE3:
    command.append('--allow-loopback')
process = subprocess.Popen(command, stdin=slave, stdout=slave, stderr=slave, cwd=WORK, env=clean, start_new_session=True)
os.close(slave)
decoder = codecs.getincrementaldecoder('utf8')('replace')
started = time.monotonic()
text, recording, checks = '', [], []


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
            recording.append([round(time.monotonic() - started, 4), 'o', decoded])


def wait(predicate, timeout):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        drain()
        if predicate():
            return
        if process.poll() is not None:
            break
    # Exit can race the predicate and the following poll; inspect the final state once more.
    if predicate():
        return
    raise AssertionError('Live terminal did not reach the expected state; inspect recording.')


def completed():
    for file in LOGS.glob('*.jsonl'):
        # A concurrent append may expose an incomplete final record; only inspect whole lines.
        for line in file.read_text().split('\n')[:-1]:
            event = json.loads(line)
            if event['type'] == 'run_completed':
                return event['payload']
    return None


try:
    wait(lambda: 'ready' in text, 20)
    request = '/research ' + json.dumps({'mode': 'research', 'engineUrl': ORIGIN + '/index', 'queries': [question], 'maxSources': 5}) if STAGE3 else '/ask ' + SITE + ' ' + question
    os.write(master, (request + '\n').encode())
    if STAGE4:
        def records():
            return [json.loads(line) for file in LOGS.glob('*.jsonl') for line in file.read_text().split('\n')[:-1]]

        def pending_pause():
            states = [event for event in records() if event['type'] == 'state']
            return states[-1] if states and states[-1]['payload'].get('pending', {}).get('kind') == 'pause' else None

        os.write(master, b'/pause\n')
        wait(pending_pause, 30)
        first = pending_pause()
        run_id = first['runId']
        os.write(master, b'/cancel\n')
        wait(lambda: any(event['type'] == 'run_completed' and event['payload']['status'] == 'stopped' for event in records()), 20)
        drain(1)
        os.write(master, ('/resume ' + run_id + '\n').encode())
        wait(lambda: pending_pause() and pending_pause()['payload']['pending']['id'] != first['payload']['pending']['id'], 30)
        os.write(master, b'/continue\n')
        wait(lambda: any(event['type'] == 'run_completed' and event['payload']['status'] == 'done' for event in records()), 180)
        result = next(event['payload'] for event in reversed(records()) if event['type'] == 'run_completed')
        checks.append({'id': 'pause-cancel-reopen-and-resume-public-read', 'passed': result['finalAnswer'] == expected, 'status': result['status']})
        os.write(master, b'/trace\n')
        drain(1)
        prior_runs = {event['runId'] for event in records()}

        def new_records():
            return [event for event in records() if event['runId'] not in prior_runs]
        os.write(master, (request + '\n').encode())
        wait(lambda: any(event['type'] == 'crossing' for event in new_records()), 30)
        os.write(master, b'/cancel\n')
        wait(lambda: any(event['type'] == 'run_completed' and event['payload']['status'] == 'stopped' for event in new_records()), 20)
        cancelled = new_records()
        crossing = next(index for index, event in enumerate(cancelled) if event['type'] == 'crossing')
        cancelled = cancelled[crossing + 1:]
        checks.append({'id': 'cancel-local-request-without-action-dispatch', 'passed': not any(event['type'] in ['proposal', 'act_started'] for event in cancelled)})
    else:
        wait(completed, 180)
    if not STAGE4:
        result = completed()
    passed = result['status'] == 'done' and (all(text in result.get('finalAnswer', '') for text in expected) if STAGE3 else result.get('finalAnswer') == expected)
    if STAGE3:
        records = [json.loads(line) for file in LOGS.glob('*.jsonl') for line in file.read_text().split('\n')[:-1]]
        observations = {event['payload']['snapshotId']: event['payload'] for event in records if event['type'] == 'observation'}
        claims = [claim for event in records if event['type'] == 'step' for claim in event['payload'].get('action', {}).get('claims', [])]
        cited_urls = {observations.get(ref['snapshotId'], {}).get('url') for claim in claims for ref in claim['evidence']}
        passed = passed and set(source_urls).issubset(cited_urls)
    if not STAGE4:
        checks.append({'id': 'actual-local-assisted-research-through-tui' if STAGE3 else 'actual-local-public-read-through-tui', 'passed': passed, 'status': result['status']})
    os.write(master, b'/sources\n')
    drain(1)
    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', 28, 60, 0, 0))
    # The TUI does not own this PTY as its controlling terminal, so the kernel sends no SIGWINCH.
    os.kill(process.pid, signal.SIGWINCH)
    recording.append([round(time.monotonic() - started, 4), 'r', '60x28'])
    os.write(master, b'/trace\n')
    drain(1)
    os.write(master, b'/quit\n')
    wait(lambda: process.poll() is not None, 20)
    checks.append({'id': 'source-trace-inspection-resize-and-clean-exit', 'passed': process.returncode == 0 and 'trace observation' in text and ORIGIN in text, 'exitCode': process.returncode})
finally:
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
    drain()
    os.close(master)
    if index_server:
        index_server.shutdown()
        index_server.server_close()
    shutil.rmtree(WORK)
    (ARTIFACTS / 'terminal.txt').write_text(text)
    with (ARTIFACTS / 'terminal.cast').open('w') as output:
        output.write(json.dumps({'version': 2, 'width': 100, 'height': 40, 'title': 'ChromeClaw Stage 4 interruption and recovery' if STAGE4 else 'ChromeClaw Stage 3 assisted live-source research' if STAGE3 else 'ChromeClaw session 2 live local read' if DAY2 or STAGE4 else 'ChromeClaw Day 1 live local read; development follow-up'}) + '\n')
        for event in recording:
            output.write(json.dumps(event) + '\n')
    (ARTIFACTS / 'report.json').write_text(json.dumps({'suite': 'live-01-terminal-stage4' if STAGE4 else 'live-01-terminal-stage3' if STAGE3 else 'live-01-terminal-session2' if DAY2 or STAGE4 else 'live-01-terminal-development-followup', 'actualLocal': True, 'hostedInference': False, 'lane': 'assisted live sources; controlled candidate index, not public search' if STAGE3 else 'public read', 'indexRequests': index_requests, 'model': MODEL, 'site': SITE, 'sources': source_urls if STAGE3 else [SITE], 'checks': checks, 'latencyMs': round((time.monotonic() - started) * 1000)}, indent=2) + '\n')
print(ARTIFACTS)
assert len(checks) == (3 if STAGE4 else 2) and all(check['passed'] for check in checks)
