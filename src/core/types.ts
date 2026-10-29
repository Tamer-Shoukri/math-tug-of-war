export type Operation = "+" | "-" | "*";

export type Difficulty = "easy" | "medium" | "hard";

export type GameMode = "two-player" | "single-player";

export type Side = "left" | "right";

export interface Problem {
  a: number;
  b: number;
  op: Operation;
  answer: number;
}

export interface DifficultyConfig {
  /** Operations allowed at this difficulty. */
  operations: Operation[];
  /** Max operand magnitude for addition/subtraction. */
  addSubMax: number;
  /** Max operand magnitude for multiplication. */
  mulMax: number;
  /** AI thinking time range in ms (min, max) for single-player opponent. */
  aiThinkMs: [number, number];
  /** Probability [0..1] the AI answers correctly. */
  aiAccuracy: number;
}
