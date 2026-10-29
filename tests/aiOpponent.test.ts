import { describe, it, expect } from "vitest";
import { decideAiMove, aiAnswerValue } from "../src/core/aiOpponent";
import { DIFFICULTIES } from "../src/core/difficulty";
import type { Rng } from "../src/core/mathProblems";

function seqRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("decideAiMove", () => {
  it("thinkMs stays within the difficulty range", () => {
    for (const d of ["easy", "medium", "hard"] as const) {
      const [min, max] = DIFFICULTIES[d].aiThinkMs;
      for (let i = 0; i < 500; i++) {
        const m = decideAiMove(d);
        expect(m.thinkMs).toBeGreaterThanOrEqual(min);
        expect(m.thinkMs).toBeLessThanOrEqual(max);
      }
    }
  });

  it("answers correctly when rng is below accuracy, wrong when above", () => {
    // rng used: first call -> thinkMs, second call -> accuracy roll
    const correct = decideAiMove("hard", seqRng([0.5, 0.0]));
    expect(correct.correct).toBe(true);
    const wrong = decideAiMove("hard", seqRng([0.5, 0.99]));
    expect(wrong.correct).toBe(false);
  });

  it("higher difficulty is at least as accurate as lower", () => {
    expect(DIFFICULTIES.hard.aiAccuracy).toBeGreaterThanOrEqual(
      DIFFICULTIES.medium.aiAccuracy,
    );
    expect(DIFFICULTIES.medium.aiAccuracy).toBeGreaterThanOrEqual(
      DIFFICULTIES.easy.aiAccuracy,
    );
  });
});

describe("aiAnswerValue", () => {
  const problem = { a: 6, b: 7, op: "*" as const, answer: 42 };

  it("returns the exact answer when the decision is correct", () => {
    expect(aiAnswerValue(problem, { thinkMs: 1000, correct: true })).toBe(42);
  });

  it("returns a non-negative wrong answer when the decision is incorrect", () => {
    for (let i = 0; i < 500; i++) {
      const v = aiAnswerValue(problem, { thinkMs: 1000, correct: false });
      expect(v).not.toBe(42);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("never returns the correct answer for a small-answer problem when wrong", () => {
    const small = { a: 1, b: 0, op: "+" as const, answer: 1 };
    for (let i = 0; i < 500; i++) {
      const v = aiAnswerValue(small, { thinkMs: 500, correct: false });
      expect(v).not.toBe(1);
    }
  });
});
