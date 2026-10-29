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

    // mascots flanking the title
    this.add.image(GAME_WIDTH / 2 - 420, 150, "char-left").setScale(0.8).setAngle(-8);
    this.add.image(GAME_WIDTH / 2 + 420, 150, "char-right").setScale(0.8).setFlipX(true).setAngle(8);

    const title = this.add
      .text(GAME_WIDTH / 2, 118, "MATH TUG-OF-WAR", {
        fontFamily: FONTS.ui,
        fontSize: "76px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setShadow(0, 6, "#000000", 14, false, true);
    this.tweens.add({ targets: title, scale: { from: 0.92, to: 1 }, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.add
      .text(GAME_WIDTH / 2, 186, "Answer fast  •  Pull the rope  •  Win the war", {
        fontFamily: FONTS.ui,
        fontSize: "25px",
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.sectionLabel(262, "MODE");
    this.modeButtons = [
      this.makeChoice(GAME_WIDTH / 2 - 150, 320, "2 Players", 200, () => this.setMode("two-player")),
      this.makeChoice(GAME_WIDTH / 2 + 150, 320, "vs Computer", 200, () => this.setMode("single-player")),
    ];

    this.sectionLabel(404, "DIFFICULTY");
    this.diffButtons = [
      this.makeChoice(GAME_WIDTH / 2 - 230, 462, "Easy", 190, () => this.setDifficulty("easy")),
      this.makeChoice(GAME_WIDTH / 2, 462, "Medium", 190, () => this.setDifficulty("medium")),
      this.makeChoice(GAME_WIDTH / 2 + 230, 462, "Hard", 190, () => this.setDifficulty("hard")),
    ];

    const start = this.makeChoice(GAME_WIDTH / 2, 590, "START GAME", 300, () => {
      this.cameras.main.fade(220, 11, 15, 31);
      this.time.delayedCall(220, () =>
        this.scene.start("Game", { mode: this.mode, difficulty: this.difficulty } as GameStartConfig),
      );
    });
    (start.getAt(1) as Phaser.GameObjects.Rectangle).setFillStyle(COLORS.accent);
    (start.getAt(2) as Phaser.GameObjects.Text).setColor("#14203f");
    start.setData("isStart", true);
    this.tweens.add({ targets: start, scale: { from: 1, to: 1.05 }, duration: 800, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 44,
        "2P:  Player 1  Q W E R    |    Player 2  U I O P          1P: click or use Q W E R", {
        fontFamily: FONTS.ui,
        fontSize: "18px",
        color: "#7f8db0",
      })
      .setOrigin(0.5);

    this.refreshSelection();
  }

  private sectionLabel(y: number, text: string): void {
    this.add
      .text(GAME_WIDTH / 2, y, text, { fontFamily: FONTS.ui, fontSize: "20px", color: "#9fb0d6", fontStyle: "bold" })
      .setOrigin(0.5);
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
    const rect = container.getAt(1) as Phaser.GameObjects.Rectangle;
    rect.setStrokeStyle(selected ? 4 : 2, selected ? COLORS.accent : COLORS.panelEdge, 1);
    rect.setFillStyle(selected ? COLORS.leftDark : COLORS.panel);
  }

  private makeChoice(x: number, y: number, label: string, w: number, onClick: () => void): Phaser.GameObjects.Container {
    const h = 66;
    const shadow = this.add.rectangle(0, 5, w, h, COLORS.outline, 0.5);
    const rect = this.add.rectangle(0, 0, w, h, COLORS.panel).setStrokeStyle(2, COLORS.panelEdge);
    const text = this.add
      .text(0, 0, label, { fontFamily: FONTS.ui, fontSize: "24px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [shadow, rect, text]).setSize(w, h);
    c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    c.on("pointerover", () => this.tweens.add({ targets: c, scale: c.getData("isStart") ? 1.1 : 1.06, duration: 120 }));
    c.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    c.on("pointerdown", onClick);
    return c;
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(COLORS.skyGlow, 0.4);
    g.fillEllipse(GAME_WIDTH / 2, 150, 1000, 300);
  }
}
