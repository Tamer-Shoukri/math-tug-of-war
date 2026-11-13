import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TEAM, TEX_SCALE } from "../config";
import type { Difficulty, GameMode, Side, Problem } from "../core/types";
import { generateProblem, generateChoices, validateAnswer, formatProblem } from "../core/mathProblems";
import { createRope, pullAndCheck, DEFAULT_ROPE_CONFIG, type RopeState } from "../core/ropeEngine";
import { createScore, registerCorrect, registerWrong, type ScoreState } from "../core/scoring";
import { decideAiMove } from "../core/aiOpponent";
import {
  pullMultiplier,
  pullTier,
  isLockedOut,
  stepSpring,
  WRONG_LOCKOUT_MS,
  WRONG_SLIP,
  type SpringState,
  type PullTier,
} from "../core/tugRules";
import { sfx } from "../audio";
import { font, setupCamera, addMuteToggle } from "../ui";
import { Tugger } from "./Tugger";
import type { GameStartConfig } from "./MenuScene";

export interface SideStats {
  correct: number;
  attempts: number;
  bestStreak: number;
}

interface SidePanel {
  problem: Problem;
  problemText: Phaser.GameObjects.Text;
  buttons: Phaser.GameObjects.Container[];
  scoreText: Phaser.GameObjects.Text;
  shownScore: { v: number };
  streakText: Phaser.GameObjects.Text;
  lockShade: Phaser.GameObjects.Rectangle;
  lockBar: Phaser.GameObjects.Rectangle;
  lockLabel: Phaser.GameObjects.Text;
  lockedUntil: number;
  cx: number;
}

const P1_KEYS = ["Q", "W", "E", "R"];
const P2_KEYS = ["U", "I", "O", "P"];

const ARENA_TOP = 150;
const ARENA_BOTTOM = 372;
const GROUND_Y = ARENA_BOTTOM - 8;
const ROPE_Y = 252;
const FEET_TO_KNOT = 255;
const MAX_OFFSET = GAME_WIDTH * 0.34;
const POST_X = { left: GAME_WIDTH * 0.14, right: GAME_WIDTH * 0.86 };
const DANGER_AT = 0.6;

export class GameScene extends Phaser.Scene {
  private mode: GameMode = "two-player";
  private difficulty: Difficulty = "medium";

  private rope!: RopeState;
  private ropeVis: SpringState = { x: 0, v: 0 };
  private wobble = 0;
  private score!: ScoreState;
  private stats!: Record<Side, SideStats>;
  private running = false;
  private ended = false;

  private tuggers!: Record<Side, Tugger>;
  private ropeG!: Phaser.GameObjects.Graphics;
  private tailG!: Phaser.GameObjects.Graphics;
  private knot!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Triangle;
  private dangerG!: Phaser.GameObjects.Graphics;
  private dangerSide: Side | null = null;
  private dangerBeepAt = 0;
  private panels!: Record<Side, SidePanel>;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fans: { img: Phaser.GameObjects.Image; side: Side; baseY: number; phase: number }[] = [];
  private cheer: Record<Side, number> = { left: 0, right: 0 };
  private aiTimer?: Phaser.Time.TimerEvent;
  private aiThinking!: Phaser.GameObjects.Text;

  constructor() {
    super("Game");
  }

