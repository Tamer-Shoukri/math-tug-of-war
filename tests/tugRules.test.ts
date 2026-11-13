import { describe, it, expect } from "vitest";
import {
  pullTier,
  pullMultiplier,
  isLockedOut,
  accuracyPercent,
  stepSpring,
  POWER_STREAK,
  MEGA_STREAK,
  WRONG_SLIP,
} from "../src/core/tugRules";
import { createRope, applyPull, pullAndCheck, DEFAULT_ROPE_CONFIG } from "../src/core/ropeEngine";

describe("pull tiers", () => {
  it("is normal below the power streak", () => {
    expect(pullTier(1)).toBe("normal");
    expect(pullTier(POWER_STREAK - 1)).toBe("normal");
    expect(pullMultiplier(1)).toBe(1);
  });

  it("becomes power at the power streak and mega at the mega streak", () => {
    expect(pullTier(POWER_STREAK)).toBe("power");
    expect(pullMultiplier(POWER_STREAK)).toBe(1.5);
    expect(pullTier(MEGA_STREAK)).toBe("mega");
    expect(pullMultiplier(MEGA_STREAK + 4)).toBe(2);
  });

  it("lets a hot streak win from center in fewer answers than a cold one", () => {
    const answersToWin = (multiplierFor: (n: number) => number) => {
      let rope = createRope();
      for (let n = 1; n < 50; n++) {
        const r = pullAndCheck(rope, "left", DEFAULT_ROPE_CONFIG, multiplierFor(n));
        rope = r.state;
        if (r.winner) return n;
      }
      return Infinity;
    };
    expect(answersToWin(() => 1)).toBe(5);
    expect(answersToWin(pullMultiplier)).toBeLessThan(5);
  });
});

describe("anti-mashing", () => {
  it("locks out until the deadline, then releases", () => {
    expect(isLockedOut(1000, 1750)).toBe(true);
    expect(isLockedOut(1750, 1750)).toBe(false);
    expect(isLockedOut(2000, 1750)).toBe(false);
  });

  it("makes guessing all four answers cost ground on average", () => {
    // Worst-case masher: 3 wrong guesses (each slips toward the opponent)
    // then 1 right. Net movement must be toward the opponent or zero.
    let rope = createRope();
    for (let i = 0; i < 3; i++) rope = applyPull(rope, "right", DEFAULT_ROPE_CONFIG, WRONG_SLIP);
    rope = applyPull(rope, "left", DEFAULT_ROPE_CONFIG, 1);
    expect(rope.position).toBeGreaterThanOrEqual(0);
  });
});

describe("accuracy", () => {
  it("rounds to a whole percent and handles zero attempts", () => {
    expect(accuracyPercent(0, 0)).toBe(0);
    expect(accuracyPercent(2, 3)).toBe(67);
    expect(accuracyPercent(5, 5)).toBe(100);
  });
});

describe("spring", () => {
  it("converges to the target", () => {
    let s = { x: 0, v: 0 };
    for (let i = 0; i < 240; i++) s = stepSpring(s, 1, 1 / 60);
    expect(s.x).toBeCloseTo(1, 2);
    expect(Math.abs(s.v)).toBeLessThan(0.01);
  });

  it("overshoots a little (feels springy) but stays bounded", () => {
    let s = { x: 0, v: 0 };
    let peak = 0;
    for (let i = 0; i < 240; i++) {
      s = stepSpring(s, 1, 1 / 60);
      peak = Math.max(peak, s.x);
    }
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.25);
  });

  it("stays stable when a frame hitches (large dt is clamped)", () => {
    let s = { x: 0, v: 0 };
    for (let i = 0; i < 20; i++) s = stepSpring(s, 1, 0.5);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x)).toBeLessThan(2);
  });
});
