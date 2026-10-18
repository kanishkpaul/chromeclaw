"""Compare each Stage 7 retest with the originally recorded outcome of the same frozen cases."""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
STAGE7 = Path(__file__).resolve().parent
EVIDENCE = ROOT / 'docs/evidence/phase8'
# Originals are the last recorded attempt of each lane before Stage 7, as cited in each stage README.
PAIRS = {
    'dummy-day1': 'day1/emulated-after', 'dummy-day2': 'stage2/emulated', 'dummy-research': 'stage3/emulated',
    'dummy-recovery': 'stage4/emulated', 'dummy-byok': 'stage5/final', 'scripted-stage6': 'stage6/scripted-retest',
    'local-day1': 'day1/actual-local-8k', 'local-day2': 'stage2/actual-local', 'local-research': 'stage3/actual-local',
    'local-recovery': 'stage4/actual-local', 'local-stage6': 'stage6/actual-local-retest', 'terminal-day2': 'stage2/terminal',
    'terminal-stage3': 'stage3/terminal', 'terminal-stage4': 'stage4/terminal',
}


def outcomes(report):
    rows = report.get('results') or report.get('checks') or []
    return {row['id']: row for row in rows}


def retest_report(name):
    log = (STAGE7 / 'retest-logs' / (name + '.log')).read_text()
    paths = re.findall(r'(/\S+/\.chromeclaw/\S+)', log)
    if not paths:
        return None, None
    path = Path(paths[-1])
    directory = path.parent if path.name == 'report.json' else path
    return directory, json.loads((directory / 'report.json').read_text())


summary = []
for name, original_path in PAIRS.items():
    original = outcomes(json.loads((EVIDENCE / original_path / 'report.json').read_text()))
    directory, report = retest_report(name)
    if report is None:
        summary.append({'retest': name, 'original': original_path, 'error': 'No retest report path in log.'})
        continue
    if '--copy' in sys.argv:
        shutil.copytree(directory, STAGE7 / 'retests' / name, dirs_exist_ok=True)
    retest = outcomes(report)
    cases = []
    for case_id in sorted(set(original) | set(retest)):
        before, after = original.get(case_id, {}), retest.get(case_id, {})
        cases.append({'id': case_id, 'originalPassed': before.get('passed'), 'retestPassed': after.get('passed'),
                      'retestStatus': after.get('status'), 'retestError': after.get('error') or after.get('harnessError')})
    summary.append({'retest': name, 'original': original_path, 'retestDirectory': str(directory.relative_to(ROOT)),
                    'originalPassed': sum(1 for row in original.values() if row.get('passed')), 'originalTotal': len(original),
                    'retestPassed': sum(1 for row in retest.values() if row.get('passed')), 'retestTotal': len(retest), 'cases': cases})
(STAGE7 / 'comparison.json').write_text(json.dumps(summary, indent=2) + '\n')
for row in summary:
    print(row['retest'], row.get('originalPassed'), '/', row.get('originalTotal'), '->', row.get('retestPassed'), '/', row.get('retestTotal'), row.get('error', ''))
