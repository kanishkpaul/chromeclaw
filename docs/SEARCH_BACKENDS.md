# Search backend decision, Phase 7

The first backend is an engine tab. It takes one to three explicit user subquestions, fixed before
source/history reads, and opens only their exact constructed search URLs. Results are candidate
links; snippets never count as source evidence. The backend has its own folder and registration,
receives reader capabilities by injection and imports no other plugin. CAPTCHA stops the run with
a hand-back reason; it never switches engines or tries to solve the challenge.

## API comparison

Documentation inspected on 18 October 2026. This compares interfaces, not measured retrieval quality
or pricing. No paid API request was made and no API credentials were used.

| Candidate | Documented interface | Fit and cost to this implementation |
|---|---|---|
| [Brave Search](https://api-dashboard.search.brave.com/app/documentation/web-search/codes) | Ranked web search with a subscription-token header, query and freshness controls | Small candidate-only adapter; requires another key and explicit egress/accounting integration |
| [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search) | Authenticated POST search with result limits and optional answers/raw content | Candidate URLs can be used while disabling generated answers; must not treat returned text as verified evidence |
| [Exa Search](https://exa.ai/docs/reference/search) | Authenticated search endpoint with retrieval options | Potential conceptual-query candidate source; needs its own measured relevance evaluation before selection |

Keep engine-tab search as the enabled baseline. Defer choosing an API backend until bounded live
queries establish a retrieval/availability gap. There is no evidence here that one commercial API
has better recall or support quality. Any later API adapter must go through existing application
egress, reserve its declared cost and keep trusted query construction unchanged. No silent fallback.

The initial engine is the explicit `--search-engine` endpoint (default DuckDuckGo's HTML endpoint).
Only permitted result origins can be opened; discovery does not dynamically grant all web origins.
Query-bearing source URLs and redirects remain conservative refusals. This limits live coverage,
which Phase 8 measures separately. Terminal JSON configuration can choose a controlled or local
engine endpoint under the same envelope.
