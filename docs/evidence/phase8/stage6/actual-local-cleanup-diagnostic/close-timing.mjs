import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const { chromium } = (await import(process.argv[2])).default;
const out = [];
for (const headless of [false, false, false, true]) {
  const dir = await mkdtemp(path.join(tmpdir(), "chromeclaw-close-"));
  const context = await chromium.launchPersistentContext(dir, { headless, channel: "chrome", handleSIGINT: false, serviceWorkers: "block", viewport: { width: 1440, height: 1000 } });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://info.cern.ch/hypertext/WWW/TheProject.html", { waitUntil: "domcontentloaded" });
  const t = performance.now();
  await context.close();
  out.push({ headless, closeMs: Math.round(performance.now() - t) });
  await rm(dir, { recursive: true, force: true });
}
console.log(JSON.stringify(out));
