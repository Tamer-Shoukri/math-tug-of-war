import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TEAM } from "../config";
import type { Difficulty, GameMode, Side } from "../core/types";
import { accuracyPercent } from "../core/tugRules";
import { font, makeButton, setupCamera, addMuteToggle } from "../ui";
import { Tugger } from "./Tugger";
import type { SideStats } from "./GameScene";

interface GameOverData {
  winnerLabel: string;
  winnerSide: Side;
  score: { left: number; right: number };
  stats?: Record<Side, SideStats>;
  mode: GameMode;
  difficulty: Difficulty;
}

export class GameOverScene extends Phaser.Scene {
  private champs: Tugger[] = [];

  constructor() {
    super("GameOver");
  }

  create(data: GameOverData): void {
    setupCamera(this);
    const g = this.add.graphics();
    g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const win = data.winnerSide;
    const lose: Side = win === "left" ? "right" : "left";
    g.fillStyle(TEAM[win].body, 0.14);
    g.fillEllipse(GAME_WIDTH / 2, 220, 900, 320);

    // Champion cheers on a podium; the loser sits it out, defeated.
    g.fillStyle(0x161d38, 1);
    g.fillRoundedRect(GAME_WIDTH / 2 - 90, 246, 180, 26, 8);
    g.fillStyle(COLORS.accent, 1);
    g.fillRoundedRect(GAME_WIDTH / 2 - 90, 246, 180, 6, 3);
    const champ = new Tugger(this, GAME_WIDTH / 2, 246, win);
    champ.celebrate();
    const loser = new Tugger(this, win === "left" ? GAME_WIDTH - 120 : 120, 352, lose).setScale(win === "left" ? -0.72 : 0.72, 0.72);
    loser.defeat();
    this.champs = [champ, loser];

    const banner = this.add
      .text(GAME_WIDTH / 2, 316, data.winnerLabel, font(80, TEAM[win].hex))
      .setOrigin(0.5)
      .setShadow(0, 7, "#000000", 18)
      .setScale(0.2);
    this.tweens.add({ targets: banner, scale: 1, duration: 650, ease: "Back.Out" });

    this.spawnConfetti();
    this.drawStats(data);

    const rematch = () => {
      this.cameras.main.fade(200, 11, 15, 31);
      this.time.delayedCall(200, () => this.scene.start("Game", { mode: data.mode, difficulty: data.difficulty }));
    };
    const menu = () => {
      this.cameras.main.fade(200, 11, 15, 31);
      this.time.delayedCall(200, () => this.scene.start("Menu"));
    };
    makeButton(this, GAME_WIDTH / 2 - 160, 628, "REMATCH", { w: 250, h: 70, fill: COLORS.accent, edge: COLORS.accentDark, textColor: "#14203f", size: 26, onClick: rematch });
    makeButton(this, GAME_WIDTH / 2 + 160, 628, "MENU", { w: 250, h: 70, size: 26, onClick: menu });
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18, "SPACE: rematch   ·   ESC: menu", font(15, "#7f8db0", false)).setOrigin(0.5);

    addMuteToggle(this, GAME_WIDTH - 14, 10);
    this.input.keyboard?.once("keydown-SPACE", rematch);
    this.input.keyboard?.once("keydown-ESC", menu);
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    for (const c of this.champs) c.tick(dt);
  }

  private drawStats(data: GameOverData): void {
    const names: Record<Side, string> = {
      left: "PLAYER 1",
      right: data.mode === "single-player" ? "COMPUTER" : "PLAYER 2",
    };
    const s = data.stats;
    const rows: [string, (side: Side) => string][] = [
      ["Score", (side) => String(data.score[side])],
      ["Accuracy", (side) => (s ? `${accuracyPercent(s[side].correct, s[side].attempts)}%` : "—")],
      ["Best streak", (side) => (s ? String(s[side].bestStreak) : "—")],
      ["Correct", (side) => (s ? `${s[side].correct} / ${s[side].attempts}` : "—")],
    ];
    const x0 = GAME_WIDTH / 2;
    const top = 400;
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.85);
    panel.fillRoundedRect(x0 - 300, top - 22, 600, 44 + rows.length * 34, 16);
    panel.lineStyle(1, COLORS.panelEdge, 1);
    panel.strokeRoundedRect(x0 - 300, top - 22, 600, 44 + rows.length * 34, 16);

    this.add.text(x0 - 150, top, names.left, font(18, TEAM.left.hex)).setOrigin(0.5);
    this.add.text(x0 + 150, top, names.right, font(18, TEAM.right.hex)).setOrigin(0.5);
    rows.forEach(([label, val], i) => {
      const y = top + 34 * (i + 1);
      this.add.text(x0, y, label.toUpperCase(), font(13, "#9fb0d6")).setOrigin(0.5);
      const lv = this.add.text(x0 - 150, y, val("left"), font(22)).setOrigin(0.5).setAlpha(0);
      const rv = this.add.text(x0 + 150, y, val("right"), font(22)).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: [lv, rv], alpha: 1, delay: 350 + i * 120, duration: 260 });
    });
  }

  private spawnConfetti(): void {
    const colors = [COLORS.left, COLORS.right, COLORS.accent, COLORS.good, 0xffffff];
    const emitter = this.add.particles(0, 0, "star", {
      x: { min: 0, max: GAME_WIDTH },
      y: -20,
      lifespan: 3400,
      speedY: { min: 140, max: 300 },
      speedX: { min: -80, max: 80 },
      scale: { min: 0.25, max: 0.55 },
      rotate: { min: 0, max: 360 },
      quantity: 4,
      frequency: 45,
      tint: colors,
    });
    this.time.delayedCall(3000, () => emitter.stop());
  }
}
