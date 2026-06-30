import { Scene, GameObjects } from 'phaser';
import * as Phaser from 'phaser';
import type { DailyResponse, GuessResponse, Shape, ShapeType } from '../../shared/api';

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function drawShape(
  gfx: Phaser.GameObjects.Graphics,
  type: ShapeType,
  x: number,
  y: number,
  size: number
): void {
  switch (type) {
    case 'circle':
      gfx.fillCircle(x, y, size);
      break;

    case 'triangle': {
      const h = size * Math.sqrt(3);
      gfx.fillTriangle(
        x, y - (h * 2) / 3,
        x - size, y + h / 3,
        x + size, y + h / 3
      );
      break;
    }

    case 'square':
      gfx.fillRect(x - size, y - size, size * 2, size * 2);
      break;

    case 'pentagon':
    case 'hexagon': {
      const sides = type === 'pentagon' ? 5 : 6;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        pts.push({ x: x + Math.cos(angle) * size, y: y + Math.sin(angle) * size });
      }
      gfx.fillPoints(pts, true);
      break;
    }

    case 'star': {
      const outerR = size;
      const innerR = size * 0.4;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        pts.push({ x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r });
      }
      gfx.fillPoints(pts, true);
      break;
    }
  }
}

export class Game extends Scene {
  private shapes: [Shape, Shape] | null = null;
  private questions: DailyResponse['questions'] | null = null;
  private currentQuestion: number = 0;
  private score: number = 0;
  private answering: boolean = false;

  private questionText: GameObjects.Text | null = null;
  private progressText: GameObjects.Text | null = null;
  private leftGfx: Phaser.GameObjects.Graphics | null = null;
  private rightGfx: Phaser.GameObjects.Graphics | null = null;
  private leftLabel: GameObjects.Text | null = null;
  private rightLabel: GameObjects.Text | null = null;
  private leftZone: GameObjects.Zone | null = null;
  private rightZone: GameObjects.Zone | null = null;
  private feedbackBg: GameObjects.Rectangle | null = null;
  private feedbackText: GameObjects.Text | null = null;

  constructor() {
    super('Game');
  }

  init(): void {
    this.shapes = null;
    this.questions = null;
    this.currentQuestion = 0;
    this.score = 0;
    this.answering = false;
    this.questionText = null;
    this.progressText = null;
    this.leftGfx = null;
    this.rightGfx = null;
    this.leftLabel = null;
    this.rightLabel = null;
    this.leftZone = null;
    this.rightZone = null;
    this.feedbackBg = null;
    this.feedbackText = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    void this.loadDaily();
  }

  private async loadDaily(): Promise<void> {
    try {
      const res = await fetch('/api/daily');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DailyResponse;

      if (data.alreadyPlayed) {
        this.showAlreadyPlayed(data.score);
        return;
      }

      this.shapes = data.shapes;
      this.questions = data.questions;
      this.currentQuestion = data.guessesUsed;
      this.score = data.score;
      this.buildUI();
    } catch (e) {
      console.error('Failed to load daily data:', e);
      this.showError();
    }
  }

