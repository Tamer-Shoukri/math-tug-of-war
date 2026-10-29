import Phaser from "phaser";
import { COLORS } from "../config";

/**
 * BootScene procedurally generates all textures so the game needs no external
 * asset files. The characters are drawn with body shading, a dark outline, a
 * team-colored headband, a face, and mitten hands — a clean "arcade mascot"
 * look rather than flat blobs. Still 100% procedural (no art pipeline).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.makeCharacter("char-left", COLORS.left, COLORS.leftDark, COLORS.leftLight);
    this.makeCharacter("char-right", COLORS.right, COLORS.rightDark, COLORS.rightLight);
    this.makeKnot();
    this.makeSpark();
    this.makeStar();
    this.scene.start("Menu");
  }

  /** Arcade-mascot character, facing right. Right-side team is flipped in-scene. */
  private makeCharacter(key: string, body: number, dark: number, light: number): void {
    const w = 150;
    const h = 210;
    const g = this.add.graphics();
    const O = COLORS.outline;

    // ---- shadow ellipse under feet ----
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(w / 2, h - 10, 96, 20);

    // ---- legs (planted, braced) ----
    this.limb(g, 46, 150, 26, 54, dark, O, 11);
    this.limb(g, 84, 150, 26, 54, dark, O, 11);
    // feet
    g.fillStyle(O, 1);
    g.fillRoundedRect(40, 196, 40, 14, 6);
    g.fillRoundedRect(78, 196, 40, 14, 6);

    // ---- torso with vertical shading ----
    g.fillStyle(O, 1);
    g.fillRoundedRect(30, 66, 90, 96, 24);
    g.fillStyle(dark, 1);
    g.fillRoundedRect(33, 69, 84, 90, 22);
    g.fillStyle(body, 1);
    g.fillRoundedRect(33, 69, 60, 90, 22); // left-lit portion
    g.fillStyle(light, 0.5);
    g.fillRoundedRect(37, 73, 26, 80, 16); // highlight stripe

    // ---- head ----
    const hx = 75;
    const hy = 44;
    g.fillStyle(O, 1);
    g.fillCircle(hx, hy, 34);
    g.fillStyle(body, 1);
    g.fillCircle(hx, hy, 31);
    g.fillStyle(light, 0.55);
    g.fillCircle(hx - 9, hy - 9, 14); // cheek highlight

    // headband in team color accent
    g.fillStyle(COLORS.accent, 1);
    g.fillRoundedRect(hx - 32, hy - 20, 64, 11, 5);
    g.fillStyle(COLORS.accentDark, 1);
    g.fillRoundedRect(hx + 18, hy - 24, 12, 22, 4); // band knot

    // eyes (facing forward-right, determined)
    g.fillStyle(0xffffff, 1);
    g.fillCircle(hx - 6, hy + 4, 7);
    g.fillCircle(hx + 12, hy + 4, 7);
    g.fillStyle(O, 1);
    g.fillCircle(hx - 4, hy + 5, 3.5);
    g.fillCircle(hx + 14, hy + 5, 3.5);
    // brow (effort)
    g.lineStyle(3, O, 1);
    g.beginPath();
    g.moveTo(hx - 13, hy - 2);
    g.lineTo(hx - 1, hy + 1);
    g.strokePath();
    g.beginPath();
    g.moveTo(hx + 6, hy + 1);
    g.lineTo(hx + 18, hy - 2);
    g.strokePath();
    // open mouth (shouting / effort)
    g.fillStyle(O, 1);
    g.fillRoundedRect(hx - 6, hy + 16, 16, 8, 4);

    // ---- arms reaching toward center (rope side = right of sprite) ----
    this.limb(g, 96, 92, 50, 20, dark, O, 10); // upper arm out to the right
    // mitten hand (grips rope)
    g.fillStyle(O, 1);
    g.fillCircle(146, 100, 15);
    g.fillStyle(light, 1);
    g.fillCircle(146, 100, 12);
    // back arm
    this.limb(g, 18, 96, 22, 18, dark, O, 9);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  private limb(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: number,
    outline: number,
    r: number,
  ): void {
    g.fillStyle(outline, 1);
    g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x, y, w, h, r);
  }

  private makeKnot(): void {
    const g = this.add.graphics();
    const O = COLORS.outline;
    g.fillStyle(O, 1);
    g.fillCircle(26, 26, 24);
    g.fillStyle(COLORS.ropeKnot, 1);
    g.fillCircle(26, 26, 21);
    // braid lines
    g.lineStyle(3, COLORS.accentDark, 1);
    g.beginPath();
    g.arc(26, 26, 14, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
    g.strokePath();
    g.beginPath();
    g.arc(26, 26, 14, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
    g.strokePath();
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(19, 19, 6);
    g.generateTexture("knot", 52, 52);
    g.destroy();
  }

  /** Small bright particle for correct-answer bursts. */
  private makeSpark(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture("spark", 16, 16);
    g.destroy();
  }

  /** 4-point star for confetti / victory sparkle. */
  private makeStar(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    const cx = 12;
    const cy = 12;
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 12 : 5;
      const a = (Math.PI / 4) * i - Math.PI / 2;
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.fillPoints(
      pts.reduce<Phaser.Geom.Point[]>((acc, _v, i, arr) => {
        if (i % 2 === 0) acc.push(new Phaser.Geom.Point(arr[i], arr[i + 1]));
        return acc;
      }, []),
      true,
    );
    g.generateTexture("star", 24, 24);
    g.destroy();
  }
}
