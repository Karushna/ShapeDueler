import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DailyResponse,
  GuessRequest,
  GuessResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  StreakResponse,
} from '../../shared/api';
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
    const guesses: boolean[] = guessesRaw ? (JSON.parse(guessesRaw) as boolean[]) : [];
    const guessesUsed = guesses.length;
    const scoreRaw = await redis.get(`user:${username}:score:${date}`);
    const score = scoreRaw ? parseInt(scoreRaw) : 0;

    return c.json<DailyResponse>({
      type: 'daily',
      shapes: daily.shapes,
      questions: daily.questions,
      guessesUsed,
      score,
      alreadyPlayed: guessesUsed >= 3,
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
  const { questionIndex, choice } = body;

  const guessesRaw = await redis.get(`user:${username}:guesses:${date}`);
  const guesses: boolean[] = guessesRaw ? (JSON.parse(guessesRaw) as boolean[]) : [];

  if (guesses.length !== questionIndex) {
    return c.json<ErrorResponse>({ status: 'error', message: 'Invalid question index' }, 400);
  }

  const daily = await getDailyData(date);
  const correct = daily.questions[questionIndex].answer === choice;
  guesses.push(correct);
  await redis.set(`user:${username}:guesses:${date}`, JSON.stringify(guesses));

  const scoreRaw = await redis.get(`user:${username}:score:${date}`);
  let score = scoreRaw ? parseInt(scoreRaw) : 0;
  if (correct) score += 1;
  await redis.set(`user:${username}:score:${date}`, String(score));

  const done = guesses.length >= 3;
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
