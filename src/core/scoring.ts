import type { Side } from "./types";

export interface ScoreState {
  left: number;
  right: number;
  /** Current consecutive correct streak per side, used for combo bonuses. */
  streak: { left: number; right: number };
}

export function createScore(): ScoreState {
  return { left: 0, right: 0, streak: { left: 0, right: 0 } };
}

/**
 * Register a correct answer for a side. Each correct answer is worth a base
 * of 10 points plus a small combo bonus that grows with the streak.
 * Returns a new state (pure).
 */
export function registerCorrect(state: ScoreState, side: Side): ScoreState {
  const nextStreak = state.streak[side] + 1;
  const comboBonus = Math.min(nextStreak - 1, 5) * 2; // cap combo at +10
  const gained = 10 + comboBonus;
  return {
    ...state,
    [side]: state[side] + gained,
    streak: { ...state.streak, [side]: nextStreak },
  } as ScoreState;
}

/** Register a wrong/timed-out answer: resets that side's streak. */
export function registerWrong(state: ScoreState, side: Side): ScoreState {
  return {
    ...state,
    streak: { ...state.streak, [side]: 0 },
  };
}