  create(data: GameStartConfig): void {
    setupCamera(this);
    this.mode = data?.mode ?? "two-player";
    this.difficulty = data?.difficulty ?? "medium";

    this.rope = createRope();
    this.ropeVis = { x: 0, v: 0 };
    this.wobble = 0;
    this.score = createScore();
    this.stats = {
      left: { correct: 0, attempts: 0, bestStreak: 0 },
      right: { correct: 0, attempts: 0, bestStreak: 0 },
    };
    this.running = false;
    this.ended = false;
    this.dangerSide = null;
    this.fans = [];
    this.cheer = { left: 0, right: 0 };

    this.drawBackground();
    this.createCrowd();
    this.dangerG = this.add.graphics().setDepth(2);

    this.tuggers = {
      left: new Tugger(this, GAME_WIDTH / 2 - FEET_TO_KNOT, GROUND_Y, "left").setDepth(5),
      right: new Tugger(this, GAME_WIDTH / 2 + FEET_TO_KNOT, GROUND_Y, "right").setDepth(5),
    };
    this.tuggers.left.startTugging();
    this.tuggers.right.startTugging();

    this.tailG = this.add.graphics().setDepth(4);
    this.ropeG = this.add.graphics().setDepth(6);
    this.knot = this.add.image(GAME_WIDTH / 2, ROPE_Y, "knot").setScale(1 / TEX_SCALE).setDepth(7);
    this.marker = this.add.triangle(GAME_WIDTH / 2, ARENA_BOTTOM + 14, 0, 10, 8, 0, 16, 10, COLORS.accent).setDepth(7);

    this.sparks = this.add.particles(0, 0, "spark", {
      lifespan: 650,
      speed: { min: 90, max: 300 },
      scale: { start: 0.55, end: 0 },
      gravityY: 380,
      emitting: false,
      blendMode: "ADD",
    }).setDepth(20);
    this.dust = this.add.particles(0, 0, "dust", {
      lifespan: { min: 450, max: 800 },
      speedX: { min: -70, max: 70 },
      speedY: { min: -60, max: -15 },
      scale: { start: 0.5, end: 1.1 },
      alpha: { start: 0.7, end: 0 },
      emitting: false,
    }).setDepth(4);

    this.panels = {
      left: this.createPanel("left"),
      right: this.createPanel("right"),
    };
    this.aiThinking = this.add
      .text(this.panels.right.cx, 452, "", font(18, "#ff9d92"))
      .setOrigin(0, 0.5)
      .setDepth(10);

    this.setupKeyboard();
    addMuteToggle(this, GAME_WIDTH - 14, 10);
    this.startCountdown();
  }

  // ---------- Scene setup ----------

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(COLORS.bgTop, COLORS.bgTop, COLORS.bgBottom, COLORS.bgBottom, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // stadium lights
    for (const x of [GAME_WIDTH * 0.2, GAME_WIDTH * 0.8]) {
      g.fillStyle(0xffffff, 0.04);
      g.fillTriangle(x - 30, 0, x + 30, 0, x + (x < GAME_WIDTH / 2 ? 260 : -260), ARENA_BOTTOM);
    }
    // stands behind the crowd
    g.fillStyle(0x161d38, 1);
    g.fillRoundedRect(-20, 74, GAME_WIDTH + 40, 90, 20);
    g.fillStyle(0x1d2647, 1);
    g.fillRect(0, 118, GAME_WIDTH, 6);

    g.fillStyle(COLORS.skyGlow, 0.45);
    g.fillEllipse(GAME_WIDTH / 2, ARENA_TOP + 90, 980, 230);

    // team halves
    g.fillStyle(COLORS.left, 0.09);
    g.fillRect(0, ARENA_TOP, GAME_WIDTH / 2, ARENA_BOTTOM - ARENA_TOP);
    g.fillStyle(COLORS.right, 0.09);
    g.fillRect(GAME_WIDTH / 2, ARENA_TOP, GAME_WIDTH / 2, ARENA_BOTTOM - ARENA_TOP);

    // ground with speckle texture
    g.fillStyle(COLORS.groundLight, 1);
    g.fillRect(0, ARENA_BOTTOM - 10, GAME_WIDTH, 12);
    g.fillStyle(COLORS.ground, 1);
    g.fillRect(0, ARENA_BOTTOM + 2, GAME_WIDTH, 58);
    const rng = new Phaser.Math.RandomDataGenerator(["dirt"]);
    for (let i = 0; i < 140; i++) {
      g.fillStyle(rng.pick([0x4d3b2a, 0x1f1710, 0x5a4532]), 0.6);
      g.fillCircle(rng.between(0, GAME_WIDTH), rng.between(ARENA_BOTTOM - 8, ARENA_BOTTOM + 56), rng.realInRange(1, 2.6));
    }

    // boundary posts
    for (const side of ["left", "right"] as Side[]) {
      const x = POST_X[side];
      const c = TEAM[side].body;
      g.lineStyle(4, c, 0.55);
      g.lineBetween(x, ARENA_TOP, x, ARENA_BOTTOM);
      for (let y = ARENA_TOP; y < ARENA_BOTTOM; y += 24) {
        g.fillStyle(c, 0.5);
        g.fillRect(x - 5, y, 10, 12);
      }
    }

    // center line + flag
    g.lineStyle(4, COLORS.accent, 0.8);
    g.lineBetween(GAME_WIDTH / 2, ARENA_TOP - 6, GAME_WIDTH / 2, ARENA_BOTTOM + 8);
    g.fillStyle(COLORS.accent, 1);
    g.fillTriangle(GAME_WIDTH / 2, ARENA_TOP - 6, GAME_WIDTH / 2 + 26, ARENA_TOP + 4, GAME_WIDTH / 2, ARENA_TOP + 14);

    // HUD strip
    g.fillStyle(COLORS.bgBottom, 0.6);
    g.fillRect(0, ARENA_BOTTOM + 60, GAME_WIDTH, GAME_HEIGHT - (ARENA_BOTTOM + 60));
    g.lineStyle(1, 0xffffff, 0.06);
    g.lineBetween(GAME_WIDTH / 2, ARENA_BOTTOM + 76, GAME_WIDTH / 2, GAME_HEIGHT - 16);
  }

