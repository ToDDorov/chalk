import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { ExerciseMap } from './summary';

/** The exercise library, sorted by name, plus a lookup by id. */
export const useExercises = () => {
  const list = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const map: ExerciseMap = useMemo(() => new Map((list ?? []).map((e) => [e.id, e])), [list]);
  return { list: list ?? [], map, loaded: list !== undefined };
};
