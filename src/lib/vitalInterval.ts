export function resolveActiveVitalInterval(options: {
  loggingInterval: number;
  isCustomInterval: boolean;
  customIntervalVal: string;
}): number {
  if (options.isCustomInterval) {
    const parsed = Number(options.customIntervalVal);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 120) {
      return Math.floor(parsed);
    }
    return 5;
  }
  if (Number.isFinite(options.loggingInterval) && options.loggingInterval >= 1) {
    return Math.floor(options.loggingInterval);
  }
  return 5;
}
