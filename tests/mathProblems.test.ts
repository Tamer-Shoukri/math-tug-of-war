import { describe, it, expect } from "vitest";
import {
  generateProblem,
  validateAnswer,
  computeAnswer,
  generateChoices,
  randInt,
  type Rng,
} from "../src/core/mathProblems";
import { DIFFICULTIES } from "../src/core/difficulty";
import type { Difficulty } from "../src/core/types";

/** Deterministic RNG that cycles through a fixed sequence of values in [0,1). */
function seqRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

describe("randInt", () => {
  it("returns min when rng is 0 and max when rng is just under 1", () => {
    expect(randInt(1, 10, () => 0)).toBe(1);
    expect(randInt(1, 10, () => 0.999999)).toBe(10);
  });

  it("stays within inclusive bounds over many samples", () => {
    for (let i = 0; i < 1000; i++) {
      const v = randInt(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe("computeAnswer", () => {
  it("computes each operation correctly", () => {
    expect(computeAnswer(3, 4, "+")).toBe(7);
    expect(computeAnswer(9, 4, "-")).toBe(5);
    expect(computeAnswer(6, 7, "*")).toBe(42);
  });
});

describe("generateProblem", () => {
  it("answer always equals the true computed result (fuzz over all difficulties)", () => {
    for (const d of DIFFS) {
      for (let i = 0; i < 2000; i++) {
        const p = generateProblem(d);
        expect(p.answer).toBe(computeAnswer(p.a, p.b, p.op));
      }
    }
  });

  it("subtraction never yields a negative answer", () => {
    for (const d of DIFFS) {
      for (let i = 0; i < 3000; i++) {
        const p = generateProblem(d);
        if (p.op === "-") {
          expect(p.answer).toBeGreaterThanOrEqual(0);
          expect(p.a).toBeGreaterThanOrEqual(p.b);
        }
      }
    }
  });

  it("only uses operations allowed by the difficulty", () => {
    for (const d of DIFFS) {
      const allowed = new Set(DIFFICULTIES[d].operations);
      for (let i = 0; i < 1000; i++) {
        expect(allowed.has(generateProblem(d).op)).toBe(true);
      }
    }
  });

  it("easy never produces multiplication", () => {
    for (let i = 0; i < 2000; i++) {
      expect(generateProblem("easy").op).not.toBe("*");
    }
  });

  it("respects operand magnitude caps", () => {
    for (const d of DIFFS) {
      const cfg = DIFFICULTIES[d];
      for (let i = 0; i < 2000; i++) {
        const p = generateProblem(d);
        const cap = p.op === "*" ? cfg.mulMax : cfg.addSubMax;
        expect(p.a).toBeLessThanOrEqual(cap);
        expect(p.b).toBeLessThanOrEqual(cap);
        expect(p.a).toBeGreaterThanOrEqual(0);
        expect(p.b).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("validateAnswer", () => {
  it("accepts the exact correct answer", () => {
    const p = generateProblem("medium");
    expect(validateAnswer(p, p.answer)).toBe(true);
  });

  it("rejects wrong answers", () => {
    const p = { a: 2, b: 3, op: "+" as const, answer: 5 };
    expect(validateAnswer(p, 6)).toBe(false);
    expect(validateAnswer(p, 4)).toBe(false);
  });

  it("rejects NaN and Infinity", () => {
    const p = { a: 2, b: 3, op: "+" as const, answer: 5 };
    expect(validateAnswer(p, NaN)).toBe(false);
    expect(validateAnswer(p, Infinity)).toBe(false);
  });
});

describe("generateChoices", () => {
  it("includes the correct answer and has the requested unique count", () => {
    for (const d of DIFFS) {
      for (let i = 0; i < 1000; i++) {
        const p = generateProblem(d);
        const choices = generateChoices(p, 4);
        expect(choices).toContain(p.answer);
        expect(choices.length).toBe(4);
        expect(new Set(choices).size).toBe(4);
      }
    }
  });

  it("never offers negative options", () => {
    for (let i = 0; i < 1000; i++) {
      const p = generateProblem("hard");
      for (const c of generateChoices(p, 4)) {
        expect(c).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("is deterministic for a fixed rng", () => {
    const p = { a: 5, b: 3, op: "+" as const, answer: 8 };
    const r1 = generateChoices(p, 4, seqRng([0.1, 0.4, 0.7, 0.2, 0.9, 0.5]));
    const r2 = generateChoices(p, 4, seqRng([0.1, 0.4, 0.7, 0.2, 0.9, 0.5]));
    expect(r1).toEqual(r2);
  });
});
