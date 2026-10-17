import kit from "../../../design/tokens/tokens.json";

/** Content never gets to emit terminal controls, bidi overrides or new trusted rows. */
export function terminalText(value: string): string {
  return value.replace(
    /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,
    (character) =>
      `\\u${character.codePointAt(0)?.toString(16).padStart(4, "0")}`,
  );
}

function cellWidth(value: string): number {
  if (/^\p{Mark}+$/u.test(value)) return 0;
  return /[\p{Extended_Pictographic}\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff\uff01-\uff60]/u.test(
    value,
  )
    ? 2
    : 1;
}

/** Wrap graphemes, repeating the row prefix so wrapped data stays visibly subordinate. */
export function terminalRows(
  prefix: string,
  value: string,
  columns: number,
): string[] {
  const width = Math.max(12, columns);
  const rows: string[] = [];
  let row = prefix,
    used = [...prefix].length;
  for (const { segment } of new Intl.Segmenter().segment(value)) {
    const cells = cellWidth(segment);
    if (used + cells > width) {
      rows.push(row);
      row = prefix;
      used = [...prefix].length;
    }
    row += segment;
    used += cells;
  }
  rows.push(row);
  return rows;
}

export function terminalTheme(
  env: Readonly<Record<string, string | undefined>>,
  options: { theme?: string; color?: string } = {},
) {
  const mode = options.theme ?? env.CHROMECLAW_THEME ?? "auto";
  const color = options.color ?? "auto";
  if (
    !["auto", "dark", "light"].includes(mode) ||
    !["auto", "always", "never"].includes(color)
  )
    throw new Error(
      "Use --theme auto|dark|light and --color auto|always|never.",
    );
  const background = Number(env.COLORFGBG?.split(";").at(-1));
  const light =
    mode === "light" ||
    (mode === "auto" &&
      (background >= 7 ||
        (env.TERM_PROGRAM === "Apple_Terminal" && !env.COLORFGBG)));
  const palette = kit.skins.ember.tui[light ? "light" : "dark"];
  const enabled =
    color === "always" ||
    (color === "auto" && !env.NO_COLOR && env.TERM !== "dumb");
  const paint = (tone: keyof typeof palette, text: string) => {
    if (!enabled) return text;
    const hex = palette[tone].slice(1);
    const rgb = [0, 2, 4].map((offset) =>
      parseInt(hex.slice(offset, offset + 2), 16),
    );
    const sequence = /truecolor|24bit/.test(env.COLORTERM ?? "")
      ? `38;2;${rgb.join(";")}`
      : `38;5;${16 + rgb.reduce((sum, channel, index) => sum + Math.round((channel / 255) * 5) * 6 ** (2 - index), 0)}`;
    return `\u001b[${sequence}m${text}\u001b[0m`;
  };
  return { paint, identity: kit.identities.chromeclaw, light };
}
