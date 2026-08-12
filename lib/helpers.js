export function jsonError(message, status = 400, extra = {}) {
  return Response.json({ ok: false, error: message, ...extra }, { status });
}

export function clampInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
