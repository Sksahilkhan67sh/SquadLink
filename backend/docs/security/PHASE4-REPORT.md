# SquadLink — Phase 4 report: Security, Hardening & Launch Readiness

## Security audit summary

Full findings with file/line detail: `docs/security/findings.md`.

| Severity | Count | Status |
|---|---|---|
| Critical | 3 | All fixed |
| High | 4 | All fixed |
| Medium | 10 | All fixed |
| Low / informational | 4 | Documented, accepted (with reasoning) |

**Critical fixes:**
1. Raw `User` rows (bcrypt `passwordHash` + email) were leaking through
   nested Prisma `include`s on ~7 endpoints/events with no serialization
   boundary — closed with a global response-redaction interceptor plus
   the same redaction applied to Socket.IO broadcasts.
2. `POST /voice/reconnect` issued LiveKit tokens with no membership
   check — any authenticated user could join any voice room.
3. Socket.IO `conversation:join`/`party:join` had no authorization check
   — any authenticated socket could join any conversation/party room and
   silently receive other users' messages.

**High fixes:** cross-community IDOR on channel/role management
(confused-deputy pattern — target ID never checked against the
already-verified parent ID), cross-conversation IDOR on message pinning,
unrestricted attachment MIME types (stored-XSS risk), and a silent
hardcoded fallback secret for LiveKit token signing that would have been
exploitable if a production deploy ever forgot to set the real secret.

## Verification summary

| Check | Result |
|---|---|
| Backend `npm ci` | ✅ Passed |
| Backend `npm audit` | ✅ 0 vulnerabilities (was 1 high — `js-yaml` DoS, fixed via `overrides`) |
| Backend `npx tsc --noEmit` | ⚠️ **NOT FULLY VERIFIED** — see below |
| Backend `eslint` (files touched this phase) | ✅ 0 errors, 0 warnings after fixes |
| Backend `eslint` (whole repo) | ⚠️ **NOT VERIFIED** — dominated by a Prisma-client generation issue, see below |
| Backend `npm run build` / `npm test` / `prisma generate` / `prisma validate` | ❌ **NOT VERIFIED** — blocked by sandbox network restriction |
| Frontend `npm ci` | ✅ Passed |
| Frontend `npm run build` (`tsc -b && vite build`) | ✅ Passed |
| Frontend `npm run lint` (oxlint) | ✅ 0 errors, 1 pre-existing non-security warning |
| Frontend `npm audit` | ✅ 0 vulnerabilities |
| Docker build / Docker Compose | ❌ **NOT VERIFIED** — no Docker daemon in this sandbox |
| Load testing (100/500/1000 concurrent) | ❌ **NOT VERIFIED** — no reachable deployment target |
| Secret scanning of git history | N/A — this deliverable has no `.git` directory (plain source export); source tree itself was pattern-scanned, no committed secrets found |

### Why Prisma-dependent checks are unverified

This sandbox's outbound network is restricted to a package-registry
allowlist (npm, PyPI, crates, GitHub) and does **not** include
`binaries.prisma.sh`, which `prisma generate`/`prisma validate`/the
Nest build all require to download the Prisma query/schema engine
binaries. Every attempt returned `403 Forbidden` from that host — this
is a sandbox restriction, not a project defect.

Practical effect: `npx tsc --noEmit` and `npm run lint` report several
hundred `@typescript-eslint/no-unsafe-*` errors across the codebase.
I verified these are **not new problems** — every single one traces back
to Prisma model/enum types resolving to `any` because the client was
never generated (e.g. `Module '"@prisma/client"' has no exported member
'User'`). I specifically lint/type-checked every file touched in this
phase in isolation and confirmed zero non-Prisma-cascade errors (two
real issues were found this way and fixed: an unnecessary `async` with
no `await`, and a Prettier formatting nit).

**To get a real, clean result, run this outside the sandbox:**
```bash
cd backend
npm ci
npx prisma generate
npx prisma validate
npm run build
npm run lint
npm run test
npm run test:integration   # requires a running Postgres — see docs/database/testing.md
docker build -t squadlink-api .
docker compose up -d
```

## Production readiness

**READY WITH KNOWN LIMITATIONS.**

The Critical/High findings that would have blocked a real launch (secret
leakage, unauthorized voice/message access, cross-tenant IDOR) are fixed
and reasoned through in `findings.md`. What's *not* claimed here, because
it genuinely wasn't possible to verify in this environment:

- A full green `npm run build`/`npm test` run (blocked by Prisma engine
  network access — see above). Run the commands listed above before
  deploying.
- Load testing at any concurrency level — not executed, no reachable
  target. See `deployment.md`'s load-testing section for exact commands
  to run against a staging environment.
- Docker build/Compose — not executed, no Docker daemon available here.
  The Dockerfile and docker-compose.yml were reviewed and hardened
  (non-root user, healthcheck, no public DB/Redis ports) but not
  actually built/run.
- Restore-from-backup testing — inherited as already-documented,
  not-yet-executed guidance from Phase 3 (`docs/database/backup-and-recovery.md`);
  unchanged by this phase.

None of the above are "the code looks insecure" concerns — they're
"this specific check requires infrastructure this sandbox doesn't have"
limitations. Run the listed commands in a real environment (or CI) before
calling this launched.

## Documentation delivered

- `docs/security/findings.md` — full audit findings (this report's detail)
- `docs/security/threat-model.md` — assets, trust boundaries, auth/authz model
- `docs/security/deployment.md` — network topology, env vars, health checks, monitoring, load-testing instructions
- `docs/security/incident-response.md` — incident playbooks + rollback strategy
