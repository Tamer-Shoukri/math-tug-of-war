import Phaser from "phaser";
import { COLORS, FONTS, RES } from "./config";
import { sfx } from "./audio";

/** Map the 1280x720 logical layout onto the device-resolution canvas. */
export function setupCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setOrigin(0, 0).setZoom(RES);
}

/** Text style with device-resolution glyphs so labels stay crisp. */
export function font(size: number, color = "#ffffff", bold = true): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONTS.ui,
    fontSize: `${size}px`,
    color,
    fontStyle: bold ? "bold" : "normal",
    resolution: RES,
  };
}

export interface ButtonOpts {
  w: number;
  h?: number;
  fill?: number;
  edge?: number;
  textColor?: string;
  size?: number;
  onClick: () => void;
}

/**
 * Chunky arcade button: drop shadow, press-down animation, hover lift.
 * Children order: [shadow, face, label] — callers restyle via getAt(1|2).
 */
export function makeButton(scene: Phaser.Scene, x: number, y: number, label: string, o: ButtonOpts): Phaser.GameObjects.Container {
  const h = o.h ?? 66;
  const shadow = scene.add.rectangle(0, 6, o.w, h, COLORS.outline, 0.55);
  const face = scene.add.rectangle(0, 0, o.w, h, o.fill ?? COLORS.panel).setStrokeStyle(2, o.edge ?? COLORS.panelEdge);
  const text = scene.add.text(0, 0, label, font(o.size ?? 24, o.textColor ?? "#ffffff")).setOrigin(0.5);
  const c = scene.add.container(x, y, [shadow, face, text]).setSize(o.w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(0, 0, o.w, h), Phaser.Geom.Rectangle.Contains);
  c.input!.cursor = "pointer";
  c.on("pointerover", () => scene.tweens.add({ targets: c, scale: 1.05, duration: 110, ease: "Quad.Out" }));
  c.on("pointerout", () => {
    scene.tweens.add({ targets: c, scale: 1, duration: 110 });
    face.y = 0;
    text.y = 0;
  });
  c.on("pointerdown", () => {
    sfx.unlock();
    sfx.click();
    face.y = 4;
    text.y = 4;
    scene.time.delayedCall(90, () => {
      face.y = 0;
      text.y = 0;
      o.onClick();
    });
  });
  return c;
}

/** Small "M: sound on/off" toggle in a corner, shared by every scene. */
export function addMuteToggle(scene: Phaser.Scene, x: number, y: number): void {
  const label = scene.add
    .text(x, y, "", font(15, "#7f8db0"))
    .setOrigin(1, 0)
    .setDepth(100)
    .setInteractive({ useHandCursor: true });
  const refresh = () => label.setText(sfx.muted ? "🔇  M: sound off" : "🔊  M: sound on");
  refresh();
  const toggle = () => {
    sfx.unlock();
    sfx.toggleMute();
    refresh();
  };
  label.on("pointerdown", toggle);
  scene.input.keyboard?.on("keydown-M", toggle);
  // Any first gesture unlocks audio (browsers block it until then).
  scene.input.once("pointerdown", () => sfx.unlock());
  scene.input.keyboard?.once("keydown", () => sfx.unlock());
}
