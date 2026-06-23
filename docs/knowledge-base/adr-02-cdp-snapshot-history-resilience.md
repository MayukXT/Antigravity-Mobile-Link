# Architecture Decision Record (ADR 02): CDP Snapshot & History Resilience

## Status
Approved

## Context
Opening Antigravity conversations from the mobile history drawer could leave the phone on an empty or stale chat view. The server logged `Snapshot capture issue: No valid snapshot captured (check contexts)` while the IDE still accepted messages and produced replies. Investigation showed two separate root causes:

- The snapshot script generated invalid JavaScript because a newline escape inside a nested template literal was not escaped for CDP evaluation.
- The history endpoint clicked the desktop history control and then waited inside the same in-page promise. If the workbench rebuilt contexts after the click, the CDP request hung until timeout.

## Decision

1. Keep snapshot CSS joining as a valid runtime JavaScript escape: `rules.join('\\n')` in the server source.
2. Return per-context diagnostics from `captureSnapshot()` instead of collapsing all failures to `null`.
3. Split history loading into bounded CDP phases:
   - open the desktop history panel synchronously;
   - poll fresh execution contexts from Node;
   - scrape the visible panel synchronously.
4. Add a final narrow composer scrub for current Antigravity side-panel input wrappers before serializing mirrored chat HTML.
5. Wire `tests/test_scraping.js` into `npm test` and include the current Antigravity composer markup in the mock fixture.

## Consequences

- The mobile app can render current chat content again after loading or switching conversations.
- `/chat-history` returns promptly with real conversation titles instead of hanging through CDP timeouts.
- The mirrored snapshot no longer includes the desktop composer, keeping the mobile UI focused on chat history and agent output.
- Future Antigravity DOM changes should update the mock fixture before changing capture heuristics.
