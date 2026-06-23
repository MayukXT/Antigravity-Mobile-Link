# Design System: Antigravity Mobile Link
**Project ID:** projects/antigravity-mobile-link

## 1. Visual Theme & Atmosphere
The interface utilizes a **Cyber-Chamber Minimalist** aesthetic. The atmosphere is quiet, utilitarian, and high-fidelity, matching professional tools like Vercel, Codex, and Claude. It employs an immersive pitch-black background, dark charcoal surfaces, thin high-contrast borders, and a single precise Google Blue/Mint green accent line to denote status and focus.

## 2. Color Palette & Roles
* **Pitch Black (#000000):** The primary canvas background, creating an immersive container that eliminates phone bezels.
* **Cyber Charcoal (#121214):** Card surfaces, navigation bars, and inputs, separating control surfaces from the canvas.
* **Elevated Grey (#1c1c1e):** Active states, hover focus containers, and highlighted buttons.
* **Tech Border (#27272a):** Thin dividers and border strokes, keeping panels distinct yet subtle.
* **Muted Text (#71717a):** Labels, secondary descriptions, and inactive states.
* **White (#ffffff):** High-contrast primary text, headers, and active icons.
* **Google Blue (#4285f4):** Primary brand accent, focus indicator, and primary buttons.
* **Mint Green (#10b981):** Active "Live" connection status and success indicators.
* **Stop Red (#f43f5e):** Destructive actions, warnings, and generation interrupt indicator.

## 3. Typography Rules
* **Font Family:** We use **Outfit** (a clean, geometric sans-serif with simple, professional curvature) for all headers, settings, and main buttons, and **Inter** for message bubbles and markdown content. Mono metrics are styled in **JetBrains Mono**.
* **Header Style:** Primary title is Outfit Bold (`20px`), letter-spacing `-0.02em`, set in crisp white. Sub-headings are Outfit SemiBold (`15px`).
* **Body Style:** Inter Regular (`14px` or `15px`), with a comfortable reading measure of `1.5` line-height.
* **Labels:** Outfit Medium (`11px`), tracking `0.05em` (uppercase).
* **Code Blocks:** JetBrains Mono (`13px`), styled with compact spacing (`line-height: 1.4`).

## 4. Component Stylings
* **Buttons:**
  - Standard action buttons are rectangular with blunt vertices (`border-radius: 6px`).
  - Active buttons trigger a subtle shrink transition (`transform: scale(0.96)`) using an elastic cubic-bezier easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
  - Standard control icons use a clean stroke of `1.75px` in White/Muted Grey, removing heavy backgrounds.
* **Cards/Containers:**
  - Card elements (history items, dialog panels) feature sharp but rounded corners (`border-radius: 6px`), a solid background of **Cyber Charcoal (#121214)**, a thin border of **Tech Border (#27272a)**, and no shadows for a flat, modern appearance.
* **Inputs/Forms:**
  - Textarea wrapper is styled as a rounded rectangle with a background of **Cyber Charcoal (#121214)**, blunt vertices (`border-radius: 6px`), and a thin outline.
  - Active text input has a glowing border of **Google Blue (#4285f4)** with no shadow.

## 5. Layout Principles
* **Whitespace & Padding:** Generous padding (`16px`) for primary touch surfaces, with a strict `8px` grid for spacing elements.
* **Navigation Layer:** Toggles open a full-screen slide-over drawer from the right. The drawer is styled in pitch black with charcoal group dividers.
* **Bottom Safe-Areas:** Safe-areas are dynamically padded at the bottom (`env(safe-area-inset-bottom)`) to ensure comfortable keyboard-open layouts.
