import { redis } from '@devvit/web/server';
import type { DailyLevel, Shape, ShapeType, Question, Property } from '../../shared/api';
import { LEVEL_SHAPE_COUNTS, QUESTIONS_PER_LEVEL } from '../../shared/api';

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223 | 0;
    return (s >>> 0) / 0x100000000;
  };
}

const SHAPE_TYPES: ShapeType[] = ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'star'];
const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

function computeProperties(type: ShapeType, size: number): Record<Property, number> {
  switch (type) {
    case 'circle':
      return {
        sides: 0,
        area: Math.PI * size * size,
        perimeter: 2 * Math.PI * size,
      };
    case 'triangle': {
      const side = 2 * size;
      return {
        sides: 3,
        area: (Math.sqrt(3) / 4) * side * side,
        perimeter: 3 * side,
      };
    }
    case 'square': {
      const side = 2 * size;
      return {
        sides: 4,
        area: side * side,
        perimeter: 4 * side,
      };
    }
    case 'pentagon': {
      const s = 2 * size * Math.sin(Math.PI / 5);
      return {
        sides: 5,
        area: (5 * s * s) / (4 * Math.tan(Math.PI / 5)),
        perimeter: 5 * s,
      };
    }
    case 'hexagon': {
      const side = size;
      return {
        sides: 6,
        area: (3 * Math.sqrt(3) / 2) * side * side,
        perimeter: 6 * side,
      };
    }
    case 'star': {
      const outerR = size;
      const innerR = size * 0.4;
      const angle = (2 * Math.PI) / 10;
      const edgeLen = Math.sqrt(
        outerR * outerR + innerR * innerR - 2 * outerR * innerR * Math.cos(angle)
      );
      const area = (5 / 2) * Math.sin((4 * Math.PI) / 5) * (outerR * outerR - innerR * innerR);
      return {
        sides: 10,
        area,
        perimeter: 10 * edgeLen,
      };
    }
  }
}

const PROPERTY_LABELS: Record<Property, string> = {
  sides: 'Which shape has MORE sides?',
  area: 'Which shape has a LARGER area?',
  perimeter: 'Which shape has a LONGER perimeter?',
};

export type DailyData = {
  levels: DailyLevel[];
};

export function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getWeekKey(date: Date): string {
  const year = date.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
  );
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function pickShape(rng: () => number, usedSignatures: Set<string>, usedTypes: Set<ShapeType>): Shape {
  for (let attempts = 0; attempts < 200; attempts++) {
    const type = SHAPE_TYPES[Math.floor(rng() * SHAPE_TYPES.length)];
    if (!type) continue;
    if (usedTypes.has(type)) continue;

    const color = COLORS[Math.floor(rng() * COLORS.length)];
    if (!color) continue;
    const size = 40 + Math.floor(rng() * 60);
    const signature = `${type}:${size}:${color}`;

    if (usedSignatures.has(signature)) continue;

    usedSignatures.add(signature);
    usedTypes.add(type);
    return { type, size, color };
  }

  throw new Error('Unable to generate a unique shape');
}

function buildLevel(rng: () => number, shapeCount: number, usedSignatures: Set<string>): DailyLevel {
  const properties: Property[] = ['sides', 'area', 'perimeter'];

  const questions: Question[] = properties.map((property) => {
    const usedTypes = new Set<ShapeType>();
    const shapes: Shape[] = [];
    for (let i = 0; i < shapeCount; i++) {
      shapes.push(pickShape(rng, usedSignatures, usedTypes));
    }

    let answerIndex = 0;
    let bestValue = -Infinity;
    shapes.forEach((shape, index) => {
      const value = computeProperties(shape.type, shape.size)[property];
      if (value > bestValue) {
        bestValue = value;
        answerIndex = index;
      }
    });

    return { property, label: PROPERTY_LABELS[property], answerIndex, shapes };
  });

  return { questions };
}

export async function getDailyData(date: string): Promise<DailyData> {
  const cacheKey = `daily:v2:${date}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as DailyData;

  const seed = parseInt(date.replace(/-/g, ''), 10);
  const rng = seededRandom(seed);
  const usedSignatures = new Set<string>();

  const levels = LEVEL_SHAPE_COUNTS.map((shapeCount) => buildLevel(rng, shapeCount, usedSignatures));
  const data: DailyData = { levels };

  await redis.set(cacheKey, JSON.stringify(data));
  return data;
}

export async function getCorrectAnswer(date: string, questionIndex: number): Promise<number> {
  const data = await getDailyData(date);
  const levelIndex = Math.floor(questionIndex / QUESTIONS_PER_LEVEL);
  const questionInLevel = questionIndex % QUESTIONS_PER_LEVEL;
  const level = data.levels[levelIndex];
  if (!level) throw new Error('Invalid question index');
  const question = level.questions[questionInLevel];
  if (!question) throw new Error('Invalid question index');
  return question.answerIndex;
}
