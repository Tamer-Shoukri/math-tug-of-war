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

    const accent = data.winnerSide === "left" ? "#4fa3ff" : "#ff6b5c";

    const banner = this.add
      .text(GAME_WIDTH / 2, 220, data.winnerLabel, {
        fontFamily: FONTS.ui,
        fontSize: "84px",
        color: accent,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setShadow(0, 6, "#000000", 16)
      .setScale(0.3);

    this.tweens.add({ targets: banner, scale: 1, duration: 600, ease: "Back.Out" });

    // simple confetti burst
    this.spawnConfetti();

    this.add
      .text(GAME_WIDTH / 2, 330, `Final Score   ${data.score.left}  :  ${data.score.right}`, {
        fontFamily: FONTS.ui,
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.makeButton(GAME_WIDTH / 2 - 150, 450, "REMATCH", COLORS.accent, "#1a2140", () => {
      this.scene.start("Game", { mode: data.mode, difficulty: data.difficulty });
    });
    this.makeButton(GAME_WIDTH / 2 + 150, 450, "MENU", 0x27314f, "#ffffff", () => {
      this.scene.start("Menu");
    });
  }

  private spawnConfetti(): void {
    const colors = [COLORS.left, COLORS.right, COLORS.accent, 0x3ad17a, 0xffffff];
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const r = this.add.rectangle(x, -20, 10, 14, colors[i % colors.length]);
      r.setAngle(Phaser.Math.Between(0, 360));
      this.tweens.add({
        targets: r,
        y: GAME_HEIGHT + 40,
        angle: r.angle + Phaser.Math.Between(180, 540),
        duration: Phaser.Math.Between(1800, 3200),
        delay: Phaser.Math.Between(0, 800),
        ease: "Quad.In",
        onComplete: () => r.destroy(),
      });
    }
  }

  private makeButton(x: number, y: number, label: string, fill: number, textColor: string, onClick: () => void): void {
    const rect = this.add.rectangle(0, 0, 240, 68, fill).setStrokeStyle(3, 0xffffff, 0.25);
    const text = this.add
      .text(0, 0, label, { fontFamily: FONTS.ui, fontSize: "26px", color: textColor, fontStyle: "bold" })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [rect, text]).setSize(240, 68);
    c.setInteractive(new Phaser.Geom.Rectangle(-120, -34, 240, 68), Phaser.Geom.Rectangle.Contains);
    c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.06, duration: 120 }));
    c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    c.on("pointerdown", onClick);
  }
}
