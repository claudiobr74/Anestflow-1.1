const windows = new Map<string, { count: number; resetTime: number }>();

/** Best-effort per-isolate limiter (Edge isolates are not sticky). */
export function allowRequest(uid: string, maxRequests = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const record = windows.get(uid) ?? { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
  } else {
    record.count += 1;
  }

  windows.set(uid, record);
  return record.count <= maxRequests;
}
