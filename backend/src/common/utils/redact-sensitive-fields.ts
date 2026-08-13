/**
 * See src/common/interceptors/redact-sensitive-fields.interceptor.ts for
 * the full rationale. Shared here because the realtime gateway emits
 * payloads directly via `server.emit(...)` from `@OnEvent` handlers, which
 * run outside Nest's HTTP interceptor pipeline entirely — so the
 * interceptor alone does not cover Socket.IO broadcasts and this same
 * scrubbing has to be applied at the point of `.emit()` too.
 */
const SENSITIVE_KEYS_ON_LEAKED_USER = [
  'passwordHash',
  'email',
  'emailVerifiedAt',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

export function redactSensitiveFields(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item, seen));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  if (seen.has(value)) return value;
  seen.add(value);

  const isLeakedUserRow = 'passwordHash' in value;

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (isLeakedUserRow && SENSITIVE_KEYS_ON_LEAKED_USER.includes(key)) {
      continue;
    }
    result[key] = redactSensitiveFields(val, seen);
  }
  return result;
}
