export type ShapeType = 'circle' | 'triangle' | 'square' | 'pentagon' | 'hexagon' | 'star';
export type Property = 'sides' | 'area' | 'perimeter';

export type Shape = {
  type: ShapeType;
  size: number;
  color: string;
};

export const LEVEL_SHAPE_COUNTS = [2, 3, 4, 5] as const;
export const QUESTIONS_PER_LEVEL = 3;
export const TOTAL_QUESTIONS = LEVEL_SHAPE_COUNTS.length * QUESTIONS_PER_LEVEL;

export type Question = {
  property: Property;
  label: string;
  answerIndex: number;
  shapes: Shape[];
};

export type DailyLevel = {
  questions: Question[];
};

export type DailyResponse = {
  type: 'daily';
  levels: DailyLevel[];
  guessesUsed: number;
  score: number;
  alreadyPlayed: boolean;
  totalQuestions: number;
};

export type GuessRequest = {
  questionIndex: number;
  choiceIndex: number;
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

export type ShareResponse = {
  type: 'share';
  success: boolean;
};
