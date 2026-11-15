import type { ScoreType, SkillMetric } from '../types';
import { isISODate } from './dates';

// The paste-in plan format. Exercises are referenced by name so that a plan
// written outside the app (by hand or by an AI chat) needs no ids.

export type RawItem =
  | { kind: 'strength'; exercise: string; sets: number; reps: number; weightKg?: number; note?: string }
  | { kind: 'metcon'; name: string; scoreType: ScoreType; description?: string }
  | { kind: 'skill'; exercise: string; metric: SkillMetric; target?: number; description?: string };

export interface RawSession {
  date: string;
  title: string;
  items: RawItem[];
  notes?: string;
}

export type ParseResult = { ok: true; sessions: RawSession[] } | { ok: false; error: string };

const SCORE_TYPES: ScoreType[] = ['time', 'rounds+reps', 'worst-round-time', 'max-reps', 'load'];
const METRICS: SkillMetric[] = ['total', 'max-unbroken', 'practice-minutes'];

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Pulls the JSON out of pasted text, tolerating code fences and chat around it. */
const extractJson = (text: string): unknown => {
  const starts = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0);
  if (!starts.length) throw new Error('No JSON found in the pasted text.');
  const start = Math.min(...starts);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The pasted text is not valid JSON.');
  }
};

const parseItem = (raw: unknown, where: string): RawItem => {
  if (!raw || typeof raw !== 'object') throw new Error(`${where}: item is not an object.`);
  const r = raw as Record<string, unknown>;
  switch (r.kind) {
    case 'strength': {
      const exercise = str(r.exercise);
      const sets = num(r.sets);
      const reps = num(r.reps);
      if (!exercise) throw new Error(`${where}: strength item needs "exercise".`);
      if (!sets || sets < 1 || sets > 30 || !Number.isInteger(sets))
        throw new Error(`${where}: "${exercise}" needs "sets" between 1 and 30.`);
      if (!reps || reps < 1 || !Number.isInteger(reps))
        throw new Error(`${where}: "${exercise}" needs a whole number of "reps".`);
      const weightKg = num(r.weightKg);
      if (weightKg !== undefined && weightKg < 0)
        throw new Error(`${where}: "${exercise}" has a negative weight.`);
      return { kind: 'strength', exercise, sets, reps, weightKg, note: str(r.note) };
    }
    case 'metcon': {
      const name = str(r.name);
      if (!name) throw new Error(`${where}: metcon item needs "name".`);
      const scoreType = (r.scoreType ?? 'time') as ScoreType;
      if (!SCORE_TYPES.includes(scoreType))
        throw new Error(`${where}: "${name}" has unknown scoreType "${String(r.scoreType)}".`);
      return { kind: 'metcon', name, scoreType, description: str(r.description) };
    }
    case 'skill': {
      const exercise = str(r.exercise);
      if (!exercise) throw new Error(`${where}: skill item needs "exercise".`);
      const metric = (r.metric ?? 'total') as SkillMetric;
      if (!METRICS.includes(metric))
        throw new Error(`${where}: "${exercise}" has unknown metric "${String(r.metric)}".`);
      return { kind: 'skill', exercise, metric, target: num(r.target), description: str(r.description) };
    }
    default:
      throw new Error(`${where}: unknown item kind "${String(r.kind)}".`);
  }
};

export const parsePlanText = (text: string): ParseResult => {
  try {
    const json = extractJson(text);
    const list = Array.isArray(json) ? json : (json as { sessions?: unknown }).sessions;
    if (!Array.isArray(list) || list.length === 0)
      throw new Error('Expected a "sessions" list with at least one session.');
    const sessions = list.map((raw, i): RawSession => {
      const where = `Session ${i + 1}`;
      if (!raw || typeof raw !== 'object') throw new Error(`${where} is not an object.`);
      const r = raw as Record<string, unknown>;
      if (!isISODate(r.date)) throw new Error(`${where}: "date" must be a real date as YYYY-MM-DD.`);
      if (!Array.isArray(r.items) || r.items.length === 0)
        throw new Error(`${where} (${r.date}): needs at least one item.`);
      return {
        date: r.date,
        title: str(r.title) ?? 'Workout',
        items: r.items.map((it, j) => parseItem(it, `${where} (${r.date}), item ${j + 1}`)),
        notes: str(r.notes),
      };
    });
    return { ok: true, sessions };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not read the plan.' };
  }
};

/** Exercise names a plan refers to, in first-seen order. */
export const planExerciseNames = (sessions: RawSession[]) => {
  const seen = new Map<string, string>();
  for (const s of sessions)
    for (const it of s.items)
      if (it.kind !== 'metcon' && !seen.has(it.exercise.toLowerCase()))
        seen.set(it.exercise.toLowerCase(), it.exercise);
  return [...seen.values()];
};

export const buildPlanPrompt = (exerciseNames: string[], today: string) =>
  `Convert my training plan into JSON for my workout app. Reply with only one JSON code block, nothing else.

Format:
{
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "title": "Squat day",
      "notes": "optional",
      "items": [
        { "kind": "strength", "exercise": "Back Squat", "sets": 5, "reps": 5, "weightKg": 80, "note": "optional" },
        { "kind": "metcon", "name": "Metcon B", "scoreType": "time", "description": "the full workout text" },
        { "kind": "skill", "exercise": "Double Unders", "metric": "total", "target": 100, "description": "optional" }
      ]
    }
  ]
}

Rules:
- One session per training day. Today is ${today}.
- Weights are in kg. Leave "weightKg" out if I did not give one.
- "scoreType" is one of: time, rounds+reps, worst-round-time, max-reps, load.
- "metric" is one of: total, max-unbroken, practice-minutes.
- Use these exact exercise names when they fit: ${exerciseNames.join(', ')}.
- Give a repeated metcon the same "name" every time so scores can be compared.

My plan:
`;
