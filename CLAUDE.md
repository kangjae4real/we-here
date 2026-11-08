@AGENTS.md

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- QA/testing site behavior → invoke /qa
- Code review/diff check → invoke /review
- Ship/deploy/PR → invoke /ship

PRs target `develop`; never `main`.

Do not suggest or auto-invoke other gstack skills: they run when the user types them, or when a running skill hands off to them (`gstack-config set proactive all` routes every skill).

## Testing

- API tests: `pnpm --filter api test` (Vitest, `apps/api/vitest.config.ts`, `**/*.spec.ts`). HTTP tests: `pnpm --filter api test:e2e`.
- Lint: `pnpm lint` (turbo: web Biome, api oxlint).
- The web app has no test runner yet; the plan in `docs/designs/we-here.md` adds Vitest + Testing Library in week 1.
