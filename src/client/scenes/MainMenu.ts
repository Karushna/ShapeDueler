import { Scene, GameObjects } from 'phaser';
import type { StreakResponse, LeaderboardResponse } from '../../shared/api';

export class MainMenu extends Scene {
  private titleText: GameObjects.Text | null = null;
  private dateText: GameObjects.Text | null = null;
  private streakText: GameObjects.Text | null = null;
  private leaderboardTexts: GameObjects.Text[] = [];
  private playButton: GameObjects.Text | null = null;
  private statusText: GameObjects.Text | null = null;

  constructor() {
    super('MainMenu');
  }

  init(): void {
    this.titleText = null;
    this.dateText = null;
    this.streakText = null;
    this.leaderboardTexts = [];
    this.playButton = null;
    this.statusText = null;
  }

  create() {
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    const { width, height } = this.scale;

    this.titleText = this.add
      .text(width / 2, height * 0.1, 'Daily Shape Dueler', {
        fontFamily: 'Arial Black',
        fontSize: '36px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5);

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    this.dateText = this.add
      .text(width / 2, height * 0.19, today, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.streakText = this.add
      .text(width / 2, height * 0.28, 'Loading...', {
        fontFamily: 'Arial Black',
        fontSize: '22px',
        color: '#f39c12',
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(width / 2, height * 0.36, '', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#aaaaaa',
        align: 'center',
      })
      .setOrigin(0.5);

    // Leaderboard header
    this.add
      .text(width / 2, height * 0.46, 'THIS WEEK\'S TOP PLAYERS', {
        fontFamily: 'Arial Black',
        fontSize: '14px',
        color: '#888888',
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    // Placeholder leaderboard rows
    for (let i = 0; i < 3; i++) {
      const t = this.add
        .text(width / 2, height * 0.53 + i * height * 0.07, '—', {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#cccccc',
        })
        .setOrigin(0.5);
      this.leaderboardTexts.push(t);
    }

    this.playButton = this.add
      .text(width / 2, height * 0.82, "▶  Play Today's Challenge", {
        fontFamily: 'Arial Black',
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#d93900',
        padding: { x: 24, y: 14 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.playButton!.setStyle({ backgroundColor: '#ff4500' }))
      .on('pointerout', () => this.playButton!.setStyle({ backgroundColor: '#d93900' }))
      .on('pointerdown', () => this.scene.start('Game'));

    void this.loadData();

    this.scale.on('resize', () => this.refreshLayout());
  }

  private async loadData(): Promise<void> {
    try {
      const [streakRes, lbRes] = await Promise.all([
        fetch('/api/streak').then((r) => r.json() as Promise<StreakResponse>),
        fetch('/api/leaderboard').then((r) => r.json() as Promise<LeaderboardResponse>),
      ]);

      if (this.streakText) {
        const s = streakRes.streak;
        this.streakText.setText(s > 0 ? `🔥 ${s}-day streak!` : 'No active streak — play today!');
      }

      lbRes.entries.slice(0, 3).forEach((entry, i) => {
        const medal = ['🥇', '🥈', '🥉'][i];
        if (this.leaderboardTexts[i]) {
          this.leaderboardTexts[i].setText(`${medal}  ${entry.username}  —  ${entry.score} pts`);
        }
      });

      if (lbRes.entries.length === 0 && this.leaderboardTexts[0]) {
        this.leaderboardTexts[0].setText('No players yet this week!');
      }
    } catch (e) {
      console.error('MainMenu loadData error:', e);
      if (this.streakText) this.streakText.setText('');
    }
  }

  private refreshLayout(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);
    this.titleText?.setPosition(width / 2, height * 0.1);
    this.dateText?.setPosition(width / 2, height * 0.19);
    this.streakText?.setPosition(width / 2, height * 0.28);
    this.statusText?.setPosition(width / 2, height * 0.36);
    this.playButton?.setPosition(width / 2, height * 0.82);
    this.leaderboardTexts.forEach((t, i) => t.setPosition(width / 2, height * 0.53 + i * height * 0.07));
  }
}
