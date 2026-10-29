import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from "../config";
import type { Difficulty, GameMode } from "../core/types";

export interface GameStartConfig {
  mode: GameMode;
  difficulty: Difficulty;
}

export class MenuScene extends Phaser.Scene {
  private mode: GameMode = "two-player";
  private difficulty: Difficulty = "medium";
  private modeButtons: Phaser.GameObjects.Container[] = [];
  private diffButtons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super("Menu");
  }

  create(): void {
    this.drawBackground();

    this.add
      .text(GAME_WIDTH / 2, 110, "MATH TUG-OF-WAR", {
        fontFamily: FONTS.ui,
        fontSize: "72px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setShadow(0, 6, "#000000", 12, false, true);

    this.add
      .text(GAME_WIDTH / 2, 176, "Answer fast. Pull the rope. Win the war.", {
        fontFamily: FONTS.ui,
        fontSize: "26px",
        color: "#ffd166",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 262, "MODE", {
        fontFamily: FONTS.ui,
        fontSize: "22px",
        color: "#9fb0d6",
      })
      .setOrigin(0.5);

    this.modeButtons = [
      this.makeChoice(GAME_WIDTH / 2 - 190, 320, "2 Players", () => this.setMode("two-player")),
      this.makeChoice(GAME_WIDTH / 2 + 190, 320, "vs Computer", () => this.setMode("single-player")),
    ];

    this.add
      .text(GAME_WIDTH / 2, 406, "DIFFICULTY", {
        fontFamily: FONTS.ui,
        fontSize: "22px",
        color: "#9fb0d6",
      })
      .setOrigin(0.5);

    this.diffButtons = [
      this.makeChoice(GAME_WIDTH / 2 - 230, 464, "Easy", () => this.setDifficulty("easy")),
      this.makeChoice(GAME_WIDTH / 2, 464, "Medium", () => this.setDifficulty("medium")),
      this.makeChoice(GAME_WIDTH / 2 + 230, 464, "Hard", () => this.setDifficulty("hard")),
    ];

    const start = this.makeChoice(GAME_WIDTH / 2, 586, "START GAME", () => {
      this.scene.start("Game", { mode: this.mode, difficulty: this.difficulty } as GameStartConfig);
    });
    (start.getAt(0) as Phaser.GameObjects.Rectangle).setFillStyle(COLORS.accent);
    (start.getAt(1) as Phaser.GameObjects.Text).setColor("#1a2140");

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40,
        "2P: Player 1 keys  Q W E R   |   Player 2 keys  U I O P      •      1P: click or press keys", {
        fontFamily: FONTS.ui,
        fontSize: "18px",
        color: "#7f8db0",
      })
      .setOrigin(0.5);

    this.refreshSelection();
  }

  private setMode(m: GameMode): void {
    this.mode = m;
    this.refreshSelection();
  }

  private setDifficulty(d: Difficulty): void {
    this.difficulty = d;
    this.refreshSelection();
  }

  private refreshSelection(): void {
    const modeIdx = this.mode === "two-player" ? 0 : 1;
    this.modeButtons.forEach((b, i) => this.highlight(b, i === modeIdx));
    const diffIdx = { easy: 0, medium: 1, hard: 2 }[this.difficulty];
    this.diffButtons.forEach((b, i) => this.highlight(b, i === diffIdx));
  }

  private highlight(container: Phaser.GameObjects.Container, selected: boolean): void {
    const rect = container.getAt(0) as Phaser.GameObjects.Rectangle;
    rect.setStrokeStyle(selected ? 4 : 0, COLORS.accent, 1);
    rect.setFillStyle(selected ? COLORS.leftDark : 0x27314f);
  }

  private makeChoice(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const rect = this.add.rectangle(0, 0, 200, 64, 0x27314f).setStrokeStyle(0, COLORS.accent);
    const text = this.add
      .text(0, 0, label, { fontFamily: FONTS.ui, fontSize: "24px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [rect, text]).setSize(200, 64);
    c.setInteractive(new Phaser.Geom.Rectangle(-100, -32, 200, 64), Phaser.Geom.Rectangle.Contains);
    c.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.05, duration: 120 }));
    c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    c.on("pointerdown", onClick);
    return c;
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}
