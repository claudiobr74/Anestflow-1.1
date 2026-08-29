import { useEffect, useRef } from "react";
import {
  ensureSessionClock,
  evaluateSession,
  evaluateWorkstationLock,
  readSessionClock,
  touchSession,
  type SessionViolation,
} from "./sessionPolicy";

const ACTIVITY_THROTTLE_MS = 10_000;
const POLL_MS = 15_000;

/**
 * Encerra a sessão no cliente após 12h absolutas ou 8h ociosas.
 * Checa antes de registrar atividade para o clique que estoura o limite
 * não “renovar” o relógio.
 */
export function useSessionGuard(
  enabled: boolean,
  onExpire: (reason: SessionViolation) => void,
  options?: { locked?: boolean; onLock?: () => void }
) {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const onLockRef = useRef(options?.onLock);
  onLockRef.current = options?.onLock;
  const lockedRef = useRef(Boolean(options?.locked));
  lockedRef.current = Boolean(options?.locked);
  const expiringRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      expiringRef.current = false;
      return;
    }

    ensureSessionClock();
    let lastTouch = 0;

    const expireIfNeeded = (): boolean => {
      if (expiringRef.current) return true;
      const clock = readSessionClock();
      const violation = evaluateSession({ ...clock, now: Date.now() });
      if (!violation) return false;
      expiringRef.current = true;
      onExpireRef.current(violation);
      return true;
    };

    const lockIfNeeded = (): boolean => {
      if (lockedRef.current) return true;
      const clock = readSessionClock();
      if (evaluateWorkstationLock({ ...clock, now: Date.now() })) {
        onLockRef.current?.();
        return true;
      }
      return false;
    };

    const onActivity = () => {
      if (expireIfNeeded()) return;
      if (lockedRef.current) return;
      if (lockIfNeeded()) return;
      const now = Date.now();
      if (now - lastTouch < ACTIVITY_THROTTLE_MS) return;
      lastTouch = now;
      touchSession(now);
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (lockedRef.current) {
        expireIfNeeded();
        return;
      }
      onActivity();
    };

    expireIfNeeded();
    lockIfNeeded();
    const poll = window.setInterval(() => {
      if (expireIfNeeded()) return;
      lockIfNeeded();
    }, POLL_MS);
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
