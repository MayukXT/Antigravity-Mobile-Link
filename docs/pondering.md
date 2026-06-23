# Pondering: UI/UX Architecture & Mobile Layout Strategy

This document details the visual and interaction strategies for redesigning the **Antigravity Phone Connect** web application.

---

## 1. User Context & Goals

### Why do users connect via mobile?
- **Desk-Freedom:** Users want to step away from their monitors (for coffee, breaks, or moving around) while keeping track of their AI's progress.
- **Convenient Approvals:** A significant portion of AI session time is spent waiting for permission gates (e.g., running commands, applying file changes, allow once). Tapping Allow/Deny on a phone is faster than walking back to the desk.
- **Real-Time Progress Tracking:** Users need to see if the agent is stuck, in an infinite loop, or actively editing files.

---

## 2. Layout Architecture (Mobile First)

Phone displays are vertically constrained. Browser headers and navigation bars eat into the viewport height. We must preserve every pixel for the chat mirror while keeping primary controls accessible.

```
+-------------------------------------------------+  <- 0px (Top)
| [Logo]                    [+]  [Clock]  [Stop]  |  <- Minimal Header (48px)
+-------------------------------------------------+
| [ Mode: Fast ]   [ Model: Gemini ]   [ 45KB ]   |  <- Blunt-vertex Setting Tray (38px)
+-------------------------------------------------+
|                                                 |
|  [ Thinking... (Collapsible Card) ]             |  <- Monospace agent state
|                                                 |
|  [ Agent Message / Generated Code ]             |
|                                                 |
|  [ Accept (Blue) ]      [ Reject (Crimson) ]    |  <- Blunt-vertex Action Cards (>=44px height)
|                                                 |
+-------------------------------------------------+
|   Explain Code  |  Fix Bugs  |  Create Docs     |  <- Quick Action tray (no pills, blunt rectangles)
+-------------------------------------------------+
| [ + ] [ Message Antigravity...               ]  |  <- Input Box (48px, border-radius: 8px)
+-------------------------------------------------+  <- bottom-safe-area
```

### Layout Rules for Phone Screen:
1. **Dynamic Viewport Height (`100dvh`):** Standard `100vh` ignores browser address bars on iOS/Android, leading to cut-off input bars. We must enforce `100dvh` with `body { overflow: hidden; }` so that only the chat pane scrolls.
2. **Virtual Keyboard Adjustments:** When the input focus is active, the keyboard pushes the layout up. We use JavaScript's `visualViewport` API to dynamically shrink the application height, preventing input occlusion.
3. **No Tooltips & Hover States:** Phone browsers trigger hover styles on tap, which often get "stuck." We explicitly style elements for tactile `:active` states (scale shrink to `0.96` with dynamic background highlight) and omit hover tooltips.

---

## 3. Component & Button Specifications (No Pills/Capsules)

### Blunt Vertices Design Language:
The user explicitly requested **no capsule or pill shapes** (which feel soft/generic). We adopt a technical, professional **blunt-vertices rectangular** theme (`border-radius: 6px` or `8px` for inputs and cards).

- **Header Buttons:** Icon-only with obvious, high-contrast SVG stroke shapes.
- **Settings & Chips:** Rounded rectangles (`border-radius: 6px`) with dark charcoal backings.
- **Action Buttons (Accept/Reject):**
  - High-visibility action bars matching the CDP buttons (e.g., Allow, Deny, Run).
  - Tappable targets are at least `44px` high (Apple touch minimum) to avoid fat-finger errors.
  - Colors are distinct:
    - Primary/Accept/Allow: Google Blue (`#4285f4`) base with white text.
    - Danger/Reject/Stop: Dark Crimson (`#f43f5e`) base with white text.
    - Secondary/Review: Slate/Charcoal (`#27272a`) base with muted text.

---

## 4. Real-Time Agent Collapsible States

To keep the screen clean and readable, the agent's intermediate processing logs (e.g., "Thinking...", "Worked for...", "Edited files...") are presented as **collapsible cards**:
- Styled in dark charcoal (`#121214`) with a blunt border-radius (`8px`).
- Left-aligned indicator line colored in muted gray or status green.
- Clean right-aligned chevron arrow (`v` / `>`) showing state.
- Tap gesture is bound to the server's remote click handler to trigger the expansion/collapse of the desktop agent tree.
- Text content is presented in **JetBrains Mono** with tight line height.
