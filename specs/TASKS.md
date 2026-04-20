# Task Management

Tasks live in the `tasks/` directory as numbered Markdown files (`0001.md`, `0002.md`, etc.).

They are the development roadmap for this project, derived from the build order in `ARCHITECTURE.md`.

---

## Task Registry

| # | Title | Phase | Status | Outcome |
|---|---|---|---|---|
| 0001 | Cleanup demo template and restructure project | Pre-phase | Complete | Vertical slice layout, shell tray app, dashboard placeholder, configs updated |
| 0002 | Install core dependencies and define type system | Phase 1 — Core Shell | Complete | Core deps, Vitest setup, `src/core/types/*`, path aliases; Bun/Vitest scripts scoped to `./src/core/bun` and `./src/features` with `--pass-with-no-tests` / `passWithNoTests` |
| 0003 | Implement the Database Manager | Phase 1 — Core Shell | Complete | `DatabaseManager`, migration runner, core migration `001` (features + settings), `DatabaseManagerConfig`, `bun:test` coverage |

> **Next task:** Add the next numbered task to the registry when defined — 0003 is complete.

> **Maintaining this table:** Add a row when a new task is created. Update Status and Outcome when a task completes. The Outcome column is a single sentence summarizing what the task delivered. Update the "Next task" pointer when a task completes.

---

## Reading Strategy (for AI agents)

1. **Always start here.** Read the Task Registry table above to understand project state.
2. **Only open the full task file for the task you're actively working on.**
3. **For dependencies:** read just the TL;DR section at the top of the dependency task file (first ~15 lines). Don't read the full steps/criteria of completed tasks.
4. **For architecture questions:** read `ARCHITECTURE.md`, not old task files. Tasks implement the architecture — they don't define it.
5. **For testing conventions:** read `TESTING.md` before writing any tests. It defines file placement, naming, patterns, assertion style, and API design guidelines.
6. **For coding conventions:** read `CONVENTIONS.md` before writing any implementation code. It defines SOLID principles, bounded context rules, TypeScript conventions, and React patterns for this project.

---

## Task Philosophy

- **Small to medium scope.** Each task should be completable in a single focused session. If it feels like it needs sub-tasks with their own acceptance criteria, split it.
- **Easy to implement.** Steps should be concrete and unambiguous. A task should never require major design decisions — those belong in `ARCHITECTURE.md` or a dedicated planning session before the task is written.
- **Easy to verify.** Every task has explicit acceptance criteria that can be checked mechanically (compiler passes, app launches, behavior is observable, tests pass).
- **TDD by default.** For any task that implements logic (functions, classes, handlers, components), follow red-green-refactor: write a failing test first, confirm it fails, then implement to make it pass. Skip TDD only when it is genuinely impractical — e.g. pure config changes, type-only files, or UI layout work with no testable logic.

## Task Format

Every task file follows this structure:

```markdown
# Task NNNN: Short Descriptive Title

**Status:** Not started | In progress | Complete
**Phase:** Which build phase from ARCHITECTURE.md
**Depends on:** Task numbers this builds on
**Blocked by:** Anything preventing work from starting
**Skills to use:** Relevant skills from SKILLS.md

---

## TL;DR (completed)
<!-- Added when the task is marked Complete. 2-4 lines max. -->
What was delivered in plain language. Key files created/changed.
This is what AI agents read instead of the full task.

---

## Context
Why this task exists and how it fits into the bigger picture.

## Steps
### Part A: ...
### Part B: ...
Concrete, ordered steps. Include code snippets, file paths, commands.

## Acceptance Criteria
- [ ] Checkable items that prove the task is done

## Notes
Constraints, things explicitly out of scope, gotchas.

## Estimated Effort
Small | Small-to-medium | Medium
```

### TL;DR Convention

When a task is completed, add a `## TL;DR (completed)` section right after the metadata block. This section should:

- Be 2–4 lines maximum
- State what was delivered (not what was planned)
- List key files or directories created/changed
- Be sufficient for an AI agent to understand the task's output without reading the full file

## Rules for Writing Tasks

1. **One concern per task.** "Install dependencies and define types" is fine. "Install dependencies, define types, implement the database manager, and build the settings UI" is too much.
2. **Explicit scope boundaries.** Every task should say what it does NOT do, to prevent scope creep.
3. **Reference ARCHITECTURE.md.** Tasks implement the architecture — they don't invent new architecture. If a task requires a design decision not covered in the architecture doc, update the architecture doc first.
4. **Include verification steps.** At minimum: TypeScript compiles, app launches, observable behavior matches expectations.
5. **State dependencies clearly.** If task 0005 requires task 0003 and 0004 to be done, say so. Don't leave implicit ordering.
6. **Keep code snippets illustrative.** Show enough to communicate intent. The implementer reads the architecture doc for the full specification.
7. **Every task that implements logic must include tests.** If the task creates functions, classes, handlers, or components, it must have a "Write tests" step and test-related acceptance criteria. The only exceptions are tasks that are purely types, config, or file structure. Follow the conventions in `TESTING.md`.

## Numbering

Tasks are numbered sequentially: `0001`, `0002`, `0003`, etc. Numbers are never reused. If a task is abandoned, mark its status as "Cancelled" — don't delete the file.

## Status Tracking

Update the `**Status:**` field in each task file as work progresses:

- **Not started** — written but no work begun
- **In progress** — actively being worked on
- **Complete** — all acceptance criteria met, changes committed
- **Cancelled** — no longer needed (leave a note explaining why)
