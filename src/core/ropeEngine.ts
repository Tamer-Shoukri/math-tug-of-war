import type { Side } from "./types";

export interface RopeState {
  /**
   * Rope position on a normalized axis.
   *  0   = dead center
   *  -1  = fully pulled to the LEFT player's winning boundary
   *  +1  = fully pulled to the RIGHT player's winning boundary
   */
  position: number;
}

export interface RopeConfig {
  /** How far one correct answer pulls the rope (in normalized units). */
  pullStep: number;
  /** Absolute position at/beyond which a side wins. */
  winThreshold: number;
}

export const DEFAULT_ROPE_CONFIG: RopeConfig = {
  pullStep: 0.2,
  winThreshold: 1,
};

export function createRope(): RopeState {
  return { position: 0 };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Apply a pull from one side. A LEFT pull moves the rope toward -threshold;
 * a RIGHT pull moves it toward +threshold. The rope is clamped to the
 * winning boundaries so it can never exceed them.
 *
 * Pure: returns a new state, does not mutate the input.
 */
export function applyPull(
  state: RopeState,
  side: Side,
  config: RopeConfig = DEFAULT_ROPE_CONFIG,
  multiplier = 1,
): RopeState {
  const dir = side === "right" ? 1 : -1;
  const next = state.position + dir * config.pullStep * multiplier;
  return {
    position: clamp(next, -config.winThreshold, config.winThreshold),
  };
}

/**
 * Returns the winning side if the rope has reached a boundary, else null.
 */
export function checkWinner(
  state: RopeState,
  config: RopeConfig = DEFAULT_ROPE_CONFIG,
): Side | null {
  if (state.position >= config.winThreshold) return "right";
  if (state.position <= -config.winThreshold) return "left";
  return null;
}

/**
 * Convenience: apply a pull and return both the new state and any winner.
 */
export function pullAndCheck(
  state: RopeState,
  side: Side,
  config: RopeConfig = DEFAULT_ROPE_CONFIG,
  multiplier = 1,
): { state: RopeState; winner: Side | null } {
  const next = applyPull(state, side, config, multiplier);
  return { state: next, winner: checkWinner(next, config) };
}
