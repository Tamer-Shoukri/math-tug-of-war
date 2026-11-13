import Phaser from "phaser";
import { TEX_SCALE, type Team } from "../config";
import { stepSpring, type SpringState } from "../core/tugRules";
import type { Expression } from "./BootScene";

/**
 * An articulated tug-of-war character built from separate body-part textures.
 *
 * Local space: origin at the feet on the ground, art faces +x. The right-side
 * team is mirrored with scaleX = -1, so all pose math is written once.
 *
 * The rig aims its arms at a world-space rope target every frame, which keeps
 * the mittens exactly on the rope however the body leans or steps.
 */

const S = 1 / TEX_SCALE;
const HIP_Y = -58;
const ARM_LEN = 49; // shoulder pivot → mitten center, in texture-logical px
const FRONT_SHOULDER = { x: 18, y: -72 };
const BACK_SHOULDER = { x: -6, y: -74 };
const HEAD_POS = { x: 6, y: -120 };

type Mode = "idle" | "tug" | "win" | "lose";

export class Tugger extends Phaser.GameObjects.Container {
  readonly team: Team;
  readonly facing: 1 | -1;

  private upper: Phaser.GameObjects.Container;
  private torso: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private armFront: Phaser.GameObjects.Image;
  private armBack: Phaser.GameObjects.Image;
  private legFront: Phaser.GameObjects.Image;
  private legBack: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse;
  private stars: Phaser.GameObjects.Image[] = [];

  private mode: Mode = "idle";
  private lean: SpringState = { x: 0, v: 0 };
  private recoil: SpringState = { x: 0, v: 0 };
  private hop = 0;
  private time = Math.random() * 10;
  private stunnedFor = 0;
  private strain = false;
  private stepPhase = 0;
  private moveAmt = 0;
  private lastX: number;
  private ropeTarget: Phaser.Math.Vector2 | null = null;
  private expr: Expression | null = null;

