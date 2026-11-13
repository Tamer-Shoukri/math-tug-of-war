/**
 * Match rules layered on top of the rope engine. Pure functions only, so they
 * are unit-tested and shared by human players and the AI alike.
 */

/** Streak at which a correct answer becomes a "power pull". */
export const POWER_STREAK = 3;
/** Streak at which a correct answer becomes a "mega pull". */
export const MEGA_STREAK = 6;

/** How long a side's answer buttons are locked after a wrong answer. */
export const WRONG_LOCKOUT_MS = 750;

/**
 * A wrong answer lets the rope slip toward the opponent by this fraction of a
 * normal pull. Together with the lockout this makes button-mashing a losing
 * strategy: guessing all four costs more ground than it gains.
 */
export const WRONG_SLIP = 0.35;

export type PullTier = "normal" | "power" | "mega";

/** Pull tier for a correct answer, given the streak *including* that answer. */
export function pullTier(streak: number): PullTier {
  if (streak >= MEGA_STREAK) return "mega";
  if (streak >= POWER_STREAK) return "power";
  return "normal";
}

/** Rope pull multiplier for a correct answer at the given streak. */
export function pullMultiplier(streak: number): number {
  switch (pullTier(streak)) {
    case "mega":
      return 2;
    case "power":
      return 1.5;
    default:
      return 1;
  }
}

/** True while a side is still locked out from answering. */
export function isLockedOut(nowMs: number, lockedUntilMs: number): boolean {
  return nowMs < lockedUntilMs;
}

/** Answer accuracy as a whole percentage (0 when nothing was attempted). */
export function accuracyPercent(correct: number, attempts: number): number {
  if (attempts <= 0) return 0;
  return Math.round((correct / attempts) * 100);
}

export interface SpringState {
  x: number;
  v: number;
}

/**
 * Advance a damped spring one step toward `target` (semi-implicit Euler).
 * Drives the rope's visible position so it surges, overshoots slightly and
 * settles instead of snapping. dt is in seconds and clamped for stability.
 */
export function stepSpring(
  s: SpringState,
  target: number,
  dt: number,
  stiffness = 90,
  damping = 13,
): SpringState {
  const h = Math.min(Math.max(dt, 0), 1 / 30);
  const a = stiffness * (target - s.x) - damping * s.v;
  const v = s.v + a * h;
  return { x: s.x + v * h, v };
}
