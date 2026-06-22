# Mobile Render & Chat History Fixes

**Status:** awaiting user approval
**Date:** 2026-06-22
**Affected repo:** `antigravity_phone_chat` (this repo)

## 1 — Problem Statement

Users running `Antigravity Phone Connect` (server.js CDP mirror to phone Web UI) report:

1. **Chat box shows nothing** when connecting from phone (localhost). New chat works on phone, sending messages to Antigravity works, scrolling works on desktop — but the rendered mirror on phone is empty.
2. **Chat history panel** opens but shows the wrong content: file names from the workspace (`.agents`, `.vscode`, `assets`, …), random directory listings, and long passages of text from the currently-open Monaco editor (e.g. lines from `GEMINI.md`), instead of actual saved conversation titles.

## 2 — Symptoms vs. Evidence Collected

### 2.1 `GET /snapshot` (live, current Antigravity)
```json
{
  "html": "<div id=\"conversation\" role=\"region\" aria-label=\"Agent Conversation\" class=\"relative flex w-full grow flex-col overflow-y-hidden overflow-x-clip pr-px\"></div>"
}
```
The `#conversation` element exists but is **empty** (0 message children, `innerText` len 141 of mostly placeholder text).

### 2.2 `GET /cdp-targets`
```
9000:
  - workbench.html                                  (Monaco + main editor, title "DeskinConfigFixer.MK ... - GEMINI.md")
  - workbench-jetski-agent.html                    ("Launchpad" splash)
  - 2× workers
9001/9002/9003: refused
```
Only **one** `workbench.html` page target — the editor window. No Cascade chat panel page target exists at the moment of capture (the chat panel is closed on the desktop).

### 2.3 `GET /ui-inspect` summary
```json
{
  "summary": { "frameFound": false, "contextFound": false, "bestContextId": 2 },
  "usefulButtons": []
}
```
0 of 50 visible buttons carry `data-tooltip-id` matching `New Conversation / Past Conversations / History`. Codicons (`codicon-*`) are used instead of lucide.

### 2.4 `GET /chat-history` (current scraper output)
```json
{
  "chats": [
    {"title": ".agents"}, {"title": ".vscode"}, {"title": "assets"},
    {"title": ".env"}, {"title": ".env.example"}, {"title": ".gitignore"}, ...
    {"title": "Security: Always create..."},                  // from .agents/RULES.md
    {"title": "- Always create and maintain a `design.md`..."} // from GEMINI.md
  ],
  "debug": { "panelFound": true, "panelWidth": 1600, "inputFound": true,
             "anchorFound": false, "inputsDebug": [] }
}
```
The scraper dumped **workspace file-tree nodes** and **Monaco editor text** because it anchored on the search `<input>`, walked up 15 levels until `width>50 && height>100 && position==fixed/absolute`, found the entire Antigravity viewport (`panelWidth:1600`) and counted every `span≥3 chars` inside it as a "chat title".

### 2.5 DOM probe (custom script `probe.mjs`)
Inside `#conversation`'s parent page the only sizeable text containers are:
- `.monaco-list-rows` → file tree
- `.view-lines.monaco-mouse-cursor-text` → open editor text (`GEMINI.md`)

Neither contains agent messages. Tooltips found in the page (`history-tooltip`, `new-conversation-tooltip`) confirm both buttons exist in the DOM, meaning the chat panel toolbar is present — but the panel itself is not focus-loaded.

## 3 — Root Causes (confirmed)

### RC1 — Empty chat on phone
`discoverCDP()` picks the first target whose URL contains `workbench.html`. In this Antigravity build, the Cascade chat surface lives in a **separate Electron BrowserWindow** that:
- is not always present (appears only when the user opens the chat panel on desktop, OR is launched in a separate workbench URL `workbench-jetski-agent.html` / similar), and
- is bound to a **different targetId** than the one picked today.

When the chat panel is closed or hidden from the captured page, `#conversation` is empty or holds only the placeholder welcome text → blank mirror.

### RC2 — History scraper hallucinating filenames
`getChatHistory` (server.js:999-1198) has a flawed container-resolution strategy:
1. Click `data-tooltip-id*="history"` button → mock panel opens.
2. Anchor on the search `<input>` (`.w-full`) inside the panel.
3. **Walk up to a parent that satisfies `rect.width>50 && rect.height>100` but bail at the first `fixed|absolute|zIndex>10`** container.
4. With Antigravity's full-screen Electron shell, this resolves to the **body** (panel.width=1600).
5. `panel.querySelectorAll('span')` then returns every visible `span` in the entire IDE — file-tree node names, Monaco editor text fragments, status-bar items, etc.

The skip-list (§SKIP_EXACT) hard-codes `workspace, default, phone-connect-antigravity` but has no extension/filename filter; long editor text rows pass the `< 100 chars` filter on each line individually.

### RC3 (secondary, contributes) — Aggressive CSS scrubbing
`captureSnapshot` (server.js:250-373) nukes elements matching `.relative.flex.flex-col.gap-8`, `.flex.grow.flex-col.justify-start.gap-8`, `.mx-8.mb-8`, `.mx-4.mb-4` and any `[contenteditable=true]` ancestor. These classes apply to **legitimate conversation rows** in the current Antigravity Cascade build (Tailwind layout), so even when messages are captured they get scrubbed.

`rules.join('\\n')` (line 437) emits the literal `\\n` separator (escaped backslash-n) — Chrome tolerates it but it pollutes the merged stylesheet and adds ~bytes of noise. Fix opportunistically.

## 4 — Design

### 4.1 Goals
- Connected state's chat mirror shows actual messages whenever the desktop chat panel is open.
- History panel lists real conversation titles (long, user-visible strings like "Refining Chat History Scraper").
- Stop new regressions when the CDP target list changes.

