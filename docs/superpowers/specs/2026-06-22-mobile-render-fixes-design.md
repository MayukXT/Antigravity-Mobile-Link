# Mobile Render, Chat History & Quick Input Fixes

**Status:** approved
**Date:** 2026-06-22

## 1 — Problem Statement

Users running `Antigravity Phone Connect` report the following bugs:
1. **Empty Chat Box on Phone:** The chat mirror area on the mobile device displays nothing, even when messages are active on the desktop.
2. **Noise in Chat History:** The conversation history sidebar scraper pulls workspace file paths (`.env`, `.agents/RULES.md`, etc.) and Monaco editor line segments instead of actual chat conversation titles.
3. **Workspace Prompt Dialog Lock:** When switching chats, the desktop IDE prompts the user to select where to open the conversation (e.g. current window or workspace). Since this dialog is outside the chat mirror area, it is not captured, leaving the phone screen stuck in a loading loop.

---

## 2 — Core Design Architecture

### 2.1 CSS Scrubber Refinement (Chat Mirror Fix)
- In `server.js:captureSnapshot()`, remove the aggressive `.relative.flex.flex-col.gap-8` and `.flex.grow.flex-col.justify-start.gap-8` selectors from the `interactionSelectors` list.
- Restrict editor input block cleanup: When removing elements matching `[contenteditable="true"]`, only walk up parents that contain styling classes like `bg-`, `flex-row`, or `rounded` and explicitly prevent descending into message row elements.
- Keep the escaped newline source (`rules.join('\\n')`) inside the CDP-injected template string. Using `rules.join('\n')` in server source emits an invalid newline inside the evaluated runtime script and breaks snapshot capture.

### 2.2 Panel-Scoped Scraper with Extension Filters (History Fix)
- In `server.js:getChatHistory()`, find the history trigger button and poll for up to 3s for an elevated panel:
  - Anchor on `dialog[aria-label*="conversation" i]` or `[role="dialog"]:has(input[type="text"])`.
  - Fallback: Locate the search input and walk up parents, stopping at the first element with `position: fixed | absolute | z-index > 10` that has a width **under 500px** (this avoids climbing to the full-screen window body).
- Retrieve only text nodes from inside this panel.
- Skip titles matching common file extensions (`\.(js|ts|jsx|tsx|css|html|json|md|py|sh|cpp|h|txt|yaml|yml|gitignore)$`) or containing path separators (`/` or `:/`).
- Skip any elements inside a Monaco editor subtree (`.monaco-editor` or `[class*="monaco-list"]`).

### 2.3 Interactive Quick Pick Modal (Prompt Dialog Fix)
- **State Capture:** In `server.js:getAppState()`, check if the VS Code Quick Input widget (`.quick-input-widget`) is open on the desktop. If it is, extract its title and list option rows (`.quick-input-list-row` or `.monaco-list-row`). Include this structure in the `/app-state` JSON response as a `quickInput` payload:
  ```json
  "quickInput": {
      "title": "Select where to open the conversation",
      "options": [
          { "index": 0, "text": "Open in Current Window" },
          { "index": 1, "text": "Open in New Workspace" }
      ]
  }
  ```
- **Click Delegation:** Enhance `server.js:clickElement()` so that if the selector is not found inside the chat container (`#conversation`), it falls back to querying the entire `document`. This allows clicking `.monaco-list-row` rows outside the chat panel.
- **Mobile Prompt Modal:** Add a modal element `#quickInputOverlay` in `index.html` styled with blunt-vertices charcoal boxes. When `quickInput` state is detected in the polling loop, open this modal overlay. Tapping an option makes a POST to `/remote-click` targeting the row's index on the desktop.

---

## 3 — Verification Plan

- Start the server using the standard launch script.
- Confirm the main chat panel mirrors conversation bubbles successfully.
- Verify that opening the history list displays only actual chat titles (no workspace folders or code snippets).
- Trigger a conversation switch and verify the workspace dialog pops up on the phone as a clean, interactive modal. Click "Open in Current Window" and verify the chat switches properly.

## 4 - 2026-06-23 Implementation Notes

- Snapshot capture now returns per-context diagnostics instead of a silent `null`, making CDP/DOM failures visible in server logs.
- History loading is split into short bounded CDP evaluations: one to open the history panel, one repeated poll to scrape the visible panel.
- Composer cleanup has a final narrow pass for current Antigravity side-panel input markup and isolates invalid selector failures so one selector cannot abort the full cleanup batch.
- `npm test` runs `tests/test_scraping.js` against `tests/mock_cascade.html`, including action-button preservation and current composer removal.
