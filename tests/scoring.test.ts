import { describe, it, expect } from "vitest";
import { createScore, registerCorrect, registerWrong } from "../src/core/scoring";

describe("scoring", () => {
  it("starts at zero", () => {
    const s = createScore();
    expect(s.left).toBe(0);
    expect(s.right).toBe(0);
    expect(s.streak).toEqual({ left: 0, right: 0 });
  });

  it("awards 10 for a first correct answer", () => {
    const s = registerCorrect(createScore(), "left");
    expect(s.left).toBe(10);
    expect(s.streak.left).toBe(1);
  });

  it("grows a combo bonus with streak, capped", () => {
    let s = createScore();
    // 10, +12, +14, +16, +18, +20, then capped at +20
    const expectedGains = [10, 12, 14, 16, 18, 20, 20];
    let running = 0;
    for (const g of expectedGains) {
      s = registerCorrect(s, "right");
      running += g;
      expect(s.right).toBe(running);
    }
  });

  it("is pure (does not mutate input)", () => {
    const s = createScore();
    registerCorrect(s, "left");
    expect(s.left).toBe(0);
  });

  it("resets streak on a wrong answer but keeps score", () => {
    let s = createScore();
    s = registerCorrect(s, "left");
    s = registerCorrect(s, "left");
    expect(s.streak.left).toBe(2);
    const before = s.left;
    s = registerWrong(s, "left");
    expect(s.streak.left).toBe(0);
    expect(s.left).toBe(before);
  });

  it("tracks sides independently", () => {
    let s = createScore();
    s = registerCorrect(s, "left");
    s = registerCorrect(s, "right");
    expect(s.left).toBe(10);
    expect(s.right).toBe(10);
  });
});
