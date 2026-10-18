"""Replay a recorded asciicast through a small terminal model and write it as framed HTML.

  python3 docs/media/render.py local [first-row last-row]

The model covers only what the TUI emits: printable text, CR/LF, truecolour foreground SGR,
reset, cursor-to-column (G), erase line (K) and erase below (J). Colours are the bytes the TUI
wrote, from the design kit's Ember tokens. Nothing is retouched; the optional row range only
crops. The README images were captured from that HTML in Chromium at a 1200x900 viewport and
device scale 2, as an element screenshot of `.window`. Rows used: local 0-38 (ask.png) and 38-58
(find.png), gate 11-37 (gate.png).
"""
import html
import json
import re
import sys
from pathlib import Path

MEDIA = Path(__file__).resolve().parent
NAME = sys.argv[1]
ESCAPE = re.compile(r'\x1b\[([0-9;?]*)([A-Za-z])')
# The kit's Ember dark surface and text, used only for cells the TUI left uncoloured.
BACKGROUND, DEFAULT_TEXT = '#1C1B1B', '#EDEAE8'

lines = [json.loads(line) for line in (MEDIA / (NAME + '.cast')).read_text().splitlines()]
header, output = lines[0], ''.join(event[2] for event in lines[1:] if event[1] == 'o')
width = header['width']
grid: list[list[tuple[str, str | None]]] = [[]]
row = col = 0
colour = None
# Terminals defer the wrap at the last column until another character arrives, so a full-width
# row followed by CR LF occupies one line, not two.
pending_wrap = False


def put(character):
    global col, pending_wrap
    if pending_wrap:
        newline()
        pending_wrap = False
    line = grid[row]
    while len(line) < col:
        line.append((' ', None))
    if col < len(line):
        line[col] = (character, colour)
    else:
        line.append((character, colour))
    col += 1
    if col >= width:
        col, pending_wrap = width - 1, True


def newline():
    global row, col
    row += 1
    col = 0
    while len(grid) <= row:
        grid.append([])


position = 0
for match in ESCAPE.finditer(output + '\x1b[0m'):
    for character in output[position:match.start()]:
        if character in '\r\n':
            pending_wrap = False
        if character == '\n':
            row += 1
            while len(grid) <= row:
                grid.append([])
        elif character == '\r':
            col = 0
        elif character >= ' ':
            put(character)
    position = match.end()
    params, command = match.group(1), match.group(2)
    if command in 'GKJ':
        pending_wrap = False
    if command == 'm':
        values = [int(value) for value in params.split(';') if value.isdigit()] or [0]
        if values[:2] == [38, 2] and len(values) >= 5:
            colour = '#%02X%02X%02X' % tuple(values[2:5])
        elif values == [0]:
            colour = None
    elif command == 'G':
        col = int(params or '1') - 1
    elif command == 'K':
        grid[row] = [] if params == '2' else grid[row][:col]
    elif command == 'J':
        grid[row] = grid[row][:col]
        del grid[row + 1:]

start, end = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (0, len(grid))
rows = grid[start:end]
while rows and not rows[-1]:
    rows.pop()


def cells(line):
    out, current, run = [], None, ''
    for character, cell_colour in line + [('', 'end')]:
        if cell_colour != current:
            if run:
                out.append(f'<span style="color:{current or DEFAULT_TEXT}">{html.escape(run)}</span>')
            current, run = cell_colour, ''
        run += character
    return ''.join(out)


body = '\n'.join(cells(line) for line in rows)
(MEDIA / (NAME + '.html')).write_text(f'''<!doctype html><meta charset="utf-8">
<style>
  html, body {{ margin: 0; background: transparent; }}
  .window {{ display: inline-block; margin: 24px; border-radius: 12px; overflow: hidden;
    background: {BACKGROUND}; box-shadow: 0 0 0 1px #3A3534, 0 18px 50px rgba(0,0,0,.45); }}
  .bar {{ height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 14px;
    background: #262525; color: #CFC5C2; font: 600 13px -apple-system, system-ui, sans-serif; }}
  .dot {{ width: 12px; height: 12px; border-radius: 50%; }}
  .title {{ flex: 1; text-align: center; margin-right: 52px; }}
  pre {{ margin: 0; padding: 14px 18px 18px; font: 13.5px/1.22 Menlo, "SF Mono", monospace;
    width: {width}ch; white-space: pre; }}
</style>
<div class="window"><div class="bar"><span class="dot" style="background:#FF5F57"></span>
<span class="dot" style="background:#FEBC2E"></span><span class="dot" style="background:#28C840"></span>
<span class="title">chromeclaw tui</span></div><pre>{body}</pre></div>
''')
print(f'{NAME}.html: {len(rows)} rows of {len(grid)}')
