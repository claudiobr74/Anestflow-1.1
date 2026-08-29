function audioContextCtor(): (new () => AudioContext) | null {
  if (typeof window === "undefined") return null;
  const fromWindow = window.AudioContext;
  if (fromWindow) return fromWindow;
  const webkit = (window as unknown as { webkitAudioContext?: new () => AudioContext }).webkitAudioContext;
  return webkit || null;
}

/** Beep curto de atraso de vitais. Sem PHI. Falha silenciosa se o browser bloquear áudio. */
export function playVitalOverdueBeep(): void {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  try {
    const ctx = new Ctor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    const stopAt = ctx.currentTime + 0.2;
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    oscillator.stop(stopAt);
    oscillator.onended = () => {
      void ctx.close();
    };
  } catch {
    // aviso sonoro é best-effort
  }
}