  /** Two rows of bobbing fans; each half cheers for its team. */
  private createCrowd(): void {
    const rng = new Phaser.Math.RandomDataGenerator(["crowd"]);
    for (const [row, y, scale] of [[0, 112, 0.42], [1, 146, 0.5]] as const) {
      const step = row === 0 ? 30 : 36;
      for (let x = 10 + row * 14; x < GAME_WIDTH; x += step) {
        const side: Side = x < GAME_WIDTH / 2 ? "left" : "right";
        const team = TEAM[side];
        const tint = rng.frac() < 0.7 ? rng.pick([team.body, team.dark, team.light]) : rng.pick([0x6b7699, 0x8a93b3, 0x4a5478]);
        const img = this.add
          .image(x + rng.between(-4, 4), y, "fan")
          .setScale(scale * rng.realInRange(0.9, 1.1))
          .setTint(tint)
          .setAlpha(row === 0 ? 0.55 : 0.8)
          .setOrigin(0.5, 1)
          .setDepth(1);
        this.fans.push({ img, side, baseY: img.y, phase: rng.realInRange(0, Math.PI * 2) });
      }
    }
  }

  private createPanel(side: Side): SidePanel {
    const isLeft = side === "left";
    const cx = isLeft ? GAME_WIDTH * 0.25 : GAME_WIDTH * 0.75;
    const team = TEAM[side];

    const label = isLeft ? "PLAYER 1" : this.mode === "single-player" ? "COMPUTER" : "PLAYER 2";
    this.add.text(cx, 452, label, font(24, team.hex)).setOrigin(0.5);
    const scoreText = this.add.text(cx, 482, "0", font(30)).setOrigin(0.5);
    const streakText = this.add.text(cx + 66, 484, "", font(18, "#ffd166")).setOrigin(0, 0.5);

    const plate = this.add.graphics();
    plate.fillStyle(COLORS.panel, 1);
    plate.fillRoundedRect(cx - 210, 516, 420, 64, 16);
    plate.lineStyle(2, team.dark, 1);
    plate.strokeRoundedRect(cx - 210, 516, 420, 64, 16);
    const problemText = this.add.text(cx, 548, "", font(40)).setOrigin(0.5);

    const panel: SidePanel = {
      problem: generateProblem(this.difficulty),
      problemText,
      buttons: [],
      scoreText,
      shownScore: { v: 0 },
      streakText,
      lockShade: this.add.rectangle(cx, 636, 524, 72, 0x05070f, 0.7).setDepth(9).setVisible(false),
      lockBar: this.add.rectangle(cx - 250, 668, 500, 4, COLORS.bad).setOrigin(0, 0.5).setDepth(10).setVisible(false),
      lockLabel: this.add.text(cx, 632, "WRONG — LOCKED", font(20, "#ff8fa3")).setOrigin(0.5).setDepth(10).setVisible(false),
      lockedUntil: 0,
      cx,
    };

    const keys = isLeft ? P1_KEYS : P2_KEYS;
    const isAi = this.mode === "single-player" && side === "right";
    for (let i = 0; i < 4; i++) {
      const btn = this.makeAnswerButton(cx - 201 + i * 134, 636, isAi ? "" : keys[i], team.dark);
      if (!isAi) {
        btn.setInteractive(new Phaser.Geom.Rectangle(0, 0, 116, 64), Phaser.Geom.Rectangle.Contains);
        btn.input!.cursor = "pointer";
        btn.on("pointerover", () => this.tweens.add({ targets: btn, scale: 1.06, duration: 100 }));
        btn.on("pointerout", () => this.tweens.add({ targets: btn, scale: 1, duration: 100 }));
        btn.on("pointerdown", () => {
          sfx.unlock();
          this.onAnswer(side, i);
        });
      } else {
        (btn.getAt(1) as Phaser.GameObjects.Rectangle).setAlpha(0.75);
      }
      panel.buttons.push(btn);
    }
    return panel;
  }

