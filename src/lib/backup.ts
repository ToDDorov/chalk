import type { BodyweightEntry, Exercise, PlannedSession, TrainingBlock, Workout } from '../types';
import { daysBetween, isISODate } from './dates';
import { normalizeName } from './score';

export interface BackupData {
  exercises: Exercise[];
  blocks: TrainingBlock[];
  plans: PlannedSession[];
  workouts: Workout[];
  bodyweight: BodyweightEntry[];
}

export interface BackupFile {
  app: 'chalk';
  version: 1;
  exportedAt: string;
  data: BackupData;
}

export type BackupResult = { ok: true; file: BackupFile } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const hasId = (v: unknown): v is Record<string, unknown> => isObj(v) && typeof v.id === 'string' && v.id !== '';

const ENTRY_KINDS = ['strength', 'metcon', 'skill'];

const checkList = (data: Record<string, unknown>, key: keyof BackupData, check: (row: Record<string, unknown>) => boolean) => {
  const list = data[key];
  if (!Array.isArray(list)) throw new Error(`The backup has no "${key}" list.`);
  list.forEach((row, i) => {
    if (!hasId(row) || !check(row)) throw new Error(`The backup is damaged: ${key} item ${i + 1} is not valid.`);
  });
  return list;
};

/** Checks a backup file's text and returns its contents, or says what is wrong. */
export const parseBackup = (text: string): BackupResult => {
  try {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('This file is not valid JSON.');
    }
    if (!isObj(json) || json.app !== 'chalk' || !isObj(json.data))
      throw new Error('This is not a Chalk backup file.');
    if (json.version !== 1)
      throw new Error('This backup was made by a newer version of Chalk. Update the app first.');
    const d = json.data;

    const exercises = checkList(d, 'exercises', (r) => typeof r.name === 'string') as Exercise[];
    const blocks = checkList(
      d,
      'blocks',
      (r) => typeof r.name === 'string' && isISODate(r.startDate) && Array.isArray(r.liftPlans),
    ) as TrainingBlock[];
    const plans = checkList(
      d,
      'plans',
      (r) =>
        isISODate(r.date) &&
        Array.isArray(r.items) &&
        r.items.every((it) => isObj(it) && ENTRY_KINDS.includes(it.kind as string)),
    ) as PlannedSession[];
    const workouts = (
      checkList(
        d,
        'workouts',
        (r) =>
          isISODate(r.date) &&
          Array.isArray(r.entries) &&
          r.entries.every(
            (e) =>
              isObj(e) &&
              ENTRY_KINDS.includes(e.kind as string) &&
              (e.kind !== 'strength' || Array.isArray(e.sets)) &&
              (e.kind !== 'metcon' || (typeof e.name === 'string' && typeof e.score === 'string')),
          ),
      ) as Workout[]
    ).map((w) => ({
      ...w,
      title: typeof w.title === 'string' ? w.title : 'Workout',
      // Rebuilt, so "last time" lookups never depend on what the file claims.
      metconNames: [
        ...new Set(w.entries.flatMap((e) => (e.kind === 'metcon' && e.name.trim() ? [normalizeName(e.name)] : []))),
      ],
    }));
    const bodyweight = checkList(
      d,
      'bodyweight',
      (r) => isISODate(r.date) && typeof r.weightKg === 'number',
    ) as BodyweightEntry[];

    return {
      ok: true,
      file: {
        app: 'chalk',
        version: 1,
        exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : '',
        data: { exercises, blocks, plans, workouts, bodyweight },
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not read the backup.' };
  }
};

export const REMIND_AFTER_DAYS = 30;
export const SNOOZE_DAYS = 7;

/**
 * Whether to nag about backing up. The clock starts at the last export, or at
 * first use when there has never been one.
 */
export const backupDue = (opts: {
  today: string;
  firstUse?: string;
  lastExport?: string;
  snoozedOn?: string;
  hasData: boolean;
}) => {
  if (!opts.hasData) return false;
  const since = opts.lastExport ?? opts.firstUse;
  if (!since || daysBetween(since, opts.today) < REMIND_AFTER_DAYS) return false;
  return !opts.snoozedOn || daysBetween(opts.snoozedOn, opts.today) >= SNOOZE_DAYS;
};

// Small settings live in localStorage, which can be unavailable; never let that break the app.
const KEY = { firstUse: 'chalk.firstUse', lastExport: 'chalk.lastExport', snoozedOn: 'chalk.backupSnoozedOn' };
export type BackupKey = keyof typeof KEY;

export const readDate = (key: BackupKey) => {
  try {
    const v = localStorage.getItem(KEY[key]);
    return isISODate(v) ? v : undefined;
  } catch {
    return undefined;
  }
};

export const writeDate = (key: BackupKey, iso: string) => {
  try {
    localStorage.setItem(KEY[key], iso);
  } catch {
    /* ignore */
  }
};
