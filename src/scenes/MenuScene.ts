import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TEX_SCALE } from "../config";
import type { Difficulty, GameMode } from "../core/types";
import { font, makeButton, setupCamera, addMuteToggle } from "../ui";
import { Tugger } from "./Tugger";

export interface GameStartConfig {
  mode: GameMode;
  difficulty: Difficulty;
}

export class MenuScene extends Phaser.Scene {
  private mode: GameMode = "two-player";
  private difficulty: Difficulty = "medium";
  private modeButtons: Phaser.GameObjects.Container[] = [];
  private diffButtons: Phaser.GameObjects.Container[] = [];
  private tuggers: Tugger[] = [];
  private ropeG!: Phaser.GameObjects.Graphics;
  private knot!: Phaser.GameObjects.Image;

  constructor() {
    super("Menu");
  }

  create(): void {
    setupCamera(this);
    this.drawBackground();

    // Mascots play a lazy game of tug behind the title.
    this.tuggers = [new Tugger(this, 168, 246, "left"), new Tugger(this, GAME_WIDTH - 168, 246, "right")];
    this.tuggers.forEach((t) => t.startTugging().setScale(t.facing * 0.95, 0.95));
    this.ropeG = this.add.graphics();
    this.knot = this.add.image(GAME_WIDTH / 2, 150, "knot").setScale(0.8 / TEX_SCALE);

    const title = this.add
      .text(GAME_WIDTH / 2, 112, "MATH TUG-OF-WAR", font(76))
      .setOrigin(0.5)
      .setShadow(0, 6, "#000000", 14, false, true);
    this.tweens.add({ targets: title, scale: { from: 0.95, to: 1 }, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.add.text(GAME_WIDTH / 2, 186, "Answer fast  •  Pull the rope  •  Win the war", font(25, "#ffd166")).setOrigin(0.5);

    this.sectionLabel(262, "MODE");
    this.modeButtons = [
      makeButton(this, GAME_WIDTH / 2 - 150, 320, "2 Players", { w: 200, onClick: () => this.setMode("two-player") }),
      makeButton(this, GAME_WIDTH / 2 + 150, 320, "vs Computer", { w: 200, onClick: () => this.setMode("single-player") }),
    ];

    this.sectionLabel(404, "DIFFICULTY");
    this.diffButtons = [
      makeButton(this, GAME_WIDTH / 2 - 230, 462, "Easy", { w: 190, onClick: () => this.setDifficulty("easy") }),
      makeButton(this, GAME_WIDTH / 2, 462, "Medium", { w: 190, onClick: () => this.setDifficulty("medium") }),
      makeButton(this, GAME_WIDTH / 2 + 230, 462, "Hard", { w: 190, onClick: () => this.setDifficulty("hard") }),
    ];

    const start = makeButton(this, GAME_WIDTH / 2, 590, "START GAME", {
      w: 300,
      fill: COLORS.accent,
      edge: COLORS.accentDark,
      textColor: "#14203f",
      size: 26,
      onClick: () => this.startGame(),
    });
    this.tweens.add({ targets: start.getAt(1), scaleX: 1.04, scaleY: 1.06, duration: 800, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 40,
        "2P: Player 1  Q W E R   |   Player 2  U I O P        1P: click or Q W E R        Wrong answers lock you out — don't mash!",
        font(16, "#7f8db0", false),
      )
      .setOrigin(0.5);

    addMuteToggle(this, GAME_WIDTH - 14, 10);
    this.input.keyboard?.on("keydown-ENTER", () => this.startGame());
    this.input.keyboard?.on("keydown-SPACE", () => this.startGame());
    this.refreshSelection();
  }

  private startGame(): void {
    this.cameras.main.fade(220, 11, 15, 31);
    this.time.delayedCall(220, () => this.scene.start("Game", { mode: this.mode, difficulty: this.difficulty } as GameStartConfig));
  }

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const knotX = GAME_WIDTH / 2 + Math.sin(time / 1300) * 46;
    const knotY = 150;
    this.knot.setPosition(knotX, knotY);
    for (const t of this.tuggers) {
      t.setRopeTarget(knotX, knotY);
      t.setStrain(t.facing === 1 ? knotX > GAME_WIDTH / 2 + 30 : knotX < GAME_WIDTH / 2 - 30);
      t.tick(dt);
    }
    const g = this.ropeG;
    g.clear();
    const [L, R] = this.tuggers;
    for (const [a, b] of [[L.gripFront, { x: knotX, y: knotY }], [{ x: knotX, y: knotY }, R.gripFront]] as const) {
      g.lineStyle(11, COLORS.outline, 0.9);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(7, COLORS.rope, 1);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    g.lineStyle(7, COLORS.rope, 1);
    g.lineBetween(L.gripBack.x, L.gripBack.y, L.gripFront.x, L.gripFront.y);
    g.lineBetween(R.gripBack.x, R.gripBack.y, R.gripFront.x, R.gripFront.y);
  }

  private sectionLabel(y: number, text: string): void {
    this.add.text(GAME_WIDTH / 2, y, text, font(20, "#9fb0d6")).setOrigin(0.5);
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

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(COLORS.skyGlow, 0.4);
    g.fillEllipse(GAME_WIDTH / 2, 150, 1000, 300);
  }
}
