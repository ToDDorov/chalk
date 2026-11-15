import Dexie, { type Table } from 'dexie';
import type {
  BodyweightEntry,
  Exercise,
  PlannedItem,
  PlannedSession,
  TrainingBlock,
  Workout,
  WorkoutEntry,
} from './types';
import { buildSeed } from './seed';
import { blockWeek } from './lib/dates';
import { isTimeScore, normalizeName, parseTimeToSeconds } from './lib/score';
import type { RawSession } from './lib/plan';

class ChalkDB extends Dexie {
  exercises!: Table<Exercise, string>;
  blocks!: Table<TrainingBlock, string>;
  plans!: Table<PlannedSession, string>;
  workouts!: Table<Workout, string>;
  bodyweight!: Table<BodyweightEntry, string>;

  constructor() {
    super('chalk');
    this.version(1).stores({
      exercises: 'id, name',
      blocks: 'id, startDate',
      plans: 'id, date, blockId',
      workouts: 'id, date, blockId, planId, *metconNames',
      bodyweight: 'id, date',
    });
    // Runs once, when the database is first created on this device.
    this.on('populate', (tx) => {
      tx.table('exercises').bulkAdd(buildSeed().exercises);
    });
  }
}

export const db = new ChalkDB();

/** Fills in the derived fields, then writes the workout. */
export const saveWorkout = (w: Workout) => {
  const entries = w.entries.map((e): WorkoutEntry => {
    if (e.kind !== 'metcon') return e;
    const scoreSeconds = isTimeScore(e.scoreType) ? parseTimeToSeconds(e.score) : undefined;
    const { scoreSeconds: _old, ...rest } = e;
    return scoreSeconds === undefined ? rest : { ...rest, scoreSeconds };
  });
  const metconNames = [
    ...new Set(entries.flatMap((e) => (e.kind === 'metcon' && e.name.trim() ? [normalizeName(e.name)] : []))),
  ];
  return db.workouts.put({ ...w, entries, metconNames });
};

export const activeBlockFor = async (date: string) => {
  const blocks = await db.blocks.toArray();
  return blocks.find((b) => blockWeek(b.startDate, b.weeks, date) !== null);
};

const entryFromPlanned = (it: PlannedItem): WorkoutEntry => {
  switch (it.kind) {
    case 'strength':
      return {
        kind: 'strength',
        exerciseId: it.exerciseId,
        sets: Array.from({ length: it.sets }, () => ({
          reps: it.reps,
          weightKg: it.weightKg ?? 0,
          done: false,
        })),
      };
    case 'metcon':
      return {
        kind: 'metcon',
        name: it.name,
        scoreType: it.scoreType,
        score: '',
        rx: true,
        ...(it.description ? { description: it.description } : {}),
      };
    case 'skill':
      return {
        kind: 'skill',
        exerciseId: it.exerciseId,
        metric: it.metric,
        value: 0,
        ...(it.target !== undefined ? { target: it.target } : {}),
      };
  }
};

/** Creates the workout for a planned session, pre-filled with what was prescribed. */
export const startPlannedWorkout = async (plan: PlannedSession) => {
  const existing = await db.workouts.where('planId').equals(plan.id).first();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await saveWorkout({
    id,
    date: plan.date,
    planId: plan.id,
    blockId: plan.blockId ?? (await activeBlockFor(plan.date))?.id,
    title: plan.title,
    entries: plan.items.map(entryFromPlanned),
    notes: plan.notes,
    metconNames: [],
  });
  return id;
};

export const startBlankWorkout = async (date: string) => {
  const id = crypto.randomUUID();
  await saveWorkout({
    id,
    date,
    blockId: (await activeBlockFor(date))?.id,
    title: 'Workout',
    entries: [],
    metconNames: [],
  });
  return id;
};

/**
 * Imports pasted sessions. Unknown exercise names are added to the library.
 * Planned sessions already on the imported dates are replaced, unless a
 * workout has been logged against them.
 */
export const importPlan = (sessions: RawSession[]) =>
  db.transaction('rw', db.exercises, db.plans, db.workouts, db.blocks, async () => {
    const byName = new Map((await db.exercises.toArray()).map((e) => [e.name.toLowerCase(), e]));
    const resolve = async (name: string, kind: 'strength' | 'skill') => {
      const hit = byName.get(name.toLowerCase());
      if (hit) return hit.id;
      const ex: Exercise =
        kind === 'strength'
          ? { id: crypto.randomUUID(), name, category: 'barbell', unit: 'kg' }
          : { id: crypto.randomUUID(), name, category: 'skill', unit: 'reps' };
      await db.exercises.add(ex);
      byName.set(name.toLowerCase(), ex);
      return ex.id;
    };

    const dates = [...new Set(sessions.map((s) => s.date))];
    const old = await db.plans.where('date').anyOf(dates).toArray();
    const logged = new Set(
      (await db.workouts.where('planId').anyOf(old.map((p) => p.id)).toArray()).map((w) => w.planId),
    );
    await db.plans.bulkDelete(old.filter((p) => !logged.has(p.id)).map((p) => p.id));

    const blocks = await db.blocks.toArray();
    for (const s of sessions) {
      const items: PlannedItem[] = [];
      for (const it of s.items) {
        if (it.kind === 'metcon') items.push(it);
        else if (it.kind === 'strength') {
          const { exercise, ...rest } = it;
          items.push({ ...rest, exerciseId: await resolve(exercise, 'strength') });
        } else {
          const { exercise, ...rest } = it;
          items.push({ ...rest, exerciseId: await resolve(exercise, 'skill') });
        }
      }
      await db.plans.add({
        id: crypto.randomUUID(),
        date: s.date,
        blockId: blocks.find((b) => blockWeek(b.startDate, b.weeks, s.date) !== null)?.id,
        title: s.title,
        items,
        ...(s.notes ? { notes: s.notes } : {}),
      });
    }
  });

/** Most recent earlier result for a metcon with this name. */
export const previousMetcon = async (name: string, beforeDate: string, excludeWorkoutId: string) => {
  const key = normalizeName(name);
  if (!key) return undefined;
  const matches = (await db.workouts.where('metconNames').equals(key).toArray())
    .filter((w) => w.id !== excludeWorkoutId && w.date <= beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const w of matches) {
    const entry = w.entries.find(
      (e) => e.kind === 'metcon' && normalizeName(e.name) === key && e.score.trim(),
    );
    if (entry && entry.kind === 'metcon') return { date: w.date, score: entry.score, rx: entry.rx };
  }
  return undefined;
};
