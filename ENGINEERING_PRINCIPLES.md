# CODEOWNERS — replace placeholder with your GitHub handle after bootstrap.
# These paths require an extra review pass before merge.

*                                @__GITHUB_OWNER__

# Hard-protected paths — schema, auth, env. Touching these is high-risk.
/lib/auth/                       @__GITHUB_OWNER__
/lib/env/                        @__GITHUB_OWNER__
/lib/db/                         @__GITHUB_OWNER__
/lib/authz.ts                    @__GITHUB_OWNER__
# Add the privileged data-access paths for this repo.
# See RUNTIME.md § High-risk paths.
/__PRIVILEGED_DATA_ACCESS__      @__GITHUB_OWNER__
/lib/__tests__/                  @__GITHUB_OWNER__
/__MIGRATIONS_DIR__/             @__GITHUB_OWNER__
/.github/                        @__GITHUB_OWNER__
/CLAUDE.md                       @__GITHUB_OWNER__
/AGENTS.md                       @__GITHUB_OWNER__
/CODEX.md                        @__GITHUB_OWNER__
/docs/ENGINEERING_PRINCIPLES.md  @__GITHUB_OWNER__
/docs/CODING_STANDARDS.md        @__GITHUB_OWNER__
/docs/DESIGN_DECISIONS.md        @__GITHUB_OWNER__
/docs/MIGRATION_RUNBOOK.md       @__GITHUB_OWNER__
