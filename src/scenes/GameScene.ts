import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from "../config";
import type { Difficulty, GameMode, Side, Problem } from "../core/types";
import { generateProblem, generateChoices, validateAnswer, formatProblem } from "../core/mathProblems";
import { createRope, pullAndCheck, DEFAULT_ROPE_CONFIG, type RopeState } from "../core/ropeEngine";
import { createScore, registerCorrect, registerWrong, type ScoreState } from "../core/scoring";
import { decideAiMove } from "../core/aiOpponent";
import type { GameStartConfig } from "./MenuScene";

interface SidePanel {
  problem: Problem;
  problemText: Phaser.GameObjects.Text;
  buttons: Phaser.GameObjects.Container[];
  scoreText: Phaser.GameObjects.Text;
  streakText: Phaser.GameObjects.Text;
  flashColor: number;
}

const P1_KEYS = ["Q", "W", "E", "R"];
const P2_KEYS = ["U", "I", "O", "P"];

export class GameScene extends Phaser.Scene {
  private mode: GameMode = "two-player";
  private difficulty: Difficulty = "medium";

  private rope!: RopeState;
  private score!: ScoreState;
  private running = false;

  private character!: Record<Side, Phaser.GameObjects.Image>;
  private ropeGraphics!: Phaser.GameObjects.Graphics;
  private knot!: Phaser.GameObjects.Image;
  private centerLine!: number;
  private panels!: Record<Side, SidePanel>;
  private aiTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("Game");
  }

  create(data: GameStartConfig): void {
    this.mode = data?.mode ?? "two-player";
    this.difficulty = data?.difficulty ?? "medium";

    this.rope = createRope();
    this.score = createScore();
    this.running = false;
    this.centerLine = GAME_WIDTH / 2;

    this.drawBackground();
    this.createCharacters();
    this.ropeGraphics = this.add.graphics();
    this.knot = this.add.image(this.centerLine, 300, "knot").setDepth(5);

    this.panels = {
      left: this.createPanel("left"),
      right: this.createPanel("right"),
    };

    this.setupKeyboard();
    this.renderRope();
    this.startCountdown();
  }

  // ---------- Setup ----------

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // ground strip
    g.fillStyle(COLORS.ground, 1);
    g.fillRect(0, 360, GAME_WIDTH, 40);
    // center danger line
    g.lineStyle(3, COLORS.accent, 0.5);
    g.lineBetween(this.centerLine ?? GAME_WIDTH / 2, 150, this.centerLine ?? GAME_WIDTH / 2, 400);
    // team zones
    g.fillStyle(COLORS.left, 0.08);
    g.fillRect(0, 150, GAME_WIDTH / 2, 250);
    g.fillStyle(COLORS.right, 0.08);
    g.fillRect(GAME_WIDTH / 2, 150, GAME_WIDTH / 2, 250);
  }

  private createCharacters(): void {
    const left = this.add.image(0, 300, "char-left").setDepth(4);
    const right = this.add.image(0, 300, "char-right").setFlipX(true).setDepth(4);
    this.character = { left, right };
  }

  private createPanel(side: Side): SidePanel {
    const isLeft = side === "left";
    const cx = isLeft ? GAME_WIDTH * 0.25 : GAME_WIDTH * 0.75;
    const color = isLeft ? "#4fa3ff" : "#ff6b5c";

    const title = this.add
      .text(cx, 450, isLeft ? "PLAYER 1" : this.mode === "single-player" ? "COMPUTER" : "PLAYER 2", {
        fontFamily: FONTS.ui,
        fontSize: "22px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const scoreText = this.add
      .text(cx, 480, "Score: 0", { fontFamily: FONTS.ui, fontSize: "20px", color: "#ffffff" })
      .setOrigin(0.5);

    const streakText = this.add
      .text(cx, 506, "", { fontFamily: FONTS.ui, fontSize: "16px", color: "#ffd166" })
      .setOrigin(0.5);

    const problemText = this.add
      .text(cx, 548, "", { fontFamily: FONTS.ui, fontSize: "46px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5);
    void title;

    const panel: SidePanel = {
      problem: generateProblem(this.difficulty),
      problemText,
      buttons: [],
      scoreText,
      streakText,
      flashColor: isLeft ? COLORS.left : COLORS.right,
    };

    // 4 answer buttons in a row
    const keys = isLeft ? P1_KEYS : P2_KEYS;
    const isAi = this.mode === "single-player" && side === "right";
    for (let i = 0; i < 4; i++) {
      const bx = cx - 195 + i * 130;
      const btn = this.makeAnswerButton(bx, 624, isAi ? "" : keys[i]);
      if (!isAi) {
        btn.setInteractive(new Phaser.Geom.Rectangle(-55, -30, 110, 60), Phaser.Geom.Rectangle.Contains);
        btn.on("pointerdown", () => this.onAnswer(side, i));
      }
      panel.buttons.push(btn);
    }

    return panel;
  }

  private makeAnswerButton(x: number, y: number, keyHint: string): Phaser.GameObjects.Container {
    const rect = this.add.rectangle(0, 0, 110, 60, 0x27314f).setStrokeStyle(2, 0x4a5880);
    const value = this.add
      .text(0, keyHint ? -6 : 0, "", { fontFamily: FONTS.ui, fontSize: "28px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [rect, value];
    if (keyHint) {
      const hint = this.add
        .text(0, 18, `[${keyHint}]`, { fontFamily: FONTS.ui, fontSize: "13px", color: "#9fb0d6" })
        .setOrigin(0.5);
      children.push(hint);
    }
    return this.add.container(x, y, children).setSize(110, 60);
  }

  private setupKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    P1_KEYS.forEach((k, i) => kb.on(`keydown-${k}`, () => this.onAnswer("left", i)));
    if (this.mode === "two-player") {
      P2_KEYS.forEach((k, i) => kb.on(`keydown-${k}`, () => this.onAnswer("right", i)));
    }
  }

  // ---------- Round flow ----------

  private startCountdown(): void {
    this.refreshPanel("left");
    this.refreshPanel("right");
    const label = this.add
      .text(this.centerLine, 260, "3", {
        fontFamily: FONTS.ui,
        fontSize: "120px",
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setShadow(0, 6, "#000000", 16);

    const steps = ["3", "2", "1", "GO!"];
    let i = 0;
    const tick = () => {
      label.setText(steps[i]);
      label.setScale(0.4);
      this.tweens.add({ targets: label, scale: 1, duration: 260, ease: "Back.Out" });
      i++;
      if (i < steps.length) {
        this.time.delayedCall(700, tick);
      } else {
        this.time.delayedCall(500, () => {
          label.destroy();
          this.running = true;
          this.scheduleAi();
        });
      }
    };
    tick();
  }

  private refreshPanel(side: Side): void {
    const panel = this.panels[side];
    panel.problem = generateProblem(this.difficulty);
    panel.problemText.setText(formatProblem(panel.problem) + " = ?");
    const choices = generateChoices(panel.problem, 4);
    panel.buttons.forEach((btn, i) => {
      const value = btn.getAt(1) as Phaser.GameObjects.Text;
      value.setText(String(choices[i]));
      btn.setData("value", choices[i]);
      (btn.getAt(0) as Phaser.GameObjects.Rectangle).setFillStyle(0x27314f);
    });
  }

  private onAnswer(side: Side, buttonIndex: number): void {
    if (!this.running) return;
    const panel = this.panels[side];
    const btn = panel.buttons[buttonIndex];
    const value = btn.getData("value") as number;
    const correct = validateAnswer(panel.problem, value);

    if (correct) {
      this.score = registerCorrect(this.score, side);
      this.flashButton(btn, 0x3ad17a);
      this.applyPullFor(side);
    } else {
      this.score = registerWrong(this.score, side);
      this.flashButton(btn, 0xd63a4a);
      this.nudgeWrong(side);
    }
    this.updateScoreText(side);
    if (this.running) this.refreshPanel(side);
  }

  private applyPullFor(side: Side): void {
    const { state, winner } = pullAndCheck(this.rope, side, DEFAULT_ROPE_CONFIG);
    this.rope = state;
    this.animateRope();
    this.pullAnimation(side);
    if (winner) this.endGame(winner);
  }

  // ---------- AI ----------

  private scheduleAi(): void {
    if (this.mode !== "single-player" || !this.running) return;
    const decision = decideAiMove(this.difficulty);
    this.aiTimer = this.time.delayedCall(decision.thinkMs, () => {
      if (!this.running) return;
      const panel = this.panels.right;
      if (decision.correct) {
        this.score = registerCorrect(this.score, "right");
        const idx = panel.buttons.findIndex((b) => (b.getData("value") as number) === panel.problem.answer);
        if (idx >= 0) this.flashButton(panel.buttons[idx], 0x3ad17a);
        this.applyPullFor("right");
      } else {
        this.score = registerWrong(this.score, "right");
        this.nudgeWrong("right");
      }
      this.updateScoreText("right");
      if (this.running) {
        this.refreshPanel("right");
        this.scheduleAi();
      }
    });
  }

  // ---------- Rendering / animation ----------

  private renderRope(): void {
    this.animateRope();
  }

  private ropeXForPosition(): number {
    // position in [-1, 1] -> pixel offset from center
    const maxOffset = GAME_WIDTH * 0.32;
    return this.centerLine + this.rope.position * maxOffset;
  }

  private animateRope(): void {
    const knotX = this.ropeXForPosition();
    this.tweens.add({ targets: this.knot, x: knotX, duration: 220, ease: "Quad.Out" });

    const leftX = knotX - 360;
    const rightX = knotX + 360;
    this.tweens.add({ targets: this.character.left, x: Math.max(70, leftX), duration: 220, ease: "Quad.Out" });
    this.tweens.add({ targets: this.character.right, x: Math.min(GAME_WIDTH - 70, rightX), duration: 220, ease: "Quad.Out" });

    this.time.delayedCall(10, () => this.drawRopeLine(knotX));
    this.drawRopeLine(knotX);
  }

  private drawRopeLine(knotX: number): void {
    const g = this.ropeGraphics;
    g.clear();
    g.lineStyle(10, COLORS.rope, 1);
    g.lineBetween(this.character.left.x + 40, 300, knotX, 300);
    g.lineBetween(knotX, 300, this.character.right.x - 40, 300);
  }

  private pullAnimation(side: Side): void {
    const char = this.character[side];
    this.tweens.add({
      targets: char,
      scaleX: side === "left" ? 1.12 : 1.12,
      scaleY: 0.92,
      yoyo: true,
      duration: 110,
    });
  }

  private nudgeWrong(side: Side): void {
    const char = this.character[side];
    this.tweens.add({ targets: char, angle: side === "left" ? -6 : 6, yoyo: true, duration: 90 });
  }

  private flashButton(btn: Phaser.GameObjects.Container, color: number): void {
    const rect = btn.getAt(0) as Phaser.GameObjects.Rectangle;
    rect.setFillStyle(color);
    this.tweens.add({ targets: btn, scale: 1.12, yoyo: true, duration: 110 });
  }

  private updateScoreText(side: Side): void {
    const panel = this.panels[side];
    panel.scoreText.setText(`Score: ${this.score[side]}`);
    const streak = this.score.streak[side];
    panel.streakText.setText(streak >= 2 ? `🔥 ${streak} streak!` : "");
  }

  // ---------- End ----------

  private endGame(winner: Side): void {
    this.running = false;
    this.aiTimer?.remove();
    const winnerLabel =
      this.mode === "single-player"
        ? winner === "left"
          ? "YOU WIN!"
          : "COMPUTER WINS"
        : winner === "left"
          ? "PLAYER 1 WINS!"
          : "PLAYER 2 WINS!";

    this.time.delayedCall(400, () => {
      this.scene.start("GameOver", {
        winnerLabel,
        winnerSide: winner,
        score: { left: this.score.left, right: this.score.right },
        mode: this.mode,
        difficulty: this.difficulty,
      });
    });
  }
}
