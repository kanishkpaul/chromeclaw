import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dependencies: Readonly<Record<string, readonly string[]>> = {
  egress: [], shared: [], browser: ["shared"], agent: ["browser", "shared", "egress"], evals: ["agent", "shared"], cli: ["agent", "evals", "shared"]
};

function violations(source: string, owner: string, file: string): string[] {
  const errors: string[] = [];
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const imported = node.moduleSpecifier.text;
      if (imported.startsWith("@chromeclaw/") && !dependencies[owner]?.includes(imported.slice("@chromeclaw/".length))) {
        errors.push(`Forbidden dependency ${owner} -> ${imported}`);
      }
    }
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      ["fetch", "globalThis.fetch", "XMLHttpRequest", "WebSocket", "navigator.sendBeacon"].includes(node.expression.getText(syntax)) &&
      file !== "packages/egress/src/index.ts") {
      errors.push(`Network I/O outside the egress boundary: ${file}`);
    }
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(syntax) === "chrome") {
      errors.push(`Chrome API outside a browser bridge: ${file}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(syntax);
  return errors;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(file) : file.endsWith(".ts") ? [file] : [];
  });
}

describe("current package boundaries", () => {
  it("keeps production imports inward and does not add a second network sender", () => {
    const errors = Object.keys(dependencies).flatMap((owner) => {
      const directory = owner === "cli" ? "apps/cli/src" : `packages/${owner}/src`;
      return sourceFiles(directory).flatMap((file) => violations(readFileSync(path.join(root, file), "utf8"), owner, file));
    });
    expect(errors).toEqual([]);
  });

  it("rejects reversed imports, a second sender and misplaced Chrome APIs", () => {
    expect(violations('import { runtime } from "@chromeclaw/agent";', "shared", "packages/shared/src/probe.ts")).toHaveLength(1);
    expect(violations('fetch("https://example.com");', "browser", "packages/browser/src/probe.ts")).toHaveLength(1);
    expect(violations("chrome.tabs.query({});", "agent", "packages/agent/src/probe.ts")).toHaveLength(1);
  });
});
