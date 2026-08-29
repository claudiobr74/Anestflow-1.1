import { useEffect, useRef } from "react";
import {
  ensureSessionClock,
  evaluateSession,
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
export function useSessionGuard(enabled: boolean, onExpire: (reason: SessionViolation) => void) {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
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
      const violation = evaluateSession({ ...readSessionClock(), now: Date.now() });
      if (!violation) return false;
      expiringRef.current = true;
      onExpireRef.current(violation);
      return true;
    };

    const onActivity = () => {
      if (expireIfNeeded()) return;
      const now = Date.now();
      if (now - lastTouch < ACTIVITY_THROTTLE_MS) return;
      lastTouch = now;
      touchSession(now);
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      onActivity();
    };

    expireIfNeeded();
    const poll = window.setInterval(expireIfNeeded, POLL_MS);
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
