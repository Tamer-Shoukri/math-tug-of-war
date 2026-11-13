import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, RES } from "./config";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { GameOverScene } from "./scenes/GameOverScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  // Canvas is allocated at device resolution; scenes zoom their camera by RES
  // so layout code keeps working in the 1280x720 logical space.
  width: GAME_WIDTH * RES,
  height: GAME_HEIGHT * RES,
  backgroundColor: COLORS.bgBottom,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
};

const game = new Phaser.Game(config);

// Expose the game instance for automated verification / debugging.
// Harmless in production; lets headless tests drive scene transitions and
// inspect state without relying on fragile canvas-pixel coordinate mapping.
(window as unknown as { game: Phaser.Game }).game = game;