### 4.2 Non-goals
- No new dependency. No public API surface change.
- Don't change auth, WebSocket, or HTTPS flow.
- Don't change Mode/Model send paths (they work).

### 4.3 Approach

#### Fix RC1: Robust target selection + Target.targetCreated subscription

`discoverCDP` gains:
- Score each `JSON/list` target. Prefer, in order:
  1. URL contains `/cascade` (e.g. `cascade.html`, `cascade-client.html`), or worker whose `url` contains cascade-script paths.
  2. URL contains `workbench.html` AND an attached frame list contains a `cascade` iframe **and** that frame's context yields a non-empty `#conversation` element. (CDP `Page.getFrameTree` → `Runtime.evaluate` on child frame context.)
  3. Fallback to first `workbench.html` page target (today's behavior — but we WARN log if `#conversation` is empty AND no cascade frame is reachable).
- After initial connect, subscribe to `Target.setDiscoverTargets({discover:true})` and `Target.targetCreated` events. When a new page target appears whose URL matches a cascade-related pattern, **re-discover and migrate the active connection** to that target (close the old `cdpConnection.ws`, open a new one). This is the same pattern as today's reconnection logic (`startPolling`) — we re-use it on the signal.

The existing reconnect-on-stale logic in `startPolling` already runs every 2s and replaces `cdpConnection` on loss, but it doesn't recognize "target exists but wrong page". Adding the event-driven fast-path is small and additive.

#### Fix RC2: Pin history scraper to the actual panel root

`getChatHistory` rewritten to:
1. Locate the history trigger button via `data-tooltip-id="history-tooltip"` (verified to exist in the DOM probe).
2. Click it; poll for up to 3s for an **attached, focusable panel** using a tighter heuristic that doesn't escape to body:
   - Find `dialog[aria-label*="conversation" i], [role="dialog"]:has(input[type="text"])` first.
   - Fallback: walk up from the `input` only as long as `(rect.height < 600 || rect.width < 700)` to **avoid the full-screen shell**. Stop at first ancestor with `position:fixed | absolute | z-index>10` AND `width<500 && height>100`. If we never find one within 6 levels of the input, take the closest ancestor with a non-trivial border/shadow as the panel.
3. Scope ALL subsequent querySelector calls **inside** that pinned container.
4. Title extraction:
   - Prefer `<button>`, `[role="menuitem"]`, `[role="option"]`, and `<a>` descendants — these are the clickable rows in the panel.
   - If only `span` text is available, accept a span only when **all of**: text has no `${/\.[a-z0-9]{1,5}$/i.ext}` extension, no `:/` colon path, doesn't appear inside a Monaco editor subtree (`.monaco-editor`, `[class*="monaco-list"]`), and hasn't already been seen.
5. Add an extension/path skip-list regex: skip spans matching `\.(js|ts|tsx|jsx|css|html|json|md|py|ps1|sh|cpp|h|txt|csv|yml|yaml|gitignore)$` or `\.env(\.|$)` or `^/[A-Za-z]:/` (Windows path).
6. Keep the conservative text-based skip-list (`current`, `other conversations`, `recent in …`, `now`, etc.) but expand it with observed noise.

#### Fix RC3: Tighten snapshot scrubbing

In `captureSnapshot`:
- Drop the broad `.relative.flex.flex-col.gap-8` and `.flex.grow.flex-col.justify-start.gap-8` selectors — those patterns match **content containers**, not just the input wrapper.
- Keep the explicit `contenteditable="true"`, `[data-lexical-editor]`, `.fixed.bottom-0`, `.absolute.bottom-0` filters.
- When removing an editor, only walk up while the ancestor class contains `bg-`, `flex-row`, or `rounded` AND stays inside the editor wrapper (not the conversation root).
- Replace `rules.join('\\n')` with `rules.join('\n')` (one backslash — produce a real newline; in a template literal it would need `\\n`, but `data.css` is shipped as a plain string to `<style>.textContent`, so the JS runtime must emit an actual newline).

### 4.4 Components touched
- `server.js` — `discoverCDP`, `connectCDP` (add Target event hooks), `captureSnapshot` (CSS escape + scrub), `getChatHistory` (rewrite).
- No client (public/*) changes; no new endpoints; no new dependencies.

### 4.5 Testing strategy
Manual + scripted. After applying, the developer runs the launch script and the diagnose script (`node probe.mjs`) and confirms:
1. `/chat-history` no longer contains any `\.agents`, `\.vscode`, `\.env`, `GEMINI.md`-line rows; counts drop to ≤ 15 and titles look like chat titles.
2. With the desktop chat panel open and a chat containing at least 2 user messages, `GET /snapshot` returns `<div id="conversation">` whose `innerHTML.length > 200` and contains message bubbles.
3. With the desktop chat panel closed, the server logs a warning naming the missing cascade frame (no crash).
4. Existing single-line code copy buttons, Quick Action chips, history list tap behavior continue to work.

### 4.6 Risks
- Target-event refactor could temporarily disconnect active clients while connection migrates; mitigated by waiting for `cdp.ws.on('open')` before flipping the global pointer (so `lastSnapshot` and `captureScript` never use a stale socket).
- Tightening the scraper might over-filter and miss legitimate titles that contain `expected.md`-style strings. Mitigation: keep the path regex strict (only Word-style filenames) and only filter when the span is inside a non-button region.

### 4.7 Rollback
Single-file revert of `server.js` (one commit). Existing tag `v0.3.8` (HEAD) is the last "known working" for whoever had an old Antigravity version — keep it as the fallback pin.
