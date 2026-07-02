import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DailyResponse,
  GuessRequest,
  GuessResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  StreakResponse,
  ShareResponse,
} from '../../shared/api';
import { TOTAL_QUESTIONS, QUESTIONS_PER_LEVEL, LEVEL_SHAPE_COUNTS } from '../../shared/api';
import { getDailyData, getDateKey, getWeekKey } from '../core/daily';

type ErrorResponse = { status: 'error'; message: string };

export const api = new Hono();

api.get('/daily', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId missing' }, 400);
  }

  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const date = getDateKey(new Date());

  try {
    const daily = await getDailyData(date);
    const guessesRaw = await redis.get(`user:${username}:guesses:${date}`);
    let guesses: boolean[] = guessesRaw ? (JSON.parse(guessesRaw) as boolean[]) : [];
    let score = parseInt((await redis.get(`user:${username}:score:${date}`)) ?? '0');

    if (guesses.length >= TOTAL_QUESTIONS) {
      guesses = [];
      score = 0;
      await redis.set(`user:${username}:guesses:${date}`, JSON.stringify([]));
      await redis.set(`user:${username}:score:${date}`, '0');
    }

    return c.json<DailyResponse>({
      type: 'daily',
      levels: daily.levels,
      guessesUsed: guesses.length,
      score,
      alreadyPlayed: false,
      totalQuestions: TOTAL_QUESTIONS,
    });
  } catch (err) {
    console.error('GET /api/daily error:', err);
    return c.json<ErrorResponse>({ status: 'error', message: 'Failed to load daily data' }, 500);
  }
});

api.post('/guess', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId missing' }, 400);
  }

  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const date = getDateKey(new Date());

  const body = await c.req.json<GuessRequest>();
  const { questionIndex, choiceIndex } = body;

  const guessesRaw = await redis.get(`user:${username}:guesses:${date}`);
  const guesses: boolean[] = guessesRaw ? (JSON.parse(guessesRaw) as boolean[]) : [];

  if (guesses.length !== questionIndex) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Invalid question index' }, 400);
  }

  const daily = await getDailyData(date);
  const levelIndex = Math.floor(questionIndex / QUESTIONS_PER_LEVEL);
  const questionInLevel = questionIndex % QUESTIONS_PER_LEVEL;
  const question = daily.levels[levelIndex]?.questions[questionInLevel];

  if (!question) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Invalid question index' }, 400);
  }

  const correct = question.answerIndex === choiceIndex;
  guesses.push(correct);
  await redis.set(`user:${username}:guesses:${date}`, JSON.stringify(guesses));

  const scoreRaw = await redis.get(`user:${username}:score:${date}`);
  let score = scoreRaw ? parseInt(scoreRaw) : 0;
  if (correct) score += 1;
  await redis.set(`user:${username}:score:${date}`, String(score));

  const done = guesses.length >= TOTAL_QUESTIONS;
  let streak = 0;

  if (done) {
    streak = await finalizeDay(username, date, score);
  } else {
    const streakRaw = await redis.get(`user:${username}:streak`);
    streak = streakRaw ? parseInt(streakRaw) : 0;
  }

  return c.json<GuessResponse>({ type: 'guess', correct, score, done, streak });
});

async function finalizeDay(username: string, date: string, score: number): Promise<number> {
  const lastPlayedKey = `user:${username}:lastPlayed`;
  const streakKey = `user:${username}:streak`;

  const lastPlayed = await redis.get(lastPlayedKey);
  const currentStreak = parseInt((await redis.get(streakKey)) ?? '0');

  let newStreak = 1;
  if (lastPlayed) {
    const yesterday = new Date(date + 'T00:00:00Z');
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = getDateKey(yesterday);
    if (lastPlayed === yesterdayStr) {
      newStreak = currentStreak + 1;
    } else if (lastPlayed === date) {
      newStreak = currentStreak;
    }
  }

  await redis.set(streakKey, String(newStreak));
  await redis.set(lastPlayedKey, date);

  const weekKey = getWeekKey(new Date());
  const weekScoreKey = `weekly:${weekKey}:${username}:score`;
  const currentWeekScore = parseInt((await redis.get(weekScoreKey)) ?? '0');
  const newWeekScore = currentWeekScore + score;
  await redis.set(weekScoreKey, String(newWeekScore));

  const playersKey = `weekly:${weekKey}:players`;
  const playersRaw = await redis.get(playersKey);
  const players: string[] = playersRaw ? (JSON.parse(playersRaw) as string[]) : [];
  if (!players.includes(username)) {
    players.push(username);
    await redis.set(playersKey, JSON.stringify(players));
  }

  return newStreak;
}

api.get('/leaderboard', async (c) => {
  const weekKey = getWeekKey(new Date());
  const weekLabel = weekKey;

  const playersRaw = await redis.get(`weekly:${weekKey}:players`);
  const players: string[] = playersRaw ? (JSON.parse(playersRaw) as string[]) : [];

  const entries: LeaderboardEntry[] = await Promise.all(
    players.map(async (u) => ({
      username: u,
      score: parseInt((await redis.get(`weekly:${weekKey}:${u}:score`)) ?? '0'),
    }))
  );

  entries.sort((a, b) => b.score - a.score);

  return c.json<LeaderboardResponse>({
    type: 'leaderboard',
    entries: entries.slice(0, 10),
    weekLabel,
  });
});

api.post('/share', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId missing' }, 400);
  }

  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const date = getDateKey(new Date());

  const guessesRaw = await redis.get(`user:${username}:guesses:${date}`);
  const guesses: boolean[] = guessesRaw ? (JSON.parse(guessesRaw) as boolean[]) : [];

  if (guesses.length < TOTAL_QUESTIONS) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Game not complete' }, 400);
  }

  const score = parseInt((await redis.get(`user:${username}:score:${date}`)) ?? '0');
  const streak = parseInt((await redis.get(`user:${username}:streak`)) ?? '0');

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const lines: string[] = [`📐 **Shape Dueler** — ${today}`, `Results for u/${username}:`, ''];

  LEVEL_SHAPE_COUNTS.forEach((count, lvl) => {
    const start = lvl * QUESTIONS_PER_LEVEL;
    const emojis = guesses
      .slice(start, start + QUESTIONS_PER_LEVEL)
      .map((g) => (g ? '✅' : '❌'))
      .join('');
    lines.push(`Level ${lvl + 1} (${count} shapes): ${emojis}`);
  });

  lines.push('');
  lines.push(`Score: ${score}/${TOTAL_QUESTIONS}${streak > 0 ? ` | 🔥 ${streak}-day streak` : ''}`);

  try {
    await reddit.submitComment({ id: postId, text: lines.join('\n'), runAs: 'APP' });
    return c.json<ShareResponse>({ type: 'share', success: true });
  } catch (err) {
    console.error('Share error:', err);
    return c.json<ErrorResponse>({ status: 'error', message: 'Failed to post comment' }, 500);
  }
});

api.get('/streak', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';

  const streakRaw = await redis.get(`user:${username}:streak`);
  const lastPlayed = (await redis.get(`user:${username}:lastPlayed`)) ?? '';

  return c.json<StreakResponse>({
    type: 'streak',
    streak: streakRaw ? parseInt(streakRaw) : 0,
    lastPlayed,
  });
});
