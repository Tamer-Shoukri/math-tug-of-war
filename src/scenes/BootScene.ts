import Phaser from "phaser";
import { COLORS } from "../config";

/**
 * BootScene procedurally generates all textures used by the MVP so the game
 * runs with no external asset files. These are intentionally simple
 * placeholders for the playable MVP; they are replaced with polished art in a
 * later visual-quality milestone.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.makeCharacterTexture("char-left", COLORS.left, COLORS.leftDark);
    this.makeCharacterTexture("char-right", COLORS.right, COLORS.rightDark);
    this.makeKnotTexture();
    this.makeButtonTexture("btn", 360, 72, COLORS.leftDark);
    this.scene.start("Menu");
  }

  /** A simple rounded-body character placeholder (NOT final art). */
  private makeCharacterTexture(key: string, body: number, dark: number): void {
    const w = 120;
    const h = 180;
    const g = this.add.graphics();
    // legs
    g.fillStyle(dark, 1);
    g.fillRoundedRect(28, 120, 24, 56, 8);
    g.fillRoundedRect(68, 120, 24, 56, 8);
    // torso
    g.fillStyle(body, 1);
    g.fillRoundedRect(24, 48, 72, 84, 18);
    // head
    g.fillStyle(body, 1);
    g.fillCircle(60, 34, 28);
    // face highlight
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(52, 28, 10);
    // arms (toward center)
    g.fillStyle(dark, 1);
    g.fillRoundedRect(2, 60, 28, 20, 10);
    g.fillRoundedRect(90, 60, 28, 20, 10);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makeKnotTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.ropeKnot, 1);
    g.fillCircle(20, 20, 18);
    g.lineStyle(4, COLORS.rope, 1);
    g.strokeCircle(20, 20, 18);
    g.generateTexture("knot", 40, 40);
    g.destroy();
  }

  private makeButtonTexture(key: string, w: number, h: number, color: number): void {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, w, h, 16);
    g.lineStyle(3, 0xffffff, 0.3);
    g.strokeRoundedRect(1, 1, w - 2, h - 2, 16);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
