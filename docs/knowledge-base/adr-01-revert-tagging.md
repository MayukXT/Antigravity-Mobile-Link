# Architecture Decision Record (ADR 01): Autocomplete Tagging & Git Revert Integration

## Status
Approved

## Context
Mobile developers need to tag workspace files (`@`) and toggle active skills/MCP servers (`#`) within the mobile text input bar. Additionally, they require the ability to revert locally modified files to their last committed state directly from the mobile settings drawer.

---

## Decision: Tagging System (`@` and `#`)

### 1. File Autocomplete (`@`)
* **Endpoint:** `GET /api/workspace-files`
* **Implementation:** The backend recursively walks the project directory (excluding `node_modules`, `.git`, `venv`, and `certs`) and returns relative paths.
* **Frontend:** 
  - Listens to input event on `textarea#messageInput`.
  - Triggers on matching a word starting with `@`.
  - Filters results against cached files list using a query string matching search.
  - Tapping an item inserts standard syntax `@[relative/path/to/file]`.

### 2. Skills & MCP Autocomplete (`#`)
* **Endpoint:** Shared with `GET /api/settings`
* **Frontend:**
  - Triggers on matching a word starting with `#`.
  - Filters and displays active skills and MCP servers.
  - Tapping inserts `#skill-id`.

---

## Decision: Workspace Git Control (Revert Changes)

### 1. Git Status API
* **Endpoint:** `GET /api/git-status`
* **Implementation:** Runs `git status --porcelain` in the workspace directory.
* **Output Format:**
  ```json
  {
    "success": true,
    "files": [
      { "status": "M", "path": "src/server.js" }
    ]
  }
  ```

### 2. Git Revert API
* **Endpoint:** `POST /api/revert`
* **Payload:** `{ files: ["src/server.js"], all: false }`
* **Implementation:**
  - If `all` is `true`, executes `git checkout -- .` to revert all modifications.
  - If `files` is a list, escapes filenames and runs `git checkout -- <files>` on specified files.

### 3. Safety Controls
- Reverting files is irreversible.
- The UI presents a dedicated checkbox modal `#revertOverlay` where developers must select modified files and click "Revert Selected" to confirm, protecting against accidental reverts.
