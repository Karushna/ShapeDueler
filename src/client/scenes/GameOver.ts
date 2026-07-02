import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { navigateTo, context } from '@devvit/web/client';
import { TOTAL_QUESTIONS, QUESTIONS_PER_LEVEL, LEVEL_SHAPE_COUNTS } from '../../shared/api';

const LEVEL_COLORS = [0x3498db, 0xf39c12, 0x9b59b6, 0xe74c3c];

function buildShareText(results: boolean[], score: number, streak: number): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const lines: string[] = [`📐 Shape Dueler — ${today}`];
  LEVEL_SHAPE_COUNTS.forEach((count, lvl) => {
    const start = lvl * QUESTIONS_PER_LEVEL;
    const emojis = results
      .slice(start, start + QUESTIONS_PER_LEVEL)
      .map((g) => (g ? '✅' : '❌'))
      .join('');
    lines.push(`Level ${lvl + 1} (${count} shapes): ${emojis}`);
  });
  lines.push(`Score: ${score}/${TOTAL_QUESTIONS}${streak > 0 ? ` | 🔥 ${streak}-day streak` : ''}`);
  return lines.join('\n');
}

export class GameOver extends Scene {
  constructor() {
    super('GameOver');
  }

  create(data: { score: number; streak: number; results: boolean[] }): void {
    const score = data?.score ?? 0;
    const streak = data?.streak ?? 0;
    const results: boolean[] = data?.results ?? [];

    this.cameras.main.setBackgroundColor(0x0f0f1e);
    const { width, height } = this.scale;
    const cx = width / 2;

    // Title
    this.add
      .text(cx, height * 0.07, 'Shape Dueler', {
        fontFamily: 'Arial Black',
        fontSize: '18px',
        color: '#666688',
      })
      .setOrigin(0.5);

    // Score label
    let scoreLabel: string;
    if (score === TOTAL_QUESTIONS) scoreLabel = 'Perfect Score! 🏆';
    else if (score >= TOTAL_QUESTIONS * 0.75) scoreLabel = 'Well Done!';
    else if (score >= TOTAL_QUESTIONS * 0.5) scoreLabel = 'Good Try!';
    else scoreLabel = 'Better Luck Tomorrow!';

    this.add
      .text(cx, height * 0.17, scoreLabel, {
        fontFamily: 'Arial Black',
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Big score number
    const scoreColor =
      score === TOTAL_QUESTIONS ? '#ffd700' : score >= TOTAL_QUESTIONS / 2 ? '#f39c12' : '#e74c3c';
    this.add
      .text(cx, height * 0.28, `${score}/${TOTAL_QUESTIONS}`, {
        fontFamily: 'Arial Black',
        fontSize: '62px',
        color: scoreColor,
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    // Per-level result rows
    const rowStart = height * 0.41;
    const rowStep = height * 0.07;
    const dotR = Math.min(width * 0.025, 9);
    const dotGap = dotR * 3.2;

    LEVEL_SHAPE_COUNTS.forEach((shapeCount, lvl) => {
      const y = rowStart + lvl * rowStep;
      const hexColor = '#' + (LEVEL_COLORS[lvl] ?? 0xffffff).toString(16).padStart(6, '0');

      this.add
        .text(width * 0.08, y, `Lv${lvl + 1}`, {
          fontFamily: 'Arial Black',
          fontSize: '13px',
          color: hexColor,
        })
        .setOrigin(0, 0.5);

      const dotsWidth = (QUESTIONS_PER_LEVEL - 1) * dotGap;
      const dotCenterX = cx - dotsWidth / 2;
      for (let q = 0; q < QUESTIONS_PER_LEVEL; q++) {
        const idx = lvl * QUESTIONS_PER_LEVEL + q;
        const correct = results[idx];
        const dot = this.add.graphics();
        const x = dotCenterX + q * dotGap;
        const fillColor = correct === undefined ? 0x2a2a44 : correct ? 0x00cc66 : 0xcc2222;
        dot.fillStyle(fillColor, 1);
        dot.fillCircle(x, y, dotR);
        if (correct !== undefined) {
          dot.lineStyle(1.5, correct ? 0x00ff88 : 0xff4444, 0.4);
          dot.strokeCircle(x, y, dotR);
        }
      }

      this.add
        .text(width * 0.88, y, `${shapeCount} ◆`, {
          fontFamily: 'Arial',
          fontSize: '12px',
          color: '#555577',
        })
        .setOrigin(1, 0.5);
    });

    // Streak
    if (streak > 0) {
      this.add
        .text(cx, height * 0.73, `🔥 ${streak}-day streak!`, {
          fontFamily: 'Arial Black',
          fontSize: '20px',
          color: '#f39c12',
        })
        .setOrigin(0.5);
    }

    // Share on Reddit button
    const shareBtn = this.add
      .text(cx, height * 0.82, '⬆  Share on Reddit', {
        fontFamily: 'Arial Black',
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#ff4500',
        padding: { x: 22, y: 13 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => shareBtn.setStyle({ backgroundColor: '#ff6633' }))
      .on('pointerout', () => shareBtn.setStyle({ backgroundColor: '#ff4500' }))
      .on('pointerdown', () => this.shareToReddit(shareBtn, results, score, streak));

    // Back to Menu
    const menuBtn = this.add
      .text(cx, height * 0.92, 'Back to Menu', {
        fontFamily: 'Arial Black',
        fontSize: '17px',
        color: '#888899',
        backgroundColor: '#16162a',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => menuBtn.setStyle({ color: '#ccccdd' }))
      .on('pointerout', () => menuBtn.setStyle({ color: '#888899' }))
      .on('pointerdown', () => this.scene.start('MainMenu'));

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.cameras.resize(gameSize.width, gameSize.height);
    });
  }

  private shareToReddit(
    btn: Phaser.GameObjects.Text,
    results: boolean[],
    score: number,
    streak: number
  ): void {
    const text = buildShareText(results, score, streak);

    // Copy result to clipboard so the user can paste it as a comment
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }

    btn.setText('Opening Reddit...');
    btn.disableInteractive();

    // Navigate to the current post so the user can paste and comment
    this.time.delayedCall(400, () => {
      const shortId = context.postId.replace(/^t3_/, '');
      navigateTo(`https://www.reddit.com/comments/${shortId}/`);
    });
  }
}
