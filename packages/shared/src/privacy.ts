/** Redacts registered sensitive values and URL parameters. This is not a generic PII classifier. */
export class PrivacyFilter {
  private values = new Set<string>();
  constructor(values: readonly string[] = []) {
    for (const value of values) if (value) this.values.add(value);
  }
  withhold(value: string): void {
    if (value.length >= 4) this.values.add(value);
  }
  text(value: string): string {
    let safe = value;
    for (const secret of [...this.values].sort((a, b) => b.length - a.length))
      safe = safe.split(secret).join("[withheld]");
    return safe.replace(/https?:\/\/[^\s<>"\\]+/gi, (raw) => {
      try {
        const url = new URL(raw);
        url.username = "";
        url.password = "";
        for (const key of [...url.searchParams.keys()])
          url.searchParams.set(key, "[withheld]");
        if (url.hash) url.hash = "[withheld]";
        return url.href;
      } catch {
        return "[invalid URL withheld]";
      }
    });
  }
  record<T>(value: T): T {
    const identities = new Set([
      "id",
      "runId",
      "snapshotId",
      "documentId",
      "frameId",
      "beforeId",
      "afterId",
      "pendingId",
      "type",
      "kind",
      "status",
      "phase",
      "role",
      "tagName",
      "provider",
      "model",
      "timestamp",
      "startedAt",
      "completedAt",
      "payloadHash",
      "accounting",
      "permissions",
      "configuration",
    ]);
    const visit = (item: unknown, key: string): unknown => {
      if (identities.has(key)) return item;
      if (typeof item === "string") return this.text(item);
      if (Array.isArray(item)) return item.map((child) => visit(child, key));
      if (item && typeof item === "object")
        return Object.fromEntries(
          Object.entries(item).map(([name, child]) => [
            name,
            "type" in item &&
            item.type === "type" &&
            ["text", "thoughtSummary"].includes(name)
              ? "[withheld]"
              : visit(child, name),
          ]),
        );
      return item;
    };
    // Only content leaves change. Trusted identity and permission fields preserve record shape.
    return visit(value, "") as T;
  }
}
