import type { Exercise, ExerciseCategory, ExerciseUnit } from './types';

type Row = [name: string, category: ExerciseCategory, unit: ExerciseUnit, notes?: string];

const EXERCISES: Row[] = [
  ['Back Squat', 'barbell', 'kg'],
  ['Strict Press', 'barbell', 'kg'],
  ['Deadlift', 'barbell', 'kg'],
  ['Bench Press', 'barbell', 'kg'],
  ['Front Squat', 'barbell', 'kg'],
  ['Power Snatch', 'barbell', 'kg'],
  ['Hang Snatch', 'barbell', 'kg'],
  ['Squat Snatch', 'barbell', 'kg'],
  ['Power Clean', 'barbell', 'kg'],
  ['Hang Clean', 'barbell', 'kg'],
  ['Push Press', 'barbell', 'kg'],
  ['Push Jerk', 'barbell', 'kg'],
  ['Split Jerk', 'barbell', 'kg'],
  ['DB Snatch', 'dumbbell', 'kg'],
  ['DB Clean & Jerk', 'dumbbell', 'kg'],
  ["Devil's Press", 'dumbbell', 'kg'],
  ['KB Swing', 'kettlebell', 'kg'],
  ['Goblet Squat', 'kettlebell', 'kg'],
  ['Farmers Carry', 'kettlebell', 'meters'],
  ['Chin-Up', 'gymnastics', 'reps'],
  ['Pull-Up', 'gymnastics', 'reps'],
  ['Ring Dip', 'gymnastics', 'reps', 'progression'],
  ['Ring Row', 'gymnastics', 'reps'],
  ['T2B', 'gymnastics', 'reps'],
  ['Wall Ball', 'gymnastics', 'reps'],
  ['Box Jump', 'gymnastics', 'reps'],
  ['Burpee', 'gymnastics', 'reps'],
  ['Bar-Facing Burpee', 'gymnastics', 'reps'],
  ['Wall Walk', 'gymnastics', 'reps'],
  ['Double Unders', 'skill', 'reps'],
  ['Row', 'cardio', 'calories'],
  ['Bike', 'cardio', 'calories'],
  ['Ski', 'cardio', 'calories'],
  ['Run', 'cardio', 'meters'],
];

/** The starting exercise library. Maxes and history are entered in the app. */
export const buildSeed = (): { exercises: Exercise[] } => ({
  exercises: EXERCISES.map(([name, category, unit, notes]) => ({
    id: crypto.randomUUID(),
    name,
    category,
    unit,
    ...(notes ? { notes } : {}),
  })),
});
