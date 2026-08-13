# Incident response

General flow for any security incident: **Detect → Contain → Investigate
→ Rotate credentials → Recover → Notify → Post-incident review.**

## Credential leak (JWT secret, DB password, LiveKit/OAuth/SMTP secret)

1. **Detect:** secret scanning alert, suspicious auth activity, or
   manual discovery.
2. **Contain:** rotate the leaked secret immediately.
   - JWT secrets: rotating `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`
     invalidates every existing access and refresh token — every user is
     logged out. This is the correct trade-off for a leaked signing key.
   - DB/Redis passwords: rotate at the provider, update `DATABASE_URL`/
     `REDIS_URL`, redeploy.
   - LiveKit/OAuth/SMTP: rotate at the respective provider's dashboard.
3. **Investigate:** check how the secret leaked (committed to git? logged
   somewhere? — grep logs for the secret value). Check auth/audit logs for
   activity in the window the secret was exposed.
4. **Recover:** redeploy with new secrets. Force re-login for all users if
   JWT secrets rotated (happens automatically since old tokens no longer
   verify).
5. **Notify:** if user data was plausibly accessed, follow applicable
   breach-notification requirements for your jurisdiction.
6. **Post-incident:** add the leaked-secret pattern to secret-scanning
   rules if it wasn't already caught.

## Account takeover

1. **Detect:** user report, anomalous login pattern (new IP/device +
   immediate sensitive action), or a report of leaked credentials
   elsewhere (credential stuffing).
2. **Contain:** revoke the affected user's sessions — invalidate their
   refresh token(s) via `tokens.service.ts`'s revoke path, force password
   reset.
3. **Investigate:** check what the attacker did while in the account
   (message history, community actions, settings changes) via audit
   trail / logs.
4. **Recover:** reset password, re-verify email if changed, restore any
   settings the attacker altered.
5. **Notify:** inform the affected user directly.

## Database breach

1. **Contain:** rotate `DATABASE_URL` credentials, review/tighten
   Postgres user grants (should already be least-privilege — see
   `deployment.md`), take a forensic snapshot before making further
   changes if the provider supports it.
2. **Investigate:** what tables were queryable, what the DB user's
   actual grants were, access logs from the provider if available.
3. **Recover:** restore from a known-good backup if data was
   modified/deleted (see `docs/database/backup-and-recovery.md`).
4. **Notify:** password hashes (bcrypt) and any PII in scope should be
   assumed compromised; follow applicable breach-notification
   requirements. Force a global logout (rotate JWT secrets) as a
   precaution even if tokens weren't directly exposed.

## Malicious upload

1. **Contain:** the upload allow-list (see H3 in `findings.md`) already
   blocks the highest-risk types (HTML/SVG/executables). If something
   still gets through, remove the specific file(s) via the storage
   driver's `delete()`, and audit `assertWithinLimits`'s allow-list for
   the gap.
2. **Investigate:** who uploaded it, to which conversation/community, and
   whether it was downloaded/viewed by others.
3. **Recover:** delete the file, notify affected recipients if it was
   distributed as malware.

## DDoS

Out of scope for the application layer — this needs to be handled by the
CDN/WAF in front of the API (see `deployment.md`'s network topology).
Rate limiting inside the app (`ThrottlerModule`) protects against abuse
from authenticated/identifiable clients, not a volumetric DDoS.

## OAuth provider compromise

1. **Contain:** revoke/rotate the app's OAuth client secret at the
   provider's dashboard immediately — this invalidates the app's ability
   to complete new OAuth flows, containing further damage.
2. **Investigate:** check for unexpected account-linking activity in the
   window of compromise.
3. **Recover:** issue new client credentials, redeploy, re-test the OAuth
   flow end-to-end in staging before restoring in production.

---

# Rollback strategy

## Application rollback (no migration involved)

Redeploy the previous container image / previous build artifact. `git
revert` alone is not a rollback — it changes source, not what's running.
The actual rollback is redeploying the previous known-good build.

## Migration rollback

Prisma migrations are **forward-only** by default — there is no
`migrate down`. Never assume rolling back application code alone also
rolls back a migration that already ran.

- **If the migration hasn't been applied to production yet:** just don't
  deploy it. Safe.
- **If it has been applied and needs to be undone:** write and apply a
  new forward migration that reverses the change (e.g. re-add a dropped
  column, drop an added constraint). Treat this the same as any other
  schema change — review it, test it against a copy of production data
  if the change is non-trivial.
- **If the migration caused data loss** (e.g. a dropped column that had
  data): the only real fix is restoring from backup for the affected
  table/rows — see `docs/database/backup-and-recovery.md`. This is why
  destructive migrations should ship as two deploys (stop writing to the
  column, then drop it later) rather than one, per the existing guidance
  in `docs/database/migration-strategy.md`.

## Bad deployment, general

1. Redeploy the last known-good image/build immediately — restoring
   service comes before root-causing.
2. If the bad deploy included a migration that's safe to leave in place
   (additive, non-breaking), leave it and just roll back the app code.
3. If the bad deploy's migration is *not* backward-compatible with the
   previous app version, you cannot roll back app code alone — you need
   a compensating forward migration first (see above), then redeploy the
   previous app version.
4. Document what happened and why, per the change-control note below.

## Change control for risky production changes

Before any change flagged as risky (schema migration, secret rotation,
infra topology change), document:

- **What** is changing
- **Why**
- **Risk** (what could go wrong, and how bad)
- **Rollback plan** (specifically — not just "we'll figure it out")
- **Verification** (how you'll confirm it worked before considering it
  done)
