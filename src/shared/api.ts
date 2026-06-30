export type ShapeType = 'circle' | 'triangle' | 'square' | 'pentagon' | 'hexagon' | 'star';
export type Property = 'sides' | 'area' | 'perimeter';

export type Shape = {
  type: ShapeType;
  size: number;
  color: string;
};

export type Question = {
  property: Property;
  label: string;
  answer: 'left' | 'right';
};

export type DailyResponse = {
  type: 'daily';
  shapes: [Shape, Shape];
  questions: Question[];
  guessesUsed: number;
  score: number;
  alreadyPlayed: boolean;
};

export type GuessRequest = {
  questionIndex: number;
  choice: 'left' | 'right';
};

export type GuessResponse = {
  type: 'guess';
  correct: boolean;
  score: number;
  done: boolean;
  streak: number;
};

export type LeaderboardEntry = {
  username: string;
  score: number;
};

export type LeaderboardResponse = {
  type: 'leaderboard';
  entries: LeaderboardEntry[];
  weekLabel: string;
};

export type StreakResponse = {
  type: 'streak';
  streak: number;
  lastPlayed: string;
};
