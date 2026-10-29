import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from "../config";
import type { Difficulty, GameMode, Side } from "../core/types";

interface GameOverData {
  winnerLabel: string;
  winnerSide: Side;
  score: { left: number; right: number };
  mode: GameMode;
  difficulty: Difficulty;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOver");
  }

  create(data: GameOverData): void {
    const g = this.add.graphics();
    g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const win = data.winnerSide;
    const accentHex = win === "left" ? "#4fa3ff" : "#ff6b5c";
    const accentNum = win === "left" ? COLORS.left : COLORS.right;

    // glow behind the banner
    g.fillStyle(accentNum, 0.14);
    g.fillEllipse(GAME_WIDTH / 2, 230, 900, 320);

    // winning mascot, bouncing above the banner
    const champ = this.add
      .image(GAME_WIDTH / 2, 138, win === "left" ? "char-left" : "char-right")
      .setScale(1.15)
      .setFlipX(win === "right");
    this.tweens.add({ targets: champ, y: 122, yoyo: true, repeat: -1, duration: 620, ease: "Sine.InOut" });

    const banner = this.add
      .text(GAME_WIDTH / 2, 324, data.winnerLabel, {
        fontFamily: FONTS.ui,
        fontSize: "88px",
        color: accentHex,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setShadow(0, 7, "#000000", 18)
      .setScale(0.2);
    this.tweens.add({ targets: banner, scale: 1, duration: 650, ease: "Back.Out" });

    this.spawnConfetti();
    this.cameras.main.flash(260, 255, 255, 255, false);

    this.add
      .text(GAME_WIDTH / 2, 404, "FINAL SCORE", { fontFamily: FONTS.ui, fontSize: "20px", color: "#9fb0d6", fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 448, `${data.score.left}  :  ${data.score.right}`, {
        fontFamily: FONTS.ui,
        fontSize: "46px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.makeButton(GAME_WIDTH / 2 - 160, 560, "REMATCH", COLORS.accent, "#14203f", () => {
      this.cameras.main.fade(200, 11, 15, 31);
      this.time.delayedCall(200, () => this.scene.start("Game", { mode: data.mode, difficulty: data.difficulty }));
    });
    this.makeButton(GAME_WIDTH / 2 + 160, 560, "MENU", COLORS.panel, "#ffffff", () => {
      this.cameras.main.fade(200, 11, 15, 31);
      this.time.delayedCall(200, () => this.scene.start("Menu"));
    });

    // keyboard shortcuts
    this.input.keyboard?.once("keydown-SPACE", () => this.scene.start("Game", { mode: data.mode, difficulty: data.difficulty }));
    this.input.keyboard?.once("keydown-ESC", () => this.scene.start("Menu"));
  }

  private spawnConfetti(): void {
    const colors = [COLORS.left, COLORS.right, COLORS.accent, COLORS.good, 0xffffff];
    const emitter = this.add.particles(0, 0, "star", {
      x: { min: 0, max: GAME_WIDTH },
      y: -20,
      lifespan: 3200,
      speedY: { min: 140, max: 300 },
      speedX: { min: -80, max: 80 },
      scale: { min: 0.5, max: 1.1 },
      rotate: { min: 0, max: 360 },
      quantity: 4,
      frequency: 45,
      tint: colors,
    });
    this.time.delayedCall(3000, () => emitter.stop());
  }

  private makeButton(x: number, y: number, label: string, fill: number, textColor: string, onClick: () => void): void {
    const shadow = this.add.rectangle(0, 5, 250, 70, COLORS.outline, 0.5);
    const rect = this.add.rectangle(0, 0, 250, 70, fill).setStrokeStyle(2, 0xffffff, 0.25);
    const text = this.add
      .text(0, 0, label, { fontFamily: FONTS.ui, fontSize: "26px", color: textColor, fontStyle: "bold" })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [shadow, rect, text]).setSize(250, 70);
    c.setInteractive(new Phaser.Geom.Rectangle(-125, -35, 250, 70), Phaser.Geom.Rectangle.Contains);
    c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.07, duration: 120 }));
    c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    c.on("pointerdown", onClick);
  }
}