  /** World positions of the two mittens, refreshed every tick. */
  readonly gripFront = new Phaser.Math.Vector2();
  readonly gripBack = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number, team: Team) {
    super(scene, x, y);
    this.team = team;
    this.facing = team === "left" ? 1 : -1;
    this.lastX = x;

    this.shadow = scene.add.ellipse(4, 0, 104, 20, 0x000000, 0.28);
    this.legBack = scene.add.image(-12, HIP_Y - 2, `${team}-leg`).setOrigin(0.5, 10 / 74).setScale(S).setTint(0xb8c0d8);
    this.legFront = scene.add.image(12, HIP_Y - 2, `${team}-leg`).setOrigin(0.5, 10 / 74).setScale(S);

    this.upper = scene.add.container(0, HIP_Y);
    this.armBack = scene.add.image(BACK_SHOULDER.x, BACK_SHOULDER.y, `${team}-arm-back`).setOrigin(14 / 78, 17 / 34).setScale(S);
    this.torso = scene.add.image(0, 6, `${team}-torso`).setOrigin(0.5, 105 / 110).setScale(S);
    this.head = scene.add.image(HEAD_POS.x, HEAD_POS.y, `${team}-head-effort`).setOrigin(46 / 88, 46 / 88).setScale(S);
    this.armFront = scene.add.image(FRONT_SHOULDER.x, FRONT_SHOULDER.y, `${team}-arm-front`).setOrigin(14 / 78, 17 / 34).setScale(S);
    for (let i = 0; i < 3; i++) {
      this.stars.push(scene.add.image(0, 0, "star").setScale(S * 0.7).setTint(0xffe066).setVisible(false));
    }
    this.upper.add([this.armBack, this.torso, this.head, this.armFront, ...this.stars]);

    this.add([this.shadow, this.legBack, this.legFront, this.upper]);
    this.setScale(this.facing, 1);
    this.setExpression("effort");
    scene.add.existing(this);
  }

  // ---------- Commands ----------

  /** Aim both arms at a world point (the rope knot), or null to relax them. */
  setRopeTarget(x: number | null, y = 0): void {
    if (x === null) this.ropeTarget = null;
    else (this.ropeTarget ??= new Phaser.Math.Vector2()).set(x, y);
  }

  startTugging(): this {
    this.mode = "tug";
    return this;
  }

  /** Whether this side is losing ground — switches to a straining face. */
  setStrain(on: boolean): void {
    this.strain = on;
  }

  /** A successful heave: lurch back hard, then spring upright. */
  pull(tier: "normal" | "power" | "mega"): void {
    const k = tier === "normal" ? 1 : tier === "power" ? 1.5 : 2;
    this.lean.v -= 4.2 * k;
    this.recoil.v -= 160 * k;
    this.flashExpression("effort", 260);
  }

  /** Being yanked forward by the opponent. */
  jolt(): void {
    this.lean.v += 2.6;
    this.recoil.v += 120;
  }

  stun(ms: number): void {
    this.stunnedFor = ms / 1000;
    this.lean.v += 2;
  }

  celebrate(): void {
    this.mode = "win";
    this.ropeTarget = null;
    this.stunnedFor = 0;
  }

  defeat(): void {
    this.mode = "lose";
    this.ropeTarget = null;
    this.stunnedFor = 0;
    this.scene.tweens.add({
      targets: this,
      angle: 62 * this.facing,
      y: this.y + 6,
      duration: 520,
      ease: "Quad.In",
    });
  }

  // ---------- Per-frame ----------

  tick(dt: number): void {
    this.time += dt;
    const t = this.time;

    // Stepping: legs cycle while the body is being dragged/backing up.
    const dx = this.x - this.lastX;
    this.lastX = this.x;
    const speed = Math.abs(dx) / Math.max(dt, 1e-3);
    this.moveAmt += (Phaser.Math.Clamp(speed / 140, 0, 1) - this.moveAmt) * Math.min(1, dt * 10);
    this.stepPhase += Math.abs(dx) * 0.09;

    // Lean spring.
    let leanTarget = 0;
    if (this.mode === "tug") leanTarget = this.strain ? -0.36 : -0.24;
    if (this.mode === "win") leanTarget = 0.04;
    this.lean = stepSpring(this.lean, leanTarget, dt, 70, 9);
    this.recoil = stepSpring(this.recoil, 0, dt, 80, 11);

    let wobble = 0;
    if (this.stunnedFor > 0) {
      this.stunnedFor -= dt;
      wobble = Math.sin(t * 22) * 0.07;
    }
    this.upper.rotation = this.mode === "lose" ? 0.15 : Phaser.Math.Clamp(this.lean.x + wobble, -0.75, 0.4);
    this.upper.x = this.recoil.x * 0.1;

    // Breathing / hop.
    const breathe = 1 + Math.sin(t * 3.2) * 0.022;
    this.torso.setScale(S, S * breathe);
    this.head.y = HEAD_POS.y + Math.sin(t * 3.2 + 0.6) * 1.4;
    this.hop = this.mode === "win" ? Math.abs(Math.sin(t * 6.5)) * 24 : 0;
    this.upper.y = HIP_Y - this.hop;
    this.legFront.y = this.legBack.y = HIP_Y - 2 - this.hop;
    this.shadow.setScale(1 - this.hop / 70, 1);

    // Legs.
    if (this.mode === "tug") {
      const swing = Math.sin(this.stepPhase) * 0.32 * this.moveAmt;
      this.legFront.rotation = -0.34 + swing;
      this.legBack.rotation = 0.2 - swing;
    } else if (this.mode === "win") {
      this.legFront.rotation = -0.12 + Math.sin(t * 13) * 0.08;
      this.legBack.rotation = 0.12 - Math.sin(t * 13) * 0.08;
    } else {
      this.legFront.rotation = -0.06;
      this.legBack.rotation = 0.06;
    }

    this.updateArms(t);
    this.updateStars(t);
    this.updateExpression();
  }

  private updateArms(t: number): void {
    if (this.mode === "win") {
      // V-shaped cheer: front arm up-forward, back arm up-back, pumping.
      this.armFront.rotation = -0.55 + Math.sin(t * 11) * 0.18;
      this.armBack.rotation = -2.3 + Math.sin(t * 11 + 1.4) * 0.22;
    } else if (this.mode === "lose") {
      this.armFront.rotation = 0.15;
      this.armBack.rotation = 0.3;
    } else if (this.ropeTarget) {
      const m = this.upper.getWorldTransformMatrix();
      const local = m.applyInverse(this.ropeTarget.x, this.ropeTarget.y);
      this.armFront.rotation = this.aim(local, FRONT_SHOULDER);
      this.armBack.rotation = this.aim(local, BACK_SHOULDER);
    } else {
      // relaxed, slight sway
      this.armFront.rotation = 1.15 + Math.sin(t * 2.4) * 0.05;
      this.armBack.rotation = 1.3 + Math.sin(t * 2.4 + 1) * 0.05;
    }
    this.computeGrip(this.armFront, FRONT_SHOULDER, this.gripFront);
    this.computeGrip(this.armBack, BACK_SHOULDER, this.gripBack);
  }

  private aim(local: Phaser.Math.Vector2, shoulder: { x: number; y: number }): number {
    const a = Math.atan2(local.y - shoulder.y, local.x - shoulder.x);
    return Phaser.Math.Clamp(a, -1.3, 1.25);
  }

  private computeGrip(arm: Phaser.GameObjects.Image, shoulder: { x: number; y: number }, out: Phaser.Math.Vector2): void {
    const lx = shoulder.x + Math.cos(arm.rotation) * ARM_LEN;
    const ly = shoulder.y + Math.sin(arm.rotation) * ARM_LEN;
    const p = this.upper.getWorldTransformMatrix().transformPoint(lx, ly);
    out.set(p.x, p.y);
  }

  private updateStars(t: number): void {
    const show = this.stunnedFor > 0;
    this.stars.forEach((s, i) => {
      s.setVisible(show);
      if (!show) return;
      const a = t * 7 + (i * Math.PI * 2) / 3;
      s.setPosition(HEAD_POS.x + Math.cos(a) * 26, HEAD_POS.y - 36 + Math.sin(a) * 7);
      s.rotation = t * 5;
    });
  }

  // ---------- Faces ----------

  private flashUntil = 0;
  private flashExpr: Expression | null = null;

  private flashExpression(e: Expression, ms: number): void {
    this.flashExpr = e;
    this.flashUntil = this.time + ms / 1000;
  }

  private updateExpression(): void {
    let e: Expression;
    if (this.mode === "win") e = "happy";
    else if (this.mode === "lose") e = "sad";
    else if (this.stunnedFor > 0) e = "dizzy";
    else if (this.flashExpr && this.time < this.flashUntil) e = this.flashExpr;
    else if (this.mode === "tug" && this.strain) e = "strain";
    else e = "effort";
    this.setExpression(e);
  }

  setExpression(e: Expression): void {
    if (e === this.expr) return;
    this.expr = e;
    this.head.setTexture(`${this.team}-head-${e}`);
  }
}
