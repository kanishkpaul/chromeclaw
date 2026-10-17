# Integration findings

The acceptance fixtures retain independent world-state assertions. These development failures
are separate from the final reports and are not counted as successful tasks.

- Qwen in unconstrained JSON mode copied the old `{type, fields}` registry into a reply. Strict
  parsing refused it. The prompt now gives real property names and valid JSON action examples;
  the explicit `llama-schema` option constrains shape using the existing Zod action contract.
- A form attempt saved twice, including an empty second value. The independent server oracle
  rejected it. Typed aliases had been filtering the trusted task again on every step. The runtime
  now fixes the task after filtering declared secrets and known keys; later ordinary typing
  cannot rewrite the user's instructions. Synthetic transport regression asserts task stability.
- Further Qwen attempts repeatedly typed into the same field despite successful driver results,
  then hit the step limit. Field values remain hidden. The prompt explains this privacy contract,
  history avoids an unnecessary second JSON encoding, and planning requests a brief progress
  summary. These changes do not expose field values or infer success from a model's claim.
- A first native grammar included string/range expansion and llama.cpp refused it with HTTP 400
  because the generated grammar exceeded its repetition complexity policy. The wire grammar now
  constrains shapes/discriminants; full local Zod bounds, token and byte limits remain enforced.
  There is no automatic fallback after a server rejects a request.
- Playwright's default SIGINT handler could exit the CLI before its final cancellation JSONL.
  Browser launch now leaves SIGINT to the runtime. The process fixture requires exit 130 and a
  final stopped result, with no subsequent acts.
- Chrome shutdown can stall after cancellation or disconnection. Cleanup has a separate five-second
  deadline and records a warning on failure. Cancellation does not promise rollback or that a
  disconnected browser process was terminated successfully.

These are controlled fixture repairs, not held-out model-quality measurements. Native grammar
support does not establish ordinary JSON-mode reliability, other models, Ollama or LM Studio.
