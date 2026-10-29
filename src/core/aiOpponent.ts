import type { Difficulty, Problem } from "./types";
import { getDifficultyConfig } from "./difficulty";
import { randInt, type Rng } from "./mathProblems";

export interface AiDecision {
  /** Milliseconds the AI "thinks" before answering. */
  thinkMs: number;
  /** Whether the AI will answer correctly this round. */
  correct: boolean;
}

/**
 * Decide how the AI opponent responds to a problem at a given difficulty.
 * Pure given an injected rng. Accuracy and timing come from difficulty config.
 */
export function decideAiMove(
  difficulty: Difficulty,
  rng: Rng = Math.random,
): AiDecision {
  const cfg = getDifficultyConfig(difficulty);
  const [minMs, maxMs] = cfg.aiThinkMs;
  const thinkMs = randInt(minMs, maxMs, rng);
  const correct = rng() < cfg.aiAccuracy;
  return { thinkMs, correct };
}

/**
 * Produce the value the AI submits: the real answer when correct,
 * otherwise a nearby wrong answer.
 */
export function aiAnswerValue(
  problem: Problem,
  decision: AiDecision,
  rng: Rng = Math.random,
): number {
  if (decision.correct) return problem.answer;
  // Off-by-small wrong answer, never equal to the correct one.
  let delta = randInt(1, 3, rng) * (rng() < 0.5 ? -1 : 1);
  if (delta === 0) delta = 1;
  const wrong = problem.answer + delta;
  return wrong < 0 ? problem.answer + Math.abs(delta) : wrong;
}
