import { redis } from '@devvit/web/server';
import type { Shape, ShapeType, Question, Property } from '../../shared/api';

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
      // Equilateral triangle drawn with half-base = size
      const side = 2 * size;
      return {
        sides: 3,
        area: (Math.sqrt(3) / 4) * side * side,
        perimeter: 3 * side,
      };
    }
    case 'square': {
      // Square drawn with half-side = size
      const side = 2 * size;
      return {
        sides: 4,
        area: side * side,
        perimeter: 4 * side,
      };
    }
    case 'pentagon': {
      // Regular pentagon, circumradius = size
      const s = 2 * size * Math.sin(Math.PI / 5);
      return {
        sides: 5,
        area: (5 * s * s) / (4 * Math.tan(Math.PI / 5)),
        perimeter: 5 * s,
      };
    }
    case 'hexagon': {
      // Regular hexagon, circumradius = size (side = circumradius)
      const side = size;
      return {
        sides: 6,
        area: (3 * Math.sqrt(3) / 2) * side * side,
        perimeter: 6 * side,
      };
    }
    case 'star': {
      // 5-pointed star, outer radius = size, inner radius = size * 0.4
      const outerR = size;
      const innerR = size * 0.4;
      const angle = (2 * Math.PI) / 10;
      const edgeLen = Math.sqrt(
        outerR * outerR + innerR * innerR - 2 * outerR * innerR * Math.cos(angle)
      );
      // Area approximation using shoelace on alternating outer/inner vertices
      const area = (5 / 2) * Math.sin(4 * Math.PI / 5) * (outerR * outerR - innerR * innerR);
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
  shapes: [Shape, Shape];
  questions: Question[];
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

export async function getDailyData(date: string): Promise<DailyData> {
  const cacheKey = `daily:${date}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as DailyData;

  const seed = parseInt(date.replace(/-/g, ''), 10);
  const rng = seededRandom(seed);

  const pickShape = (): Shape => {
    const type = SHAPE_TYPES[Math.floor(rng() * SHAPE_TYPES.length)];
    const color = COLORS[Math.floor(rng() * COLORS.length)];
    const size = 40 + Math.floor(rng() * 60);
    return { type, size, color };
  };

  let left = pickShape();
  let right = pickShape();
  while (right.type === left.type) {
    right = pickShape();
  }

  const shapes: [Shape, Shape] = [left, right];

  const properties: Property[] = ['sides', 'area', 'perimeter'];
  const questions: Question[] = properties.map((property) => {
    const lVal = computeProperties(left.type, left.size)[property];
    const rVal = computeProperties(right.type, right.size)[property];
    const answer: 'left' | 'right' = lVal >= rVal ? 'left' : 'right';
    return { property, label: PROPERTY_LABELS[property], answer };
  });

  const data: DailyData = { shapes, questions };
  await redis.set(cacheKey, JSON.stringify(data));

  return data;
}

export async function getCorrectAnswer(
  date: string,
  questionIndex: number
): Promise<'left' | 'right'> {
  const data = await getDailyData(date);
  return data.questions[questionIndex].answer;
}