  private buildUI(): void {
    const { width, height } = this.scale;
    const shapeY = height * 0.52;
    const shapeSize = Math.min(width * 0.18, height * 0.22, 90);

    this.questionText = this.add
      .text(width / 2, height * 0.1, this.questions![this.currentQuestion].label, {
        fontFamily: 'Arial Black',
        fontSize: '26px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
        wordWrap: { width: width * 0.88 },
      })
      .setOrigin(0.5);

    this.progressText = this.add
      .text(width / 2, height * 0.2, `Question ${this.currentQuestion + 1} of 3`, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    // Divider line
    const div = this.add.graphics();
    div.lineStyle(2, 0x444466, 1);
    div.lineBetween(width / 2, height * 0.25, width / 2, height * 0.8);

    // Left shape
    this.leftGfx = this.add.graphics();
    this.leftGfx.fillStyle(hexToNum(this.shapes![0].color), 1);
    drawShape(this.leftGfx, this.shapes![0].type, width * 0.25, shapeY, shapeSize);

    this.leftLabel = this.add
      .text(width * 0.25, shapeY + shapeSize + 18, this.shapes![0].type.toUpperCase(), {
        fontFamily: 'Arial Black',
        fontSize: '14px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    // Right shape
    this.rightGfx = this.add.graphics();
    this.rightGfx.fillStyle(hexToNum(this.shapes![1].color), 1);
    drawShape(this.rightGfx, this.shapes![1].type, width * 0.75, shapeY, shapeSize);

    this.rightLabel = this.add
      .text(width * 0.75, shapeY + shapeSize + 18, this.shapes![1].type.toUpperCase(), {
        fontFamily: 'Arial Black',
        fontSize: '14px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    // Tap hint
    this.add
      .text(width / 2, height * 0.88, 'Tap a shape to choose it', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#666688',
      })
      .setOrigin(0.5);

    // Click zones
    this.leftZone = this.add
      .zone(width * 0.25, height * 0.55, width * 0.5, height * 0.6)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => void this.handleGuess('left'));

    this.rightZone = this.add
      .zone(width * 0.75, height * 0.55, width * 0.5, height * 0.6)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => void this.handleGuess('right'));

    // Hover highlights
    const leftHighlight = this.add.rectangle(width * 0.25, height * 0.55, width * 0.48, height * 0.58, 0xffffff, 0).setDepth(-1);
    const rightHighlight = this.add.rectangle(width * 0.75, height * 0.55, width * 0.48, height * 0.58, 0xffffff, 0).setDepth(-1);
    this.leftZone
      .on('pointerover', () => leftHighlight.setFillStyle(0xffffff, 0.05))
      .on('pointerout', () => leftHighlight.setFillStyle(0xffffff, 0));
    this.rightZone
      .on('pointerover', () => rightHighlight.setFillStyle(0xffffff, 0.05))
      .on('pointerout', () => rightHighlight.setFillStyle(0xffffff, 0));

    // Feedback overlay (hidden)
    this.feedbackBg = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setVisible(false)
      .setDepth(10);
    this.feedbackText = this.add
      .text(width / 2, height / 2, '', {
        fontFamily: 'Arial Black',
        fontSize: '72px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(11);
  }

  private async handleGuess(choice: 'left' | 'right'): Promise<void> {
    if (this.answering || !this.questions) return;
    this.answering = true;

    this.leftZone?.disableInteractive();
    this.rightZone?.disableInteractive();

    try {
      const res = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIndex: this.currentQuestion, choice }),
      });
      const data = (await res.json()) as GuessResponse;
      this.score = data.score;

      this.showFeedback(data.correct, () => {
        if (data.done) {
          this.scene.start('GameOver', { score: data.score, streak: data.streak });
        } else {
          this.currentQuestion++;
          this.questionText?.setText(this.questions![this.currentQuestion].label);
          this.progressText?.setText(`Question ${this.currentQuestion + 1} of 3`);
          this.leftZone?.setInteractive({ useHandCursor: true });
          this.rightZone?.setInteractive({ useHandCursor: true });
          this.answering = false;
        }
      });
    } catch (e) {
      console.error('Guess error:', e);
      this.answering = false;
      this.leftZone?.setInteractive({ useHandCursor: true });
      this.rightZone?.setInteractive({ useHandCursor: true });
    }
  }

  private showFeedback(correct: boolean, onDone: () => void): void {
    if (!this.feedbackBg || !this.feedbackText) return;

    this.feedbackBg
      .setFillStyle(correct ? 0x004400 : 0x440000, 0.85)
      .setVisible(true);
    this.feedbackText
      .setText(correct ? '✓  Correct!' : '✗  Wrong!')
      .setColor(correct ? '#00ff88' : '#ff4444')
      .setVisible(true);

    this.time.delayedCall(1100, () => {
      this.feedbackBg?.setVisible(false);
      this.feedbackText?.setVisible(false);
      onDone();
    });
  }

  private showAlreadyPlayed(score: number): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height * 0.3, "You've already played today!", {
        fontFamily: 'Arial Black', fontSize: '28px', color: '#ffffff',
        align: 'center', wordWrap: { width: width * 0.85 },
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.48, `Your score: ${score}/3`, {
        fontFamily: 'Arial Black', fontSize: '52px', color: '#ffd700',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.62, 'Come back tomorrow!', {
        fontFamily: 'Arial', fontSize: '20px', color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.time.delayedCall(3000, () => this.scene.start('MainMenu'));
  }

  private showError(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Failed to load.\nPlease try again.', {
        fontFamily: 'Arial Black', fontSize: '28px', color: '#ff4444',
        align: 'center',
      })
      .setOrigin(0.5);
  }
}
