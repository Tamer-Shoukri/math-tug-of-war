export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/**
 * Render scale. The game is laid out in a fixed 1280x720 logical space, but the
 * canvas is allocated at device resolution (capped at 2x) and every camera is
 * zoomed by this factor, so text and vector art stay sharp on retina screens.
 */
export const RES = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

/** Generated textures are drawn at this supersample factor and shown at 1/TEX_SCALE. */
export const TEX_SCALE = 2;

export const COLORS = {
  bgTop: 0x202a52,
  bgBottom: 0x0b0f1f,
  skyGlow: 0x2d3a6e,
  left: 0x4fa3ff, // blue team
  leftDark: 0x2559b0,
  leftLight: 0x8ec5ff,
  right: 0xff6b5c, // red team
  rightDark: 0xbf3527,
  rightLight: 0xffa79b,
  rope: 0xc9a66b,
  ropeDark: 0x9b7c47,
  ropeLight: 0xe6c88c,
  ropeKnot: 0xffd166,
  ground: 0x2a2018,
  groundLight: 0x413123,
  outline: 0x101624,
  panel: 0x1b2444,
  panelEdge: 0x33406e,
  text: 0xffffff,
  textDim: 0x9fb0d6,
  accent: 0xffd166,
  accentDark: 0xd9a92f,
  good: 0x44dd88,
  bad: 0xff5577,
  danger: 0xff5c7a,
};

export const FONTS = {
  // Rounded, friendly system stack with fallbacks that exist on macOS/Win/Linux.
  ui: "'Trebuchet MS', 'Segoe UI', system-ui, -apple-system, sans-serif",
};

export type Team = "left" | "right";

export const TEAM = {
  left: { body: COLORS.left, dark: COLORS.leftDark, light: COLORS.leftLight, hex: "#4fa3ff" },
  right: { body: COLORS.right, dark: COLORS.rightDark, light: COLORS.rightLight, hex: "#ff6b5c" },
} as const;
