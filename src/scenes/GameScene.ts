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
  fill: number;
  fillDark: number;
}

const P1_KEYS = ["Q", "W", "E", "R"];
const P2_KEYS = ["U", "I", "O", "P"];

const ROPE_Y = 288;
const ARENA_TOP = 150;
const ARENA_BOTTOM = 372;

export class GameScene extends Phaser.Scene {
  private mode: GameMode = "two-player";
  private difficulty: Difficulty = "medium";

  private rope!: RopeState;
  private score!: ScoreState;
  private running = false;

  private character!: Record<Side, Phaser.GameObjects.Image>;
  private ropeGraphics!: Phaser.GameObjects.Graphics;
  private tensionGraphics!: Phaser.GameObjects.Graphics;
  private knot!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;
  private centerLine = GAME_WIDTH / 2;
  private panels!: Record<Side, SidePanel>;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
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
    this.tensionGraphics = this.add.graphics().setDepth(3);
    this.ropeGraphics = this.add.graphics().setDepth(4);
    this.knot = this.add.image(this.centerLine, ROPE_Y, "knot").setDepth(6);
    this.marker = this.add.image(this.centerLine, ARENA_BOTTOM + 6, "spark").setDepth(6).setTint(COLORS.accent).setScale(0.6);

    this.particles = this.add.particles(0, 0, "spark", {
      lifespan: 600,
      speed: { min: 80, max: 260 },
      scale: { start: 0.9, end: 0 },
      quantity: 0,
      emitting: false,
      blendMode: "ADD",
    });
    this.particles.setDepth(8);

    this.panels = {
      left: this.createPanel("left"),
      right: this.createPanel("right"),
    };

