import { Scene, GameObjects } from 'phaser';
import * as Phaser from 'phaser';

export class GameOver extends Scene {
  constructor() {
    super('GameOver');
  }

  create(data: { score: number; streak: number }): void {
    const score = data?.score ?? 0;
    const streak = data?.streak ?? 0;

    this.cameras.main.setBackgroundColor(0x0f0f1e);
    const { width, height } = this.scale;

    // Title
    this.add
      .text(width / 2, height * 0.1, 'Daily Shape Dueler', {
        fontFamily: 'Arial Black',
        fontSize: '22px',
        color: '#888888',
      })
      .setOrigin(0.5);

    // Score
    const scoreLabel = score === 3 ? 'Perfect!' : score === 0 ? 'Better luck tomorrow!' : 'Good try!';
    this.add
      .text(width / 2, height * 0.24, scoreLabel, {
        fontFamily: 'Arial Black',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.38, `${score}/3`, {
        fontFamily: 'Arial Black',
        fontSize: '88px',
        color: score === 3 ? '#ffd700' : score >= 2 ? '#f39c12' : '#e74c3c',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    // Score dots
    const dotSpacing = 40;
    const dotsStartX = width / 2 - dotSpacing;
    for (let i = 0; i < 3; i++) {
      const filled = i < score;
      const dot = this.add.graphics();
      dot.fillStyle(filled ? 0xffd700 : 0x444444, 1);
      dot.fillCircle(dotsStartX + i * dotSpacing, height * 0.52, 10);
    }

    // Streak
    if (streak > 0) {
      this.add
        .text(width / 2, height * 0.6, `🔥 ${streak}-day streak!`, {
          fontFamily: 'Arial Black',
          fontSize: '24px',
          color: '#f39c12',
        })
        .setOrigin(0.5);
    }

    // Share button
    const today = new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    const shareText = `Daily Shape Dueler — ${today}\nI got ${score}/3! ${streak > 0 ? `🔥 ${streak}-day streak!` : ''}\nPlay on Reddit!`;

    const shareBtn = this.add
      .text(width / 2, height * 0.71, '📋  Copy Results', {
        fontFamily: 'Arial Black',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#16213e',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => shareBtn.setStyle({ backgroundColor: '#1a2a50' }))
      .on('pointerout', () => shareBtn.setStyle({ backgroundColor: '#16213e' }))
      .on('pointerdown', () => {
        if (navigator.clipboard) {
          void navigator.clipboard.writeText(shareText).then(() => {
            shareBtn.setText('✓  Copied!');
            this.time.delayedCall(2000, () => shareBtn.setText('📋  Copy Results'));
          });
        }
      });

    // Back to menu button
    const menuBtn = this.add
      .text(width / 2, height * 0.83, '← Back to Menu', {
        fontFamily: 'Arial Black',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#d93900',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => menuBtn.setStyle({ backgroundColor: '#ff4500' }))
      .on('pointerout', () => menuBtn.setStyle({ backgroundColor: '#d93900' }))
      .on('pointerdown', () => this.scene.start('MainMenu'));

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.cameras.resize(gameSize.width, gameSize.height);
    });
  }
}
