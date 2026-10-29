import type { Difficulty, Operation, Problem } from "./types";
import { getDifficultyConfig } from "./difficulty";

/** Random number generator returning a float in [0, 1). Defaults to Math.random. */
export type Rng = () => number;

const defaultRng: Rng = Math.random;

/** Inclusive integer in [min, max]. */
export function randInt(min: number, max: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[randInt(0, arr.length - 1, rng)];
}

export function computeAnswer(a: number, b: number, op: Operation): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
  }
}

/**
 * Generate a math problem for the given difficulty.
 * Guarantees:
 *  - subtraction never produces a negative answer (a >= b)
 *  - operands respect the difficulty's magnitude caps
 *  - answer field equals the actual computed result
 */
export function generateProblem(difficulty: Difficulty, rng: Rng = defaultRng): Problem {
  const cfg = getDifficultyConfig(difficulty);
  const op = pick(cfg.operations, rng);

  let a: number;
  let b: number;

  if (op === "*") {
    a = randInt(0, cfg.mulMax, rng);
    b = randInt(0, cfg.mulMax, rng);
  } else if (op === "-") {
    // Ensure non-negative result: pick a >= b.
    a = randInt(0, cfg.addSubMax, rng);
    b = randInt(0, a, rng);
  } else {
    a = randInt(0, cfg.addSubMax, rng);
    b = randInt(0, cfg.addSubMax, rng);
  }

  return { a, b, op, answer: computeAnswer(a, b, op) };
}

/** True when the submitted value equals the problem's answer. */
export function validateAnswer(problem: Problem, submitted: number): boolean {
  return Number.isFinite(submitted) && submitted === problem.answer;
}

/**
 * Build a set of multiple-choice options including the correct answer.
 * Returns `count` unique, non-negative integers in randomized order,
 * with the correct answer guaranteed present.
 */
export function generateChoices(
  problem: Problem,
  count = 4,
  rng: Rng = defaultRng,
): number[] {
  const options = new Set<number>([problem.answer]);
  let guard = 0;

  while (options.size < count && guard < 200) {
    guard++;
    // Distractors are near the correct answer so they are plausible.
    const spread = Math.max(3, Math.ceil(Math.abs(problem.answer) * 0.5) + 2);
    const delta = randInt(-spread, spread, rng);
    const candidate = problem.answer + delta;
    if (candidate < 0) continue;
    options.add(candidate);
  }

  // Fallback padding if distractors collided too often.
  let pad = problem.answer + 1;
  while (options.size < count) {
    if (pad >= 0) options.add(pad);
    pad++;
  }

  const arr = Array.from(options);
  // Fisher-Yates shuffle with injected rng.
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i, rng);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function formatProblem(problem: Problem): string {
  return `${problem.a} ${problem.op} ${problem.b}`;
}
