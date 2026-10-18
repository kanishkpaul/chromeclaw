"""One bounded live TUI read, with actual local inference and a disposable profile."""
import codecs
import fcntl
import json
import os
from pathlib import Path
import pty
import select
import shutil
import struct
import subprocess
import sys
import tempfile
import termios
import time

ROOT = Path(__file__).resolve().parents[3]
MODEL = os.environ.get('CHROMECLAW_TEST_LOCAL_MODEL')
ENDPOINT = os.environ.get('CHROMECLAW_TEST_LOCAL_URL')
if not MODEL or not ENDPOINT:
    raise RuntimeError('Explicit local endpoint/model required; no fallback.')
DAY2 = '--day2' in sys.argv
SITE = 'https://httpbin.org/robots.txt' if DAY2 else 'https://example.com/'
ORIGIN = 'https://httpbin.org' if DAY2 else 'https://example.com'
ARTIFACTS = Path(tempfile.mkdtemp(prefix='terminal-session2-' if DAY2 else 'terminal-', dir=ROOT / '.chromeclaw/phase8-live'))
WORK = Path(tempfile.mkdtemp(prefix='chromeclaw-live-tui-'))
LOGS = ARTIFACTS / 'runs'
LOGS.mkdir()
expected = 'User-agent: *\nDisallow: /deny' if DAY2 else 'This domain is for use in documentation examples without needing permission. This is not a service; avoid relying on it for testing and monitoring purposes.'
question = 'Quote the complete visible robots.txt text exactly, including its newline, with its captured passage citation.' if DAY2 else 'Quote the complete English paragraph describing this domain use, with its exact captured passage citation.'
clean = {key: value for key, value in os.environ.items() if not key.startswith('CHROMECLAW_') and key not in ['OPENAI_API_KEY', 'HF_TOKEN', 'HUGGINGFACE_API_KEY', 'OPENAI_BASE_URL']}
clean.update(TERM='xterm-256color', NO_COLOR='1', DOTENV_CONFIG_PATH='/nonexistent-chromeclaw-env')
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 40, 100, 0, 0))
command = ['node', str(ROOT / 'apps/cli/dist/index.js'), 'tui', '--provider', 'local', '--model', MODEL,
           '--base-url', ENDPOINT, '--origin', ORIGIN, '--no-stream', '--response-format', 'llama-schema',
           '--max-output-tokens', '1200', '--request-timeout-ms', '90000', '--timeout-ms', '180000', '--max-steps', '4', '--log-dir', str(LOGS)]
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
    os.write(master, ('/ask ' + SITE + ' ' + question + '\n').encode())
    wait(completed, 180)
    result = completed()
    checks.append({'id': 'actual-local-public-read-through-tui', 'passed': result['status'] == 'done' and result.get('finalAnswer') == expected, 'status': result['status']})
    os.write(master, b'/sources\n')
    drain(1)
    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', 28, 60, 0, 0))
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
    shutil.rmtree(WORK)
    (ARTIFACTS / 'terminal.txt').write_text(text)
    with (ARTIFACTS / 'terminal.cast').open('w') as output:
        output.write(json.dumps({'version': 2, 'width': 100, 'height': 40, 'title': 'ChromeClaw session 2 live local read' if DAY2 else 'ChromeClaw Day 1 live local read; development follow-up'}) + '\n')
        for event in recording:
            output.write(json.dumps(event) + '\n')
    (ARTIFACTS / 'report.json').write_text(json.dumps({'suite': 'live-01-terminal-session2' if DAY2 else 'live-01-terminal-development-followup', 'actualLocal': True, 'hostedInference': False, 'model': MODEL, 'site': SITE, 'checks': checks, 'latencyMs': round((time.monotonic() - started) * 1000)}, indent=2) + '\n')
print(ARTIFACTS)
assert len(checks) == 2 and all(check['passed'] for check in checks)
