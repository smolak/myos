# Context Map

MyOS is a multi-context repo: the core (microkernel) is one bounded context, and every feature under `src/features/` is its own bounded context with its own language, database, and decision log. Feature contexts get a `CONTEXT.md` (glossary) and `docs/adr/` (decisions) lazily — only once they have something to record.

## Contexts

- **Core** ([specs/UBIQUITOUS_LANGUAGE.md](./specs/UBIQUITOUS_LANGUAGE.md)) — the microkernel: feature system, event bus, action queue, dashboard shell, and infrastructure. Its glossary is the tie-breaker for core terms only. System-wide decisions live in [specs/ARCHITECTURE-RATIONALE.md](./specs/ARCHITECTURE-RATIONALE.md).
- **RSS Reader** ([src/features/rss-reader/CONTEXT.md](./src/features/rss-reader/CONTEXT.md)) — subscribes to feeds and collects their entries for reading.

## Relationships

- **Core → Features**: Core defines the `FeatureDefinition` contract; features implement it and are orchestrated by the FeatureRegistry.
- **Feature ↔ Feature**: Never direct. All cross-feature communication flows through the core's Event Bus (notifications) and Action Queue (mutations).
