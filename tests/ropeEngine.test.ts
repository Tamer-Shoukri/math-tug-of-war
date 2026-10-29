import { describe, it, expect } from "vitest";
import {
  createRope,
  applyPull,
  checkWinner,
  pullAndCheck,
  DEFAULT_ROPE_CONFIG,
  type RopeConfig,
} from "../src/core/ropeEngine";

describe("ropeEngine", () => {
  it("starts centered", () => {
    expect(createRope().position).toBe(0);
  });

  it("left pull moves toward negative, right pull toward positive", () => {
    const start = createRope();
    expect(applyPull(start, "left").position).toBeCloseTo(-0.2);
    expect(applyPull(start, "right").position).toBeCloseTo(0.2);
  });

  it("is pure (does not mutate input state)", () => {
    const start = createRope();
    applyPull(start, "right");
    expect(start.position).toBe(0);
  });

  it("opposing pulls cancel out", () => {
    let s = createRope();
    s = applyPull(s, "right");
    s = applyPull(s, "left");
    expect(s.position).toBeCloseTo(0);
  });

  it("clamps at the winning boundaries and never exceeds them", () => {
    const cfg: RopeConfig = { pullStep: 0.5, winThreshold: 1 };
    let s = createRope();
    for (let i = 0; i < 20; i++) s = applyPull(s, "right", cfg);
    expect(s.position).toBe(1);

    s = createRope();
    for (let i = 0; i < 20; i++) s = applyPull(s, "left", cfg);
    expect(s.position).toBe(-1);
  });

  it("honors a pull multiplier", () => {
    const s = applyPull(createRope(), "right", DEFAULT_ROPE_CONFIG, 2);
    expect(s.position).toBeCloseTo(0.4);
  });

  describe("checkWinner", () => {
    it("returns null while rope is between boundaries", () => {
      expect(checkWinner({ position: 0 })).toBeNull();
      expect(checkWinner({ position: 0.9 })).toBeNull();
      expect(checkWinner({ position: -0.9 })).toBeNull();
    });

    it("right wins at or beyond +threshold", () => {
      expect(checkWinner({ position: 1 })).toBe("right");
      expect(checkWinner({ position: 1.5 })).toBe("right");
    });

    it("left wins at or beyond -threshold", () => {
      expect(checkWinner({ position: -1 })).toBe("left");
      expect(checkWinner({ position: -1.5 })).toBe("left");
    });
  });

  describe("pullAndCheck", () => {
    it("declares a winner exactly when the boundary is reached", () => {
      const cfg: RopeConfig = { pullStep: 0.34, winThreshold: 1 };
      let s = createRope();
      let winner = null as ReturnType<typeof checkWinner>;
      for (let i = 0; i < 3; i++) {
        const r = pullAndCheck(s, "right", cfg);
        s = r.state;
        winner = r.winner;
      }
      // 3 * 0.34 = 1.02 -> clamped to 1 -> right wins
      expect(winner).toBe("right");
      expect(s.position).toBe(1);
    });

    it("no winner before reaching the boundary", () => {
      const cfg: RopeConfig = { pullStep: 0.34, winThreshold: 1 };
      const r = pullAndCheck(createRope(), "right", cfg);
      expect(r.winner).toBeNull();
    });
  });
});
