import Phaser from 'phaser';
import { World } from './world';

// Render at device resolution (capped at 2x) and let CSS scale the canvas back down, so art stays sharp on phones.
const dpr = Math.min(window.devicePixelRatio || 1, 2);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#4fb8cf',
  scale: { mode: Phaser.Scale.NONE, width: innerWidth * dpr, height: innerHeight * dpr, zoom: 1 / dpr },
  input: { activePointers: 3 },
  scene: [World],
});

addEventListener('resize', () => game.scale.resize(innerWidth * dpr, innerHeight * dpr));
