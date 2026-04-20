# Skills Guide For This Project

This file captures the skills currently available in this repository and recommended skills to add for building the local-first Electrobun productivity app described in `ARCHITECTURE.md`.

## Project-Local Skills (Already Installed)

These are present under `.agents/skills/`:

- `electrobun`
- `electrobun-best-practices`
- `grill-me`

## How To Use Skills

### 1) Implicit use (default)

Describe the task normally. If a relevant skill exists, it should be used automatically.

Examples:

- "Help me build an Electrobun app"
- "Apply Electrobun best practices to this config"
- "Grill me on this architecture plan"

### 2) Explicit use (recommended when you want control)

Call out the skill directly:

- "Use `electrobun` and scaffold the app shell."
- "Use `grill-me` and ask one question at a time."
- "Use `electrobun-best-practices` to review this implementation."

Practical prompt structure:

- Goal
- Skill
- Scope
- Output format

## Skills Recommended For This App

Based on the architecture and planned roadmap.

### Must-Have

- `electrobun` (already local)
- `electrobun-best-practices` (already local)
- `grill-me` (already local)
- `database-schema-design`
- `workflow-automation`
- `security-best-practices`
- `code-review`

### Very Useful

- `tdd`
- `systematic-debugging`
- `tailwind-design-system`
- `shadcn` / `shadcn-ui` related skill

### Later / Scale Phase

- `gh-cli`
- `mcp-builder`
- `skill-creator`

## React-Specific Recommendations

For your React + Tailwind + shadcn setup, prioritize:

1. `vercel-react-best-practices`
2. `shadcn` / `shadcn-ui` skill
3. `tailwind-design-system`
4. `react:components`

These are especially helpful for:

- keeping widget/component patterns consistent across many features
- preventing React state and rendering anti-patterns as plugin count grows
- enforcing a coherent design system in a dashboard-style app

## Skills Directory

Source for finding and evaluating skills:

- [skills.sh](https://skills.sh/)

## Skill Matrix By Build Phase

Mapped to the build order in `ARCHITECTURE.md`.

| Build Phase | Primary Skills | Why These Skills |
|---|---|---|
| 1. Core shell (tray, empty grid, registry, DB manager) | `electrobun`, `electrobun-best-practices`, `database-schema-design` | Correct Electrobun process wiring, safer defaults, solid core DB foundations |
| 2. Todo List feature | `electrobun`, `vercel-react-best-practices`, `react:components` | Implements first full feature contract with clean React widget/full-view patterns |
| 3. Script engine | `workflow-automation`, `database-schema-design`, `security-best-practices` | Event/action orchestration, queue schema quality, strict script boundaries |
| 4. Pomodoro feature | `electrobun`, `vercel-react-best-practices`, `tdd` | Timer behavior + cross-feature hooks, with reliable tests for time-based logic |
| 5. RSS Reader feature | `workflow-automation`, `systematic-debugging`, `security-best-practices` | Scheduled fetch flows, retry/debug instrumentation, safer handling of external input |
| 6. Clock + Weather | `electrobun-best-practices`, `react:components`, `tailwind-design-system` | Lightweight widget UX and predictable refresh/data presentation |
| 7. Command palette + notifications + theming | `vercel-react-best-practices`, `tailwind-design-system`, `shadcn` / `shadcn-ui` | Shared UI quality, consistency, accessibility, and theme token discipline |
| 8. Daily Journal + Global Search + Focus Mode | `workflow-automation`, `database-schema-design`, `systematic-debugging` | Cross-feature aggregation and query correctness with strong debugging support |
| 9. Calendar + Habits + Bookmarks + Countdowns | `security-best-practices`, `workflow-automation`, `code-review` | Integrations and automations with tighter review and safer defaults |
| 10. Clipboard + Snippets + scale-out polish | `tdd`, `code-review`, `gh-cli` | Stability and release workflow maturity as feature count grows |

## Quick Start Skill Stack (Minimal)

If you only install a few additional skills first, use this order:

1. `database-schema-design`
2. `workflow-automation`
3. `security-best-practices`
4. `vercel-react-best-practices`
5. `tdd`

## Example Prompts Per Phase

- Core shell: "Use `electrobun-best-practices` to set up a tray-first shell with safe defaults."
- Todo feature: "Use `vercel-react-best-practices` to shape Todo widget and full view components."
- Script engine: "Use `workflow-automation` to design event -> script -> action queue execution."
- RSS: "Use `systematic-debugging` to validate scheduled fetch retry/backoff behavior."
- UI polish: "Use `tailwind-design-system` and `shadcn` patterns for consistent dashboard widgets."

