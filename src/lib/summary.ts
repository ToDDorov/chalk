import type { Exercise, PlannedItem, StrengthSet, WorkoutEntry } from '../types';
import { SCORE_TYPES, SKILL_METRICS } from '../types';

export type ExerciseMap = Map<string, Exercise>;

export const exerciseName = (map: ExerciseMap, id: string) => map.get(id)?.name ?? 'Unknown exercise';

export const scoreTypeLabel = (t: string) => SCORE_TYPES.find((s) => s.value === t)?.label ?? t;
export const metricLabel = (m: string) => SKILL_METRICS.find((s) => s.value === m)?.label ?? m;

export const formatKg = (n: number) => `${Number(n.toFixed(2))} kg`;

/** "5×5 @ 80 kg" when every set matches, otherwise "5 sets, top 90 kg × 3". */
export const summarizeSets = (sets: StrengthSet[]) => {
  const done = sets.filter((s) => s.done);
  if (!done.length) return sets.length ? `0 of ${sets.length} sets done` : 'no sets';
  const first = done[0];
  const uniform = done.every((s) => s.reps === first.reps && s.weightKg === first.weightKg);
  const suffix = done.length < sets.length ? ` (${done.length} of ${sets.length} sets)` : '';
  if (uniform) return `${done.length}×${first.reps} @ ${formatKg(first.weightKg)}${suffix}`;
  const top = done.reduce((a, b) => (b.weightKg > a.weightKg ? b : a));
  return `${done.length} sets, top ${formatKg(top.weightKg)} × ${top.reps}${suffix}`;
};

export const summarizeEntry = (e: WorkoutEntry, map: ExerciseMap): { title: string; detail: string } => {
  switch (e.kind) {
    case 'strength':
      return { title: exerciseName(map, e.exerciseId), detail: summarizeSets(e.sets) };
    case 'metcon':
      return {
        title: e.name || 'Metcon',
        detail: e.score
          ? `${e.score} · ${scoreTypeLabel(e.scoreType).toLowerCase()}${e.rx ? ' · Rx' : ' · scaled'}`
          : 'no score yet',
      };
    case 'skill':
      return {
        title: exerciseName(map, e.exerciseId),
        detail: e.value ? `${metricLabel(e.metric).toLowerCase()} ${e.value}` : 'not logged yet',
      };
  }
};

export const summarizePlanned = (it: PlannedItem, map: ExerciseMap): { title: string; detail: string } => {
  switch (it.kind) {
    case 'strength':
      return {
        title: exerciseName(map, it.exerciseId),
        detail:
          `${it.sets}×${it.reps}` +
          (it.weightKg !== undefined ? ` @ ${formatKg(it.weightKg)}` : '') +
          (it.note ? ` · ${it.note}` : ''),
      };
    case 'metcon':
      return {
        title: it.name,
        detail: it.description ?? `for ${scoreTypeLabel(it.scoreType).toLowerCase()}`,
      };
    case 'skill':
      return {
        title: exerciseName(map, it.exerciseId),
        detail:
          (it.target !== undefined ? `${metricLabel(it.metric).toLowerCase()} target ${it.target}` : metricLabel(it.metric)) +
          (it.description ? ` · ${it.description}` : ''),
      };
  }
};
