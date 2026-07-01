import { Scene, GameObjects } from 'phaser';
import * as Phaser from 'phaser';
import type { DailyResponse, GuessResponse, ShapeType } from '../../shared/api';
import { TOTAL_QUESTIONS } from '../../shared/api';

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
        x,
        y - (h * 2) / 3,
        x - size,
        y + h / 3,
        x + size,
        y + h / 3
      );
      break;
    }
    case 'square':
      gfx.fillRect(x - size, y - size, size * 2, size * 2);
      break;
    case 'pentagon':
    case 'hexagon': {
      const sides = type === 'pentagon' ? 5 : 6;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        pts.push(new Phaser.Math.Vector2(x + Math.cos(angle) * size, y + Math.sin(angle) * size));
      }
      gfx.fillPoints(pts, true);
      break;
    }
    case 'star': {
      const outerR = size;
      const innerR = size * 0.4;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        pts.push(new Phaser.Math.Vector2(x + Math.cos(angle) * r, y + Math.sin(angle) * r));
      }
      gfx.fillPoints(pts, true);
      break;
    }
  }
}

type ShapeSlot = {
  zone: GameObjects.Zone;
  highlight: GameObjects.Rectangle;
  gfx: Phaser.GameObjects.Graphics;
  label: GameObjects.Text;
};

type QuestionLocation = {
  levelIndex: number;
  questionIndex: number;
};

export class Game extends Scene {
  private levels: DailyResponse['levels'] | null = null;
  private currentQuestion = 0;
  private currentLevelIndex = 0;
  private answering = false;

  private questionText: GameObjects.Text | null = null;
  private progressText: GameObjects.Text | null = null;
  private feedbackBg: GameObjects.Rectangle | null = null;
  private feedbackText: GameObjects.Text | null = null;

  private shapeSlots: ShapeSlot[] = [];

  constructor() {
    super('Game');
  }

