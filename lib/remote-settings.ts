export const DEFAULT_IDLE_MINUTES = 5;
export const MIN_IDLE_MINUTES = 1;
export const MAX_IDLE_MINUTES = 120;

export function validIdleMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) &&
    value >= MIN_IDLE_MINUTES && value <= MAX_IDLE_MINUTES;
}