    this.setupKeyboard();
    this.animateRope(true);
    this.startCountdown();
  }

  // ---------- Setup ----------

  private drawBackground(): void {
    const g = this.add.graphics();
    // sky gradient
    g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // soft center glow behind the arena
    g.fillStyle(COLORS.skyGlow, 0.5);
    g.fillEllipse(this.centerLine, ARENA_TOP + 60, 900, 240);

    // team zones (tinted halves of the arena)
    g.fillStyle(COLORS.left, 0.1);
    g.fillRect(0, ARENA_TOP, GAME_WIDTH / 2, ARENA_BOTTOM - ARENA_TOP);
    g.fillStyle(COLORS.right, 0.1);
    g.fillRect(GAME_WIDTH / 2, ARENA_TOP, GAME_WIDTH / 2, ARENA_BOTTOM - ARENA_TOP);

    // ground
    g.fillStyle(COLORS.groundLight, 1);
    g.fillRect(0, ARENA_BOTTOM - 8, GAME_WIDTH, 10);
    g.fillStyle(COLORS.ground, 1);
    g.fillRect(0, ARENA_BOTTOM, GAME_WIDTH, 60);

    // Each side's own boundary post (the line that player defends).
    this.dangerPost(g, GAME_WIDTH * 0.14, COLORS.left);
    this.dangerPost(g, GAME_WIDTH * 0.86, COLORS.right);

    // center flag line
    g.lineStyle(4, COLORS.accent, 0.8);
    g.lineBetween(this.centerLine, ARENA_TOP - 6, this.centerLine, ARENA_BOTTOM + 8);
    g.fillStyle(COLORS.accent, 1);
    g.fillTriangle(this.centerLine, ARENA_TOP - 6, this.centerLine + 26, ARENA_TOP + 4, this.centerLine, ARENA_TOP + 14);

    // HUD panel strip behind the questions
    g.fillStyle(COLORS.bgBottom, 0.55);
    g.fillRect(0, ARENA_BOTTOM + 60, GAME_WIDTH, GAME_HEIGHT - (ARENA_BOTTOM + 60));

    // vignette
    g.fillStyle(0x000000, 0.0);
    const vg = this.add.graphics().setDepth(30);
    vg.fillStyle(0x000000, 0.28);
    vg.fillRect(0, 0, GAME_WIDTH, 60);
    vg.fillRect(0, GAME_HEIGHT - 60, GAME_WIDTH, 60);
  }

  private dangerPost(g: Phaser.GameObjects.Graphics, x: number, color: number): void {
    g.lineStyle(4, color, 0.55);
    g.lineBetween(x, ARENA_TOP, x, ARENA_BOTTOM);
    for (let y = ARENA_TOP; y < ARENA_BOTTOM; y += 24) {
      g.fillStyle(color, 0.5);
      g.fillRect(x - 5, y, 10, 12);
    }
  }

  private createCharacters(): void {
    const left = this.add.image(0, ROPE_Y + 6, "char-left").setDepth(5).setOrigin(0.5, 0.86);
    const right = this.add.image(0, ROPE_Y + 6, "char-right").setFlipX(true).setDepth(5).setOrigin(0.5, 0.86);
    this.character = { left, right };
  }

  private createPanel(side: Side): SidePanel {
    const isLeft = side === "left";
    const cx = isLeft ? GAME_WIDTH * 0.25 : GAME_WIDTH * 0.75;
    const colorHex = isLeft ? "#4fa3ff" : "#ff6b5c";
    const fill = isLeft ? COLORS.left : COLORS.right;
    const fillDark = isLeft ? COLORS.leftDark : COLORS.rightDark;

    // header band
    const label =
      isLeft ? "PLAYER 1" : this.mode === "single-player" ? "COMPUTER" : "PLAYER 2";
    this.add
      .text(cx, 452, label, {
        fontFamily: FONTS.ui,
        fontSize: "24px",
        color: colorHex,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const scoreText = this.add
      .text(cx, 482, "0", { fontFamily: FONTS.ui, fontSize: "30px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5);

    const streakText = this.add
      .text(cx + 70, 484, "", { fontFamily: FONTS.ui, fontSize: "18px", color: "#ffd166", fontStyle: "bold" })
      .setOrigin(0, 0.5);

    // problem plate
    const plate = this.add.graphics();
    plate.fillStyle(COLORS.panel, 1);
    plate.fillRoundedRect(cx - 210, 516, 420, 64, 16);
    plate.lineStyle(2, fillDark, 1);
    plate.strokeRoundedRect(cx - 210, 516, 420, 64, 16);

    const problemText = this.add
      .text(cx, 548, "", { fontFamily: FONTS.ui, fontSize: "40px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5);

    const panel: SidePanel = {
      problem: generateProblem(this.difficulty),
      problemText,
      buttons: [],
      scoreText,
      streakText,
      fill,
      fillDark,
    };

    const keys = isLeft ? P1_KEYS : P2_KEYS;
    const isAi = this.mode === "single-player" && side === "right";
    for (let i = 0; i < 4; i++) {
      const bx = cx - 201 + i * 134;
      const btn = this.makeAnswerButton(bx, 636, isAi ? "" : keys[i], fillDark);
      if (!isAi) {
        btn.setInteractive(new Phaser.Geom.Rectangle(-58, -32, 116, 64), Phaser.Geom.Rectangle.Contains);
        btn.on("pointerover", () => this.tweens.add({ targets: btn, scale: 1.06, duration: 100 }));
        btn.on("pointerout", () => this.tweens.add({ targets: btn, scale: 1, duration: 100 }));
        btn.on("pointerdown", () => this.onAnswer(side, i));
      } else {
        // dim the AI's buttons slightly so it reads as "not yours"
        (btn.getAt(0) as Phaser.GameObjects.Rectangle).setAlpha(0.8);
      }
      panel.buttons.push(btn);
    }

    return panel;
  }

  private makeAnswerButton(x: number, y: number, keyHint: string, edge: number): Phaser.GameObjects.Container {
    const shadow = this.add.rectangle(0, 4, 116, 64, COLORS.outline, 0.5).setOrigin(0.5);
    const rect = this.add.rectangle(0, 0, 116, 64, COLORS.panel).setStrokeStyle(2, edge);
    const value = this.add
      .text(0, keyHint ? -7 : 0, "", { fontFamily: FONTS.ui, fontSize: "30px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [shadow, rect, value];
    if (keyHint) {
      const hint = this.add
        .text(0, 19, keyHint, { fontFamily: FONTS.ui, fontSize: "13px", color: "#9fb0d6", fontStyle: "bold" })
        .setOrigin(0.5);
      children.push(hint);
    }
    return this.add.container(x, y, children).setSize(116, 64);
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
      .text(this.centerLine, 250, "3", {
        fontFamily: FONTS.ui,
        fontSize: "140px",
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setShadow(0, 8, "#000000", 18);

    const steps = ["3", "2", "1", "GO!"];
    let i = 0;
    const tick = () => {
      label.setText(steps[i]);
      label.setColor(i === 3 ? "#44dd88" : "#ffd166");
      label.setScale(0.3);
      label.setAlpha(1);
      this.tweens.add({ targets: label, scale: 1, duration: 280, ease: "Back.Out" });
      if (i === 3) this.tweens.add({ targets: label, alpha: 0, delay: 260, duration: 320 });
      i++;
      if (i < steps.length) {
        this.time.delayedCall(650, tick);
      } else {
        this.time.delayedCall(560, () => {
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
      const value = btn.getAt(2) as Phaser.GameObjects.Text;
      value.setText(String(choices[i]));
      btn.setData("value", choices[i]);
      (btn.getAt(1) as Phaser.GameObjects.Rectangle).setFillStyle(COLORS.panel);
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
      this.flashButton(btn, COLORS.good);
      this.burst(btn, side);
      this.applyPullFor(side);
    } else {
      this.score = registerWrong(this.score, side);
      this.flashButton(btn, COLORS.bad);
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
    this.cameras.main.shake(90, 0.004);
    if (winner) this.endGame(winner);
  }

  // ---------- AI ----------

  private scheduleAi(): void {
    if (this.mode !== "single-player" || !this.running) return;
    const decision = decideAiMove(this.difficulty);
    this.aiTimer = this.time.delayedCall(decision.thinkMs, () => {
      if (!this.running) return;
      const panel = this.panels.right;
      const idx = panel.buttons.findIndex((b) => (b.getData("value") as number) === panel.problem.answer);
      if (decision.correct) {
        this.score = registerCorrect(this.score, "right");
        if (idx >= 0) {
          this.flashButton(panel.buttons[idx], COLORS.good);
          this.burst(panel.buttons[idx], "right");
        }
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

  private ropeXForPosition(): number {
    const maxOffset = GAME_WIDTH * 0.34;
    return this.centerLine + this.rope.position * maxOffset;
  }

  private animateRope(instant = false): void {
    const knotX = this.ropeXForPosition();
    const dur = instant ? 0 : 230;

    this.tweens.add({ targets: [this.knot, this.marker], x: knotX, duration: dur, ease: "Back.Out" });
    const leftX = Phaser.Math.Clamp(knotX - 330, 90, GAME_WIDTH - 90);
    const rightX = Phaser.Math.Clamp(knotX + 330, 90, GAME_WIDTH - 90);
    this.tweens.add({ targets: this.character.left, x: leftX, duration: dur, ease: "Back.Out" });
    this.tweens.add({ targets: this.character.right, x: rightX, duration: dur, ease: "Back.Out" });

    // Redraw the rope each frame of the tween for a smooth, sagging line.
    if (instant) {
      this.drawRope(knotX);
    } else {
      const t = this.time.addEvent({
        delay: 16,
        repeat: Math.ceil(dur / 16),
        callback: () => this.drawRope(this.knot.x),
      });
      void t;
    }
    this.updateTension();
  }

  private drawRope(knotX: number): void {
    const g = this.ropeGraphics;
    g.clear();
    const lx = this.character.left.x + 34;
    const rx = this.character.right.x - 34;
    const sag = 10;
    // left segment with slight sag
    this.ropeSegment(g, lx, ROPE_Y, knotX, ROPE_Y, sag);
    this.ropeSegment(g, knotX, ROPE_Y, rx, ROPE_Y, sag);
  }

  private ropeSegment(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, sag: number): void {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 + sag;
    const steps = 18;
    // outline
    g.lineStyle(14, COLORS.ropeDark, 1);
    this.quad(g, x1, y1, midX, midY, x2, y2, steps);
    // core
    g.lineStyle(9, COLORS.rope, 1);
    this.quad(g, x1, y1, midX, midY, x2, y2, steps);
    // highlight
    g.lineStyle(3, COLORS.ropeLight, 0.8);
    this.quad(g, x1, y1 - 2, midX, midY - 2, x2, y2 - 2, steps);
  }

  private quad(g: Phaser.GameObjects.Graphics, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, steps: number): void {
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
      const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
      g.lineTo(x, y);
    }
    g.strokePath();
  }

  /** Glow near whichever side is losing ground, growing as the rope nears a boundary. */
  private updateTension(): void {
    const g = this.tensionGraphics;
    g.clear();
    const pos = this.rope.position; // -1..1
    const mag = Math.abs(pos);
    if (mag < 0.2) return;
    const losingSide: Side = pos > 0 ? "left" : "right"; // rope moving right -> left is losing
    const color = losingSide === "left" ? COLORS.left : COLORS.right;
    const x = losingSide === "left" ? 0 : GAME_WIDTH;
    g.fillStyle(color, 0.06 + mag * 0.14);
    g.fillRect(losingSide === "left" ? 0 : GAME_WIDTH - 260, ARENA_TOP, 260, ARENA_BOTTOM - ARENA_TOP);
    void x;
  }

  private pullAnimation(side: Side): void {
    const char = this.character[side];
    this.tweens.add({ targets: char, scaleX: 1.1, scaleY: 0.9, angle: side === "left" ? -4 : 4, yoyo: true, duration: 120, ease: "Quad.Out" });
  }

  private nudgeWrong(side: Side): void {
    const char = this.character[side];
    this.tweens.add({ targets: char, angle: side === "left" ? 7 : -7, yoyo: true, duration: 80, repeat: 1 });
  }

  private burst(btn: Phaser.GameObjects.Container, side: Side): void {
    this.particles.setParticleTint(side === "left" ? COLORS.leftLight : COLORS.rightLight);
    this.particles.emitParticleAt(btn.x, btn.y - 10, 14);
  }

  private flashButton(btn: Phaser.GameObjects.Container, color: number): void {
    const rect = btn.getAt(1) as Phaser.GameObjects.Rectangle;
    rect.setFillStyle(color);
    this.tweens.add({ targets: btn, scale: 1.14, yoyo: true, duration: 120, ease: "Quad.Out" });
  }

  private updateScoreText(side: Side): void {
    const panel = this.panels[side];
    panel.scoreText.setText(`${this.score[side]}`);
    this.tweens.add({ targets: panel.scoreText, scale: 1.3, yoyo: true, duration: 120 });
    const streak = this.score.streak[side];
    panel.streakText.setText(streak >= 2 ? `🔥${streak}` : "");
  }

  // ---------- End ----------

  private endGame(winner: Side): void {
    this.running = false;
    this.aiTimer?.remove();
    this.cameras.main.shake(260, 0.01);
    this.cameras.main.flash(220, 255, 255, 255, false);

    // winner celebrates, loser slumps
    this.tweens.add({ targets: this.character[winner], y: this.character[winner].y - 18, yoyo: true, repeat: 3, duration: 180 });
    const loser: Side = winner === "left" ? "right" : "left";
    this.tweens.add({ targets: this.character[loser], angle: loser === "left" ? -24 : 24, alpha: 0.6, duration: 400 });

    const winnerLabel =
      this.mode === "single-player"
        ? winner === "left"
          ? "YOU WIN!"
          : "COMPUTER WINS"
        : winner === "left"
          ? "PLAYER 1 WINS!"
          : "PLAYER 2 WINS!";

    this.time.delayedCall(650, () => {
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
