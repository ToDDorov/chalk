// All ids are crypto.randomUUID(). Dates are local calendar days, "YYYY-MM-DD".

export type ExerciseCategory =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'gymnastics'
  | 'cardio'
  | 'skill';

export type ExerciseUnit = 'kg' | 'reps' | 'seconds' | 'calories' | 'meters';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  unit: ExerciseUnit;
  oneRepMax?: number;
  oneRepMaxUpdatedAt?: string;
  notes?: string;
}

export interface LiftPlan {
  exerciseId: string;
  scheme: string;
  weekWeightsKg: number[];
}

export interface TrainingBlock {
  id: string;
  name: string;
  startDate: string;
  weeks: number;
  liftPlans: LiftPlan[];
}

export type ScoreType = 'time' | 'rounds+reps' | 'worst-round-time' | 'max-reps' | 'load';
export type SkillMetric = 'total' | 'max-unbroken' | 'practice-minutes';

// ---- Planned (prescribed) sessions: what the calendar shows before you train ----

export type PlannedItem =
  | {
      kind: 'strength';
      exerciseId: string;
      sets: number;
      reps: number;
      weightKg?: number;
      note?: string;
    }
  | {
      kind: 'metcon';
      name: string;
      scoreType: ScoreType;
      description?: string;
    }
  | {
      kind: 'skill';
      exerciseId: string;
      metric: SkillMetric;
      target?: number;
      description?: string;
    };

export interface PlannedSession {
  id: string;
  date: string;
  blockId?: string;
  title: string;
  items: PlannedItem[];
  notes?: string;
}

// ---- Logged workouts ----

export interface StrengthSet {
  reps: number;
  weightKg: number;
  rir?: number;
  done: boolean;
}

export interface StrengthEntry {
  kind: 'strength';
  exerciseId: string;
  sets: StrengthSet[];
}

export interface MetconEntry {
  kind: 'metcon';
  name: string;
  scoreType: ScoreType;
  score: string;
  scoreSeconds?: number;
  rx: boolean;
  scalingNotes?: string;
  description?: string;
}

export interface SkillEntry {
  kind: 'skill';
  exerciseId: string;
  metric: SkillMetric;
  value: number;
  target?: number;
}

export type WorkoutEntry = StrengthEntry | MetconEntry | SkillEntry;

export interface Workout {
  id: string;
  date: string;
  blockId?: string;
  planId?: string;
  title: string;
  entries: WorkoutEntry[];
  bodyFeel?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  /** Derived on save: normalised metcon names, indexed for "last time" lookups. */
  metconNames: string[];
}

export interface BodyweightEntry {
  id: string;
  date: string;
  weightKg: number;
}

export const SCORE_TYPES: { value: ScoreType; label: string }[] = [
  { value: 'time', label: 'Time' },
  { value: 'rounds+reps', label: 'Rounds + reps' },
  { value: 'worst-round-time', label: 'Worst round time' },
  { value: 'max-reps', label: 'Max reps' },
  { value: 'load', label: 'Load' },
];

export const SKILL_METRICS: { value: SkillMetric; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'max-unbroken', label: 'Max unbroken' },
  { value: 'practice-minutes', label: 'Practice minutes' },
];

export const CATEGORIES: ExerciseCategory[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'gymnastics',
  'cardio',
  'skill',
];

export const UNITS: ExerciseUnit[] = ['kg', 'reps', 'seconds', 'calories', 'meters'];