  private makeAnswerButton(x: number, y: number, keyHint: string, edge: number): Phaser.GameObjects.Container {
    const shadow = this.add.rectangle(0, 5, 116, 64, COLORS.outline, 0.55);
    const rect = this.add.rectangle(0, 0, 116, 64, COLORS.panel).setStrokeStyle(2, edge);
    const value = this.add.text(0, keyHint ? -7 : 0, "", font(30)).setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [shadow, rect, value];
    if (keyHint) children.push(this.add.text(0, 19, keyHint, font(13, "#9fb0d6")).setOrigin(0.5));
    return this.add.container(x, y, children).setSize(116, 64);
  }

  private setupKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    P1_KEYS.forEach((k, i) => kb.on(`keydown-${k}`, () => this.onAnswer("left", i)));
    if (this.mode === "two-player") P2_KEYS.forEach((k, i) => kb.on(`keydown-${k}`, () => this.onAnswer("right", i)));
    kb.on("keydown-ESC", () => {
      if (this.ended) return;
      this.aiTimer?.remove();
      this.scene.start("Menu");
    });
  }

  // ---------- Round flow ----------

  private startCountdown(): void {
    this.refreshPanel("left", true);
    this.refreshPanel("right", true);
    const label = this.add.text(GAME_WIDTH / 2, 236, "3", font(140, "#ffd166")).setOrigin(0.5).setDepth(40).setShadow(0, 8, "#000000", 18);
    const steps = ["3", "2", "1", "PULL!"];
    let i = 0;
    const tick = () => {
      const final = i === steps.length - 1;
      label.setText(steps[i]).setColor(final ? "#44dd88" : "#ffd166").setScale(0.3).setAlpha(1);
      sfx.countdown(final);
      this.tweens.add({ targets: label, scale: final ? 1.1 : 1, duration: 300, ease: "Back.Out" });
      if (final) this.tweens.add({ targets: label, alpha: 0, delay: 300, duration: 320 });
      i++;
      if (i < steps.length) this.time.delayedCall(650, tick);
      else
        this.time.delayedCall(420, () => {
          label.destroy();
          this.running = true;
          this.scheduleAi();
        });
    };
    tick();
  }

  private refreshPanel(side: Side, instant = false): void {
    const panel = this.panels[side];
    panel.problem = generateProblem(this.difficulty);
    panel.problemText.setText(formatProblem(panel.problem) + " = ?");
    if (!instant) {
      panel.problemText.setScale(1, 0.2).setAlpha(0.3);
      this.tweens.add({ targets: panel.problemText, scaleY: 1, alpha: 1, duration: 160, ease: "Back.Out" });
    }
    const choices = generateChoices(panel.problem, 4);
    panel.buttons.forEach((btn, i) => {
      (btn.getAt(2) as Phaser.GameObjects.Text).setText(String(choices[i]));
      btn.setData("value", choices[i]);
    });
  }

  private onAnswer(side: Side, buttonIndex: number): void {
    if (!this.running) return;
    const panel = this.panels[side];
    if (isLockedOut(this.time.now, panel.lockedUntil)) {
      this.tweens.add({ targets: panel.lockLabel, x: panel.cx + 6, yoyo: true, repeat: 2, duration: 40 });
      return;
    }
    const btn = panel.buttons[buttonIndex];
    this.submit(side, validateAnswer(panel.problem, btn.getData("value") as number), btn);
  }

  /** Single path for human and AI answers so both play by identical rules. */
  private submit(side: Side, correct: boolean, btn?: Phaser.GameObjects.Container): void {
    const st = this.stats[side];
    st.attempts++;
    const opp: Side = side === "left" ? "right" : "left";

    if (correct) {
      st.correct++;
      const before = this.score[side];
      this.score = registerCorrect(this.score, side);
      const streak = this.score.streak[side];
      st.bestStreak = Math.max(st.bestStreak, streak);
      const tier = pullTier(streak);
      if (btn) this.flashButton(btn, COLORS.good);
      this.popText(btn ? btn.x : this.panels[side].cx, btn ? btn.y - 44 : 600, `+${this.score[side] - before}`, "#7dffb2", 26);
      if (btn) this.burst(btn.x, btn.y - 8, TEAM[side].light, 16);
      sfx.correct(streak);
      this.heave(side, tier, pullMultiplier(streak));
    } else {
      this.score = registerWrong(this.score, side);
      if (btn) this.flashButton(btn, COLORS.bad, true);
      sfx.wrong();
      this.lockOut(side);
      this.tuggers[side].stun(WRONG_LOCKOUT_MS);
      this.slip(opp);
    }
    this.updateScoreText(side);
    if (this.running) this.refreshPanel(side);
  }

  private heave(side: Side, tier: PullTier, multiplier: number): void {
    const { state, winner } = pullAndCheck(this.rope, side, DEFAULT_ROPE_CONFIG, multiplier);
    this.rope = state;
    const opp: Side = side === "left" ? "right" : "left";
    this.tuggers[side].pull(tier);
    this.tuggers[opp].jolt();
    this.wobble = tier === "normal" ? 1 : 1.6;
    this.cheer[side] = 1;
    sfx.pull(tier);
    this.cameras.main.shake(tier === "normal" ? 90 : 170, tier === "normal" ? 0.003 : 0.007);
    this.dust.emitParticleAt(this.tuggers[side].x - 30 * this.tuggers[side].facing, GROUND_Y - 4, tier === "normal" ? 5 : 10);
    if (tier !== "normal") {
      const t = this.tuggers[side];
      this.popText(t.x, ROPE_Y - 150, tier === "mega" ? "MEGA PULL!!" : "POWER PULL!", tier === "mega" ? "#ff9cf2" : "#ffd166", tier === "mega" ? 40 : 34);
      this.burst(this.knot.x, this.knot.y, COLORS.accent, 22);
    }
    if (winner) this.endGame(winner);
  }

  /** A wrong answer lets the rope slip toward the opponent. */
  private slip(toward: Side): void {
    const { state, winner } = pullAndCheck(this.rope, toward, DEFAULT_ROPE_CONFIG, WRONG_SLIP);
    this.rope = state;
    this.wobble = Math.max(this.wobble, 0.5);
    if (winner) this.endGame(winner);
  }

  private lockOut(side: Side): void {
    const p = this.panels[side];
    p.lockedUntil = this.time.now + WRONG_LOCKOUT_MS;
    for (const o of [p.lockShade, p.lockBar, p.lockLabel]) o.setVisible(true).setAlpha(1);
    p.lockBar.width = 500;
    this.tweens.killTweensOf(p.lockBar);
    this.tweens.add({
      targets: p.lockBar,
      width: 0,
      duration: WRONG_LOCKOUT_MS,
      onComplete: () => {
        for (const o of [p.lockShade, p.lockBar, p.lockLabel]) o.setVisible(false);
      },
    });
  }

  // ---------- AI ----------

  private scheduleAi(delay = 0): void {
    if (this.mode !== "single-player" || !this.running) return;
    const decision = decideAiMove(this.difficulty);
    this.aiThinking.setText("").setPosition(this.panels.right.cx + 66, 452);
    this.aiTimer = this.time.delayedCall(delay + decision.thinkMs, () => {
      if (!this.running) return;
      const panel = this.panels.right;
      const idx = panel.buttons.findIndex((b) => (b.getData("value") as number) === panel.problem.answer);
      const wrongIdx = panel.buttons.findIndex((b) => (b.getData("value") as number) !== panel.problem.answer);
      const btn = panel.buttons[decision.correct ? idx : wrongIdx];
      this.submit("right", decision.correct, btn);
      if (this.running) this.scheduleAi(decision.correct ? 0 : WRONG_LOCKOUT_MS);
    });
  }

  // ---------- Per-frame ----------

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const target = this.rope.position;
    this.ropeVis = stepSpring(this.ropeVis, target, dt);
    this.wobble = Math.max(0, this.wobble - dt * 1.8);

    const knotX = GAME_WIDTH / 2 + this.ropeVis.x * MAX_OFFSET;
    this.knot.x = knotX;
    this.knot.y = ROPE_Y + 2;
    this.knot.rotation += this.ropeVis.v * dt * 3;
    this.marker.x = knotX;

    if (!this.ended) {
      const pos = this.rope.position;
      this.tuggers.left.setStrain(pos > 0.35);
      this.tuggers.right.setStrain(pos < -0.35);
      this.tuggers.left.x = Phaser.Math.Clamp(knotX - FEET_TO_KNOT, 96, GAME_WIDTH - 96);
      this.tuggers.right.x = Phaser.Math.Clamp(knotX + FEET_TO_KNOT, 96, GAME_WIDTH - 96);
      this.tuggers.left.setRopeTarget(knotX, ROPE_Y);
      this.tuggers.right.setRopeTarget(knotX, ROPE_Y);
    }
    this.tuggers.left.tick(dt);
    this.tuggers.right.tick(dt);

    // Feet kick up dust while being dragged.
    for (const side of ["left", "right"] as Side[]) {
      if (Math.abs(this.ropeVis.v) > 0.5 && Math.random() < 0.35) {
        const t = this.tuggers[side];
        this.dust.emitParticleAt(t.x + 18 * t.facing, GROUND_Y - 2, 1);
      }
    }

    this.drawRope(knotX);
    this.updateDanger();
    this.updateCrowd(dt);
  }

  private drawRope(knotX: number): void {
    const g = this.ropeG;
    g.clear();
    this.tailG.clear();
    const L = this.tuggers.left;
    const R = this.tuggers.right;

    if (this.ended) {
      // dropped rope lying in the dirt
      this.ropeStroke(g, this.sample(L.x + 20, GROUND_Y - 6, knotX, GROUND_Y - 10, R.x - 20, GROUND_Y - 6));
      this.knot.y = GROUND_Y - 12;
      return;
    }

    const tension = Phaser.Math.Clamp(Math.abs(this.ropeVis.v) * 0.4 + 0.5, 0, 1);
    const sag = 16 - tension * 10;
    const wob = Math.sin(this.time.now / 45) * 7 * this.wobble;

    // Loose tails run back past each body (drawn behind it) and drop to the dirt.
    for (const t of [L, R]) {
      const f = t.facing;
      this.ropeStroke(this.tailG, this.sample(t.gripBack.x, t.gripBack.y, t.gripBack.x - 78 * f, t.gripBack.y + 4, t.gripBack.x - 118 * f, GROUND_Y - 5, 12));
    }
    const segs: Phaser.Math.Vector2[][] = [
      this.sample(L.gripBack.x, L.gripBack.y, (L.gripBack.x + L.gripFront.x) / 2, (L.gripBack.y + L.gripFront.y) / 2 + 2, L.gripFront.x, L.gripFront.y, 6),
      this.sample(R.gripBack.x, R.gripBack.y, (R.gripBack.x + R.gripFront.x) / 2, (R.gripBack.y + R.gripFront.y) / 2 + 2, R.gripFront.x, R.gripFront.y, 6),
      this.sample(L.gripFront.x, L.gripFront.y, (L.gripFront.x + knotX) / 2, (L.gripFront.y + ROPE_Y) / 2 + sag + wob, knotX, ROPE_Y),
      this.sample(knotX, ROPE_Y, (knotX + R.gripFront.x) / 2, (R.gripFront.y + ROPE_Y) / 2 + sag - wob, R.gripFront.x, R.gripFront.y),
    ];
    for (const s of segs) this.ropeStroke(g, s);
  }

  private sample(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, steps = 18): Phaser.Math.Vector2[] {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      pts.push(new Phaser.Math.Vector2(u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2));
    }
    return pts;
  }

  /** Braided rope: dark casing, tan core, highlight, then diagonal twist marks. */
  private ropeStroke(g: Phaser.GameObjects.Graphics, pts: Phaser.Math.Vector2[]): void {
    const line = (w: number, c: number, a: number, dy = 0) => {
      g.lineStyle(w, c, a);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y + dy);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y + dy);
      g.strokePath();
    };
    line(13, COLORS.outline, 0.9);
    line(9, COLORS.rope, 1);
    line(3, COLORS.ropeLight, 0.75, -2);
    g.lineStyle(2, COLORS.ropeDark, 0.9);
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const nx = (b.x - a.x) / (len || 1);
      const ny = (b.y - a.y) / (len || 1);
      for (let d = 9 - acc; d < len; d += 9) {
        const px = a.x + nx * d;
        const py = a.y + ny * d;
        // twist mark: short slash across the rope
        g.lineBetween(px - nx * 2 - ny * 3.5, py - ny * 2 + nx * 3.5, px + nx * 2 + ny * 3.5, py + ny * 2 - nx * 3.5);
      }
      acc = (acc + len) % 9;
    }
  }

  private updateDanger(): void {
    const pos = this.rope.position;
    const side: Side | null = pos <= -DANGER_AT ? "right" : pos >= DANGER_AT ? "left" : null; // side about to lose
    const g = this.dangerG;
    g.clear();
    if (side && !this.ended) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 110);
      const x = POST_X[side === "left" ? "right" : "left"]; // the post the rope is approaching
      g.fillStyle(COLORS.danger, 0.08 + pulse * 0.14);
      g.fillRect(x - 30, ARENA_TOP, 60, ARENA_BOTTOM - ARENA_TOP);
      g.lineStyle(4, COLORS.danger, 0.4 + pulse * 0.5);
      g.lineBetween(x, ARENA_TOP, x, ARENA_BOTTOM);
      if (this.time.now > this.dangerBeepAt) {
        sfx.danger();
        this.dangerBeepAt = this.time.now + 700;
      }
    }
    if (side !== this.dangerSide && side && !this.ended) {
      const losingName = side === "left" ? "PLAYER 1" : this.mode === "single-player" ? "COMPUTER" : "PLAYER 2";
      this.popText(GAME_WIDTH / 2, 48, `⚠  ${losingName} IN DANGER!`, "#ff8fa3", 24);
    }
    this.dangerSide = side;
  }

  private updateCrowd(dt: number): void {
    const t = this.time.now / 1000;
    this.cheer.left = Math.max(0, this.cheer.left - dt * 1.4);
    this.cheer.right = Math.max(0, this.cheer.right - dt * 1.4);
    for (const f of this.fans) {
      const hype = this.cheer[f.side];
      const idle = Math.sin(t * 2 + f.phase) * 1.2;
      const jump = hype > 0 ? Math.abs(Math.sin(t * 14 + f.phase)) * 9 * hype : 0;
      f.img.y = f.baseY + idle - jump;
    }
  }

  // ---------- Feedback ----------

  private burst(x: number, y: number, tint: number, n: number): void {
    this.sparks.setParticleTint(tint);
    this.sparks.emitParticleAt(x, y, n);
  }

  private popText(x: number, y: number, s: string, color: string, size: number): void {
    const t = this.add.text(x, y, s, font(size, color)).setOrigin(0.5).setDepth(30).setShadow(0, 3, "#000000", 6).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: "Back.Out" });
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 380, duration: 520, ease: "Quad.In", onComplete: () => t.destroy() });
  }

  private flashButton(btn: Phaser.GameObjects.Container, color: number, shake = false): void {
    const rect = btn.getAt(1) as Phaser.GameObjects.Rectangle;
    rect.setFillStyle(color);
    this.time.delayedCall(170, () => rect.setFillStyle(COLORS.panel));
    if (shake) {
      const x = btn.x;
      this.tweens.add({ targets: btn, x: x + 7, yoyo: true, repeat: 2, duration: 45, onComplete: () => (btn.x = x) });
    } else {
      this.tweens.add({ targets: btn, scale: 1.14, yoyo: true, duration: 110, ease: "Quad.Out" });
    }
  }

  private updateScoreText(side: Side): void {
    const p = this.panels[side];
    this.tweens.killTweensOf(p.shownScore);
    this.tweens.add({
      targets: p.shownScore,
      v: this.score[side],
      duration: 260,
      onUpdate: () => p.scoreText.setText(`${Math.round(p.shownScore.v)}`),
    });
    this.tweens.add({ targets: p.scoreText, scale: 1.25, yoyo: true, duration: 110 });
    const streak = this.score.streak[side];
    p.streakText.setText(streak >= 2 ? `🔥${streak}` : "");
    if (streak >= 2) {
      p.streakText.setScale(1.5);
      this.tweens.add({ targets: p.streakText, scale: 1, duration: 200, ease: "Back.Out" });
    }
  }

  // ---------- End ----------

  private endGame(winner: Side): void {
    if (this.ended) return;
    this.running = false;
    this.ended = true;
    this.aiTimer?.remove();
    const loser: Side = winner === "left" ? "right" : "left";
    this.tuggers[winner].celebrate();
    this.tuggers[loser].defeat();
    this.cheer[winner] = 3;
    this.time.delayedCall(480, () => {
      sfx.thud();
      this.dust.emitParticleAt(this.tuggers[loser].x + 60 * this.tuggers[loser].facing, GROUND_Y - 4, 18);
      this.cameras.main.shake(220, 0.008);
    });
    sfx.win();
    this.cameras.main.flash(240, 255, 255, 255, false);
    this.burst(this.knot.x, this.knot.y, COLORS.accent, 40);

    const winnerLabel =
      this.mode === "single-player"
        ? winner === "left"
          ? "YOU WIN!"
          : "COMPUTER WINS"
        : winner === "left"
          ? "PLAYER 1 WINS!"
          : "PLAYER 2 WINS!";

    this.time.delayedCall(1700, () => {
      this.cameras.main.fade(260, 11, 15, 31);
      this.time.delayedCall(260, () =>
        this.scene.start("GameOver", {
          winnerLabel,
          winnerSide: winner,
          score: { left: this.score.left, right: this.score.right },
          stats: this.stats,
          mode: this.mode,
          difficulty: this.difficulty,
        }),
      );
    });
  }
}
