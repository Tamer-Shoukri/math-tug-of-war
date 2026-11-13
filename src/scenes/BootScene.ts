import Phaser from "phaser";
import { COLORS, TEAM, TEX_SCALE, type Team } from "../config";

/**
 * Generates every texture procedurally — no asset files.
 *
 * Characters are built as separate body parts (torso, head expressions, arms,
 * legs) so the Tugger rig can animate them independently. Each texture is drawn
 * at TEX_SCALE× on a 2D canvas with gradients and shown at 1/TEX_SCALE, which
 * keeps the art crisp without changing its on-screen size.
 */

export type Expression = "effort" | "strain" | "happy" | "dizzy" | "sad";
export const EXPRESSIONS: Expression[] = ["effort", "strain", "happy", "dizzy", "sad"];

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const O = hex(COLORS.outline);

type Ctx = CanvasRenderingContext2D;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    for (const team of ["left", "right"] as Team[]) this.makeCharacterParts(team);
    this.makeKnot();
    this.makeGlow();
    this.makeStar();
    this.makeDust();
    this.makeCrowdFan();
    this.scene.start("Menu");
  }

  /** Create a supersampled canvas texture; `draw` works in 1× logical units. */
  private tex(key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * TEX_SCALE);
    c.height = Math.ceil(h * TEX_SCALE);
    const ctx = c.getContext("2d")!;
    ctx.scale(TEX_SCALE, TEX_SCALE);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    draw(ctx);
    this.textures.addCanvas(key, c);
  }

  // ---------- Character parts ----------

  private makeCharacterParts(team: Team): void {
    const t = TEAM[team];
    const body = hex(t.body);
    const dark = hex(t.dark);
    const light = hex(t.light);

    const outlined = (ctx: Ctx, path: () => void, fill: string | CanvasGradient, lw = 4) => {
      path();
      ctx.lineWidth = lw;
      ctx.strokeStyle = O;
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    };

    // Torso — origin is the bottom-center (hip). 100x110.
    this.tex(`${team}-torso`, 100, 110, (ctx) => {
      const g = ctx.createLinearGradient(5, 0, 95, 0);
      g.addColorStop(0, light);
      g.addColorStop(0.42, body);
      g.addColorStop(1, dark);
      outlined(ctx, () => rr(ctx, 6, 5, 88, 100, 28), g);
      // belt
      ctx.save();
      rr(ctx, 6, 5, 88, 100, 28);
      ctx.clip();
      ctx.fillStyle = dark;
      ctx.fillRect(0, 80, 100, 12);
      ctx.fillStyle = hex(COLORS.accent);
      ctx.fillRect(44, 81, 14, 10);
      // soft chest highlight
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#ffffff";
      rr(ctx, 16, 14, 22, 58, 12);
      ctx.fill();
      ctx.restore();
    });

    // Arms — origin at the shoulder (left-center); mitten baked in at the end.
    for (const variant of ["front", "back"] as const) {
      this.tex(`${team}-arm-${variant}`, 78, 34, (ctx) => {
        const top = variant === "front" ? body : dark;
        const g = ctx.createLinearGradient(0, 6, 0, 28);
        g.addColorStop(0, variant === "front" ? light : body);
        g.addColorStop(0.5, top);
        g.addColorStop(1, dark);
        outlined(ctx, () => rr(ctx, 4, 7, 58, 20, 10), g);
        const m = ctx.createRadialGradient(60, 13, 2, 63, 17, 16);
        m.addColorStop(0, "#ffffff");
        m.addColorStop(0.25, light);
        m.addColorStop(1, variant === "front" ? body : dark);
        outlined(ctx, () => {
          ctx.beginPath();
          ctx.arc(63, 17, 13, 0, Math.PI * 2);
        }, m);
      });
    }

    // Leg — origin at the hip joint (top-center); shoe points forward (+x).
    this.tex(`${team}-leg`, 44, 74, (ctx) => {
      const g = ctx.createLinearGradient(8, 0, 34, 0);
      g.addColorStop(0, body);
      g.addColorStop(1, dark);
      outlined(ctx, () => rr(ctx, 9, 4, 26, 58, 12), g);
      const s = ctx.createLinearGradient(0, 58, 0, 72);
      s.addColorStop(0, "#3a4566");
      s.addColorStop(1, O);
      outlined(ctx, () => rr(ctx, 6, 57, 36, 15, 7), s, 3);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(12, 60, 22, 3);
    });

    for (const expr of EXPRESSIONS) this.makeHead(team, expr, body, dark, light);
  }

  /** Head with a face expression. 88x88, origin center. */
  private makeHead(team: Team, expr: Expression, body: string, dark: string, light: string): void {
    this.tex(`${team}-head-${expr}`, 88, 88, (ctx) => {
      const cx = 46;
      const cy = 46;
      // headband tails flutter behind (to the left, since art faces right)
      ctx.fillStyle = hex(COLORS.accentDark);
      ctx.strokeStyle = O;
      ctx.lineWidth = 2.5;
      for (const [dy, len] of [[-22, 22], [-15, 18]] as const) {
        ctx.beginPath();
        ctx.moveTo(cx - 26, cy + dy);
        ctx.quadraticCurveTo(cx - 26 - len * 0.6, cy + dy - 6, cx - 26 - len, cy + dy + 4);
        ctx.lineTo(cx - 24, cy + dy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      const g = ctx.createRadialGradient(cx - 11, cy - 12, 4, cx, cy, 36);
      g.addColorStop(0, light);
      g.addColorStop(0.5, body);
      g.addColorStop(1, dark);
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = O;
      ctx.stroke();
      ctx.fillStyle = g;
      ctx.fill();
      // gloss
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.ellipse(cx - 11, cy - 13, 9, 5.5, -0.5, 0, Math.PI * 2);
      ctx.fill();

      // headband
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = hex(COLORS.accent);
      ctx.fillRect(cx - 34, cy - 24, 68, 11);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(cx - 34, cy - 24, 68, 3);
      ctx.restore();

      this.drawFace(ctx, expr, cx, cy);
    });
  }

  private drawFace(ctx: Ctx, expr: Expression, cx: number, cy: number): void {
    const ex1 = cx - 4;
    const ex2 = cx + 14;
    const ey = cy + 5;
    ctx.strokeStyle = O;
    ctx.fillStyle = O;
    ctx.lineWidth = 3.2;

    const openEye = (x: number, look = 2) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, ey, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = O;
      ctx.beginPath();
      ctx.arc(x + look, ey + 1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x + look + 1.5, ey - 0.8, 1.3, 0, Math.PI * 2);
      ctx.fill();
    };
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    switch (expr) {
      case "effort": {
        openEye(ex1);
        openEye(ex2);
        line(ex1 - 8, ey - 9, ex1 + 5, ey - 5);
        line(ex2 - 5, ey - 5, ex2 + 8, ey - 9);
        ctx.fillStyle = O;
        ctx.beginPath();
        ctx.roundRect(cx - 2, cy + 17, 18, 9, 4);
        ctx.fill();
        break;
      }
      case "strain": {
        // squeezed > < eyes, gritted teeth, sweat drop
        line(ex1 - 6, ey - 5, ex1 + 4, ey);
        line(ex1 + 4, ey, ex1 - 6, ey + 5);
        line(ex2 + 6, ey - 5, ex2 - 4, ey);
        line(ex2 - 4, ey, ex2 + 6, ey + 5);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(cx - 4, cy + 16, 22, 10, 3);
        ctx.fill();
        ctx.stroke();
        line(cx - 4, cy + 21, cx + 18, cy + 21);
        ctx.fillStyle = "#bfe6ff";
        ctx.beginPath();
        ctx.moveTo(cx + 26, cy - 12);
        ctx.quadraticCurveTo(cx + 32, cy - 2, cx + 26, cy - 1);
        ctx.quadraticCurveTo(cx + 20, cy - 2, cx + 26, cy - 12);
        ctx.fill();
        break;
      }
      case "happy": {
        ctx.lineWidth = 3.6;
        for (const x of [ex1, ex2]) {
          ctx.beginPath();
          ctx.arc(x, ey + 2, 6, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        }
        ctx.fillStyle = O;
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy + 14);
        ctx.quadraticCurveTo(cx + 7, cy + 32, cx + 20, cy + 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ff7a8a";
        ctx.beginPath();
        ctx.ellipse(cx + 8, cy + 22, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // blush
        ctx.fillStyle = "rgba(255,120,140,0.45)";
        ctx.beginPath();
        ctx.ellipse(cx - 14, cy + 14, 6, 3.5, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 27, cy + 13, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "dizzy": {
        for (const x of [ex1, ex2]) {
          line(x - 5, ey - 5, x + 5, ey + 5);
          line(x + 5, ey - 5, x - 5, ey + 5);
        }
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy + 21);
        for (let i = 1; i <= 4; i++) ctx.quadraticCurveTo(cx - 4 + i * 5 - 2.5, cy + (i % 2 ? 16 : 26), cx - 4 + i * 5, cy + 21);
        ctx.stroke();
        break;
      }
      case "sad": {
        openEye(ex1, 0);
        openEye(ex2, 0);
        line(ex1 - 8, ey - 6, ex1 + 4, ey - 10);
        line(ex2 - 4, ey - 10, ex2 + 8, ey - 6);
        ctx.beginPath();
        ctx.arc(cx + 7, cy + 28, 9, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.fillStyle = "#9fd8ff";
        ctx.beginPath();
        ctx.ellipse(ex1 - 3, ey + 13, 2.5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  // ---------- Props & particles ----------

  private makeKnot(): void {
    this.tex("knot", 56, 56, (ctx) => {
      const g = ctx.createRadialGradient(22, 20, 3, 28, 28, 26);
      g.addColorStop(0, "#fff2c2");
      g.addColorStop(0.45, hex(COLORS.ropeKnot));
      g.addColorStop(1, hex(COLORS.accentDark));
      ctx.beginPath();
      ctx.arc(28, 28, 23, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = O;
      ctx.stroke();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(120,80,10,0.6)";
      ctx.lineWidth = 3;
      for (const [a0, a1] of [[200, 340], [20, 160]]) {
        ctx.beginPath();
        ctx.arc(28, 28, 14, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180);
        ctx.stroke();
      }
    });
  }

  /** Soft additive glow dot used for sparks and bursts. */
  private makeGlow(): void {
    this.tex("spark", 32, 32, (ctx) => {
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.35, "rgba(255,255,255,0.8)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 32);
    });
  }

  private makeStar(): void {
    this.tex("star", 26, 26, (ctx) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 12 : 5;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        ctx.lineTo(13 + Math.cos(a) * r, 13 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    });
  }

  private makeDust(): void {
    this.tex("dust", 40, 40, (ctx) => {
      const g = ctx.createRadialGradient(20, 20, 2, 20, 20, 20);
      g.addColorStop(0, "rgba(196,170,130,0.9)");
      g.addColorStop(1, "rgba(196,170,130,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 40, 40);
    });
  }

  /** Crowd silhouette: head + shoulders, tinted per seat in-scene. */
  private makeCrowdFan(): void {
    this.tex("fan", 30, 40, (ctx) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(15, 11, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(2, 20, 26, 22, 11);
      ctx.fill();
    });
  }
}
