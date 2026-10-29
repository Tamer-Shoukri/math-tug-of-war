import type { Difficulty, DifficultyConfig } from "./types";

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    operations: ["+", "-"],
    addSubMax: 10,
    mulMax: 5,
    aiThinkMs: [1800, 3200],
    aiAccuracy: 0.7,
  },
  medium: {
    operations: ["+", "-", "*"],
    addSubMax: 20,
    mulMax: 10,
    aiThinkMs: [1200, 2400],
    aiAccuracy: 0.82,
  },
  hard: {
    operations: ["+", "-", "*"],
    addSubMax: 50,
    mulMax: 12,
    aiThinkMs: [700, 1600],
    aiAccuracy: 0.92,
  },
};

export function getDifficultyConfig(d: Difficulty): DifficultyConfig {
  return DIFFICULTIES[d];
}