  init(): void {
    this.levels = null;
    this.currentQuestion = 0;
    this.currentLevelIndex = 0;
    this.answering = false;
    this.questionText = null;
    this.progressText = null;
    this.feedbackBg = null;
    this.feedbackText = null;
    this.shapeSlots = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    this.scale.on('resize', this.handleResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize);
    });
    void this.loadDaily();
  }

  private handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.cameras.resize(gameSize.width, gameSize.height);
    if (this.levels) {
      this.renderCurrentState();
    }
  };

  private async loadDaily(): Promise<void> {
    try {
      const res = await fetch('/api/daily');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DailyResponse;

      this.levels = data.levels;
      this.currentQuestion = data.guessesUsed;
      this.currentLevelIndex = this.getQuestionLocation(this.currentQuestion)?.levelIndex ?? 0;
      this.buildUI();
      this.renderCurrentState();
    } catch (e) {
      console.error('Failed to load daily data:', e);
      this.showError();
    }
  }

  private buildUI(): void {
    const { width, height } = this.scale;

    this.questionText = this.add
      .text(width / 2, height * 0.1, '', {
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
      .text(width / 2, height * 0.2, '', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.88, 'Tap a shape to choose it', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#666688',
      })
      .setOrigin(0.5);

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

  private renderCurrentState(): void {
    const location = this.getQuestionLocation(this.currentQuestion);
    if (!location || !this.levels) return;

    this.currentLevelIndex = location.levelIndex;
    this.renderShapes(location);
    this.updateQuestionText();
    this.setInteractiveState(!this.answering);
  }

  private renderShapes(location: QuestionLocation): void {
    this.clearLevelObjects();

    const level = this.levels?.[location.levelIndex];
    const question = level?.questions[location.questionIndex];
    if (!level || !question) return;

    const { width, height } = this.scale;
    const shapeY = height * 0.52;
    const shapes = question.shapes;
    const shapeSize = this.getShapeSize(shapes.length, width, height);
    const positions = this.getShapePositions(shapes.length, width);

    shapes.forEach((shape, index) => {
      const x = positions[index];
      if (x === undefined) return;

      const slot: ShapeSlot = {
        highlight: this.add.rectangle(x, shapeY, shapeSize * 2.5, shapeSize * 2.5, 0xffffff, 0),
        gfx: this.add.graphics(),
        label: this.add
          .text(x, shapeY + shapeSize + 18, shape.type.toUpperCase(), {
            fontFamily: 'Arial Black',
            fontSize: '14px',
            color: '#cccccc',
          })
          .setOrigin(0.5),
        zone: this.add.zone(x, shapeY, shapeSize * 2.6, shapeSize * 2.6),
      };

      slot.highlight.setDepth(-1);
      slot.gfx.fillStyle(hexToNum(shape.color), 1);
      drawShape(slot.gfx, shape.type, x, shapeY, shapeSize);

      slot.zone
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => void this.handleGuess(index))
        .on('pointerover', () => slot.highlight.setFillStyle(0xffffff, 0.06))
        .on('pointerout', () => slot.highlight.setFillStyle(0xffffff, 0));

      this.shapeSlots.push(slot);
    });
  }

  private clearLevelObjects(): void {
    this.shapeSlots.forEach((slot) => {
      slot.zone.destroy();
      slot.highlight.destroy();
      slot.gfx.destroy();
      slot.label.destroy();
    });
    this.shapeSlots = [];
  }

  private getQuestionLocation(questionIndex: number): QuestionLocation | null {
    if (!this.levels) return null;

    let remaining = questionIndex;
    for (let levelIndex = 0; levelIndex < this.levels.length; levelIndex++) {
      const level = this.levels[levelIndex];
      if (!level) continue;

      const questionCount = level.questions.length;
      if (remaining < questionCount) {
        return { levelIndex, questionIndex: remaining };
      }
      remaining -= questionCount;
    }

    return null;
  }

  private updateQuestionText(): void {
    const location = this.getQuestionLocation(this.currentQuestion);
    if (!location || !this.levels) return;
    const level = this.levels[location.levelIndex];
    const question = level?.questions[location.questionIndex];
    if (!level || !question) return;

    this.questionText?.setText(question.label);
    this.progressText?.setText(
      `Question ${this.currentQuestion + 1} of ${TOTAL_QUESTIONS}  |  Level ${location.levelIndex + 1} of ${this.levels?.length ?? 0}`
    );
  }

  private getShapeSize(shapeCount: number, width: number, height: number): number {
    const base = Math.min(width * 0.09, height * 0.14, 78);
    return Math.max(28, base - Math.max(0, shapeCount - 2) * 6);
  }

  private getShapePositions(shapeCount: number, width: number): number[] {
    if (shapeCount === 1) return [width / 2];

    const left = width * 0.14;
    const right = width * 0.86;
    const step = (right - left) / (shapeCount - 1);
    return Array.from({ length: shapeCount }, (_, index) => left + step * index);
  }

  private setInteractiveState(enabled: boolean): void {
    this.shapeSlots.forEach((slot) => {
      if (enabled) {
        slot.zone.setInteractive({ useHandCursor: true });
      } else {
        slot.zone.disableInteractive();
      }
    });
  }

  private async handleGuess(choiceIndex: number): Promise<void> {
    if (this.answering || !this.levels) return;
    this.answering = true;
    this.setInteractiveState(false);

    try {
      const res = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIndex: this.currentQuestion, choiceIndex }),
      });
      const data = (await res.json()) as GuessResponse;

      this.showFeedback(data.correct, () => {
        if (data.done) {
          this.scene.start('GameOver', { score: data.score, streak: data.streak });
          return;
        }

        this.currentQuestion++;
        this.answering = false;
        this.renderCurrentState();
      });
    } catch (e) {
      console.error('Guess error:', e);
      this.answering = false;
      this.setInteractiveState(true);
    }
  }

  private showFeedback(correct: boolean, onDone: () => void): void {
    if (!this.feedbackBg || !this.feedbackText) return;

    this.feedbackBg
      .setFillStyle(correct ? 0x004400 : 0x440000, 0.85)
      .setVisible(true);
    this.feedbackText
      .setText(correct ? 'Correct!' : 'Wrong!')
      .setColor(correct ? '#00ff88' : '#ff4444')
      .setVisible(true);

    this.time.delayedCall(1100, () => {
      this.feedbackBg?.setVisible(false);
      this.feedbackText?.setVisible(false);
      onDone();
    });
  }

  private showError(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Failed to load.\nPlease try again.', {
        fontFamily: 'Arial Black',
        fontSize: '28px',
        color: '#ff4444',
        align: 'center',
      })
      .setOrigin(0.5);
  }
}
