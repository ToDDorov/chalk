import type { SkillMetric, StrengthSet, Workout } from '../types';
import { addDays, startOfWeek } from './dates';
import { normalizeName } from './score';

/** Epley estimate of a one-rep max. A single is its own max. */
export const epley = (weightKg: number, reps: number) =>
  reps <= 1 ? weightKg : weightKg * (1 + reps / 30);

const round1 = (n: number) => Math.round(n * 10) / 10;

const doneSets = (sets: StrengthSet[]) => sets.filter((s) => s.done && s.reps > 0);

const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);

export interface LiftSession {
  workoutId: string;
  date: string;
  sets: StrengthSet[];
  /** Heaviest completed set. */
  top: StrengthSet;
  /** Best estimated 1RM across the completed sets, to 0.1 kg. */
  e1rm: number;
}

/** Every session in which the exercise had at least one completed set, oldest first. */
export const liftHistory = (workouts: Workout[], exerciseId: string): LiftSession[] =>
  workouts
    .flatMap((w) => {
      const sets = w.entries.flatMap((e) =>
        e.kind === 'strength' && e.exerciseId === exerciseId ? doneSets(e.sets) : [],
      );
      if (!sets.length) return [];
      const top = sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a));
      const e1rm = round1(Math.max(...sets.map((s) => epley(s.weightKg, s.reps))));
      return [{ workoutId: w.id, date: w.date, sets, top, e1rm }];
    })
    .sort(byDate);

/** What was done the last time before this workout: the "Previous" column. */
export const previousLift = (
  workouts: Workout[],
  exerciseId: string,
  beforeDate: string,
  excludeWorkoutId: string,
) => {
  const earlier = liftHistory(
    workouts.filter((w) => w.id !== excludeWorkoutId && w.date <= beforeDate),
    exerciseId,
  );
  return earlier[earlier.length - 1];
};

/** Heaviest completed weight in any other workout; a set above it is a record. */
export const bestWeightElsewhere = (workouts: Workout[], exerciseId: string, excludeWorkoutId: string) => {
  const sessions = liftHistory(
    workouts.filter((w) => w.id !== excludeWorkoutId),
    exerciseId,
  );
  return sessions.length ? Math.max(...sessions.map((s) => s.top.weightKg)) : undefined;
};

export interface LiftRecord {
  exerciseId: string;
  sessions: number;
  heaviest: { weightKg: number; reps: number; date: string };
  bestE1rm: { value: number; date: string };
  lastDate: string;
}

export const liftRecords = (workouts: Workout[]): LiftRecord[] => {
  const ids = new Set(
    workouts.flatMap((w) => w.entries.flatMap((e) => (e.kind === 'strength' ? [e.exerciseId] : []))),
  );
  return [...ids].flatMap((exerciseId) => {
    const h = liftHistory(workouts, exerciseId);
    if (!h.length) return [];
    const heavy = h.reduce((a, b) => (b.top.weightKg > a.top.weightKg ? b : a));
    const best = h.reduce((a, b) => (b.e1rm > a.e1rm ? b : a));
    return [
      {
        exerciseId,
        sessions: h.length,
        heaviest: { weightKg: heavy.top.weightKg, reps: heavy.top.reps, date: heavy.date },
        bestE1rm: { value: best.e1rm, date: best.date },
        lastDate: h[h.length - 1].date,
      },
    ];
  });
};

export interface MetconResult {
  date: string;
  score: string;
  scoreSeconds?: number;
  rx: boolean;
}

export interface MetconSeries {
  key: string;
  name: string;
  scoreType: string;
  results: MetconResult[];
}

/** Scored metcons grouped by name, most recently done first. */
export const metconSeries = (workouts: Workout[]): MetconSeries[] => {
  const groups = new Map<string, MetconSeries>();
  for (const w of [...workouts].sort(byDate))
    for (const e of w.entries) {
      if (e.kind !== 'metcon' || !e.name.trim() || !e.score.trim()) continue;
      const key = normalizeName(e.name);
      const g = groups.get(key) ?? { key, name: e.name.trim(), scoreType: e.scoreType, results: [] };
      g.name = e.name.trim();
      g.scoreType = e.scoreType;
      g.results.push({ date: w.date, score: e.score.trim(), scoreSeconds: e.scoreSeconds, rx: e.rx });
      groups.set(key, g);
    }
  return [...groups.values()].sort((a, b) =>
    b.results[b.results.length - 1].date.localeCompare(a.results[a.results.length - 1].date),
  );
};

export interface SkillSeries {
  exerciseId: string;
  metric: SkillMetric;
  results: { date: string; value: number }[];
  best: number;
}

export const skillSeries = (workouts: Workout[]): SkillSeries[] => {
  const groups = new Map<string, SkillSeries>();
  for (const w of [...workouts].sort(byDate))
    for (const e of w.entries) {
      if (e.kind !== 'skill' || !(e.value > 0)) continue;
      const key = `${e.exerciseId}|${e.metric}`;
      const g = groups.get(key) ?? { exerciseId: e.exerciseId, metric: e.metric, results: [], best: 0 };
      g.results.push({ date: w.date, value: e.value });
      g.best = Math.max(g.best, e.value);
      groups.set(key, g);
    }
  return [...groups.values()];
};

/** Workouts that actually contain something. */
const realWorkouts = (workouts: Workout[]) => workouts.filter((w) => w.entries.length > 0);

/** Sessions per week for the last `weeks` weeks, oldest first, ending with this week. */
export const weeklySessions = (workouts: Workout[], today: string, weeks = 8) => {
  const thisWeek = startOfWeek(today);
  const counts = new Map<string, number>();
  for (const w of realWorkouts(workouts)) {
    const k = startOfWeek(w.date);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(thisWeek, -7 * (weeks - 1 - i));
    return { weekStart, count: counts.get(weekStart) ?? 0 };
  });
};

/** Weeks in a row with at least one session. An empty current week does not break it yet. */
export const weekStreak = (workouts: Workout[], today: string) => {
  const active = new Set(realWorkouts(workouts).map((w) => startOfWeek(w.date)));
  let week = startOfWeek(today);
  if (!active.has(week)) week = addDays(week, -7);
  let streak = 0;
  while (active.has(week)) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
};

/** Three to five round tick values covering [min, max]. */
export const niceTicks = (min: number, max: number, target = 4) => {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v < max + step - 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
};

export const formatSeconds = (s: number) => {
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  return `${m}:${String(total % 60).padStart(2, '0')}`;
};
