import { describe, expect, it } from 'vitest';
import { addDays, addMonths, blockWeek, isISODate, monthGrid, startOfWeek, weekDays } from './dates';
import { normalizeName, parseTimeToSeconds } from './score';
import { parsePlanText, planExerciseNames } from './plan';
import { summarizeSets } from './summary';
import { backupDue, parseBackup } from './backup';
import {
  bestWeightElsewhere,
  epley,
  formatSeconds,
  liftHistory,
  liftRecords,
  metconSeries,
  niceTicks,
  previousLift,
  weekStreak,
  weeklySessions,
} from './stats';
import type { Workout } from '../types';

describe('dates', () => {
  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09'); // Sunday
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16'); // Monday
    expect(weekDays('2026-11-18')).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
    ]);
  });

  it('crosses month, year and DST boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 7)).toBe('2026-11-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('builds a six-week month grid that contains the month', () => {
    const grid = monthGrid('2026-11-16');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-10-26');
    expect(grid).toContain('2026-11-01');
    expect(grid).toContain('2026-11-30');
  });

  it('finds the block week', () => {
    expect(blockWeek('2026-11-09', 4, '2026-11-08')).toBeNull();
    expect(blockWeek('2026-11-09', 4, '2026-11-09')).toBe(1);
    expect(blockWeek('2026-11-09', 4, '2026-11-16')).toBe(2);
    expect(blockWeek('2026-11-09', 4, '2026-12-06')).toBe(4);
    expect(blockWeek('2026-11-09', 4, '2026-12-07')).toBeNull();
  });

  it('rejects dates that do not exist', () => {
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('16/11/2026')).toBe(false);
    expect(isISODate('2026-11-16')).toBe(true);
  });
});

describe('score', () => {
  it('parses times', () => {
    expect(parseTimeToSeconds('9:45')).toBe(585);
    expect(parseTimeToSeconds('2:05')).toBe(125);
    expect(parseTimeToSeconds('1:02:03')).toBe(3723);
    expect(parseTimeToSeconds('5+12')).toBeUndefined();
    expect(parseTimeToSeconds('9:75')).toBeUndefined();
  });

  it('normalises metcon names', () => {
    expect(normalizeName('  Metcon   B ')).toBe('metcon b');
  });
});

describe('plan parsing', () => {
  const good = `Here you go:
\`\`\`json
{ "sessions": [
  { "date": "2026-11-16", "title": "Squat day", "items": [
    { "kind": "strength", "exercise": "Back Squat", "sets": 5, "reps": 5, "weightKg": 80 },
    { "kind": "metcon", "name": "Metcon B", "description": "5 rounds" },
    { "kind": "skill", "exercise": "Handstand Hold", "target": 60 }
  ] }
] }
\`\`\``;

  it('reads a fenced plan and applies defaults', () => {
    const r = parsePlanText(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sessions).toHaveLength(1);
    expect(r.sessions[0].items[1]).toMatchObject({ kind: 'metcon', scoreType: 'time' });
    expect(r.sessions[0].items[2]).toMatchObject({ kind: 'skill', metric: 'total', target: 60 });
    expect(planExerciseNames(r.sessions)).toEqual(['Back Squat', 'Handstand Hold']);
  });

  it('accepts a bare list of sessions', () => {
    const r = parsePlanText('[{"date":"2026-11-17","items":[{"kind":"metcon","name":"Fran"}]}]');
    expect(r.ok && r.sessions[0].title).toBe('Workout');
  });

  it('explains what is wrong', () => {
    const bad = (t: string) => {
      const r = parsePlanText(t);
      return r.ok ? '' : r.error;
    };
    expect(bad('hello')).toMatch(/No JSON/);
    expect(bad('{ "sessions": [ }')).toMatch(/not valid JSON/);
    expect(bad('{"sessions":[]}')).toMatch(/at least one session/);
    expect(bad('{"sessions":[{"date":"2026-02-30","items":[{"kind":"metcon","name":"x"}]}]}')).toMatch(/date/);
    expect(
      bad('{"sessions":[{"date":"2026-11-16","items":[{"kind":"strength","exercise":"Squat","sets":0,"reps":5}]}]}'),
    ).toMatch(/sets/);
    expect(
      bad('{"sessions":[{"date":"2026-11-16","items":[{"kind":"metcon","name":"x","scoreType":"fast"}]}]}'),
    ).toMatch(/scoreType/);
  });
});

describe('set summary', () => {
  it('collapses matching sets and counts only done ones', () => {
    const set = (weightKg: number, reps: number, done = true) => ({ weightKg, reps, done });
    expect(summarizeSets(Array.from({ length: 5 }, () => set(80, 5)))).toBe('5×5 @ 80 kg');
    expect(summarizeSets([set(60, 5), set(70, 3), set(80, 1)])).toBe('3 sets, top 80 kg × 1');
    expect(summarizeSets([set(85, 5), set(85, 5, false)])).toBe('1×5 @ 85 kg (1 of 2 sets)');
    expect(summarizeSets([set(85, 5, false)])).toBe('0 of 1 sets done');
  });
});

describe('backup', () => {
  const file = (data: object, extra: object = {}) =>
    JSON.stringify({ app: 'chalk', version: 1, exportedAt: '2026-11-16T10:00:00.000Z', data, ...extra });
  const empty = { exercises: [], blocks: [], plans: [], workouts: [], bodyweight: [] };

  it('reads a valid backup and rebuilds metcon names', () => {
    const r = parseBackup(
      file({
        ...empty,
        exercises: [{ id: 'e1', name: 'Back Squat', category: 'barbell', unit: 'kg' }],
        workouts: [
          {
            id: 'w1',
            date: '2026-11-16',
            title: 'Test',
            metconNames: ['wrong'],
            entries: [
              { kind: 'strength', exerciseId: 'e1', sets: [{ reps: 5, weightKg: 80, done: true }] },
              { kind: 'metcon', name: ' Fran ', scoreType: 'time', score: '4:30', rx: true },
            ],
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.data.exercises).toHaveLength(1);
    expect(r.file.data.workouts[0].metconNames).toEqual(['fran']);
  });

  it('rejects files that are not usable backups', () => {
    const bad = (t: string) => {
      const r = parseBackup(t);
      return r.ok ? '' : r.error;
    };
    expect(bad('nope')).toMatch(/not valid JSON/);
    expect(bad('{"sessions":[]}')).toMatch(/not a Chalk backup/);
    expect(bad(file(empty, { version: 2 }))).toMatch(/newer version/);
    expect(bad(file({ ...empty, workouts: undefined }))).toMatch(/no "workouts" list/);
    expect(bad(file({ ...empty, workouts: [{ id: 'w', date: 'yesterday', entries: [] }] }))).toMatch(/workouts item 1/);
    expect(
      bad(file({ ...empty, workouts: [{ id: 'w', date: '2026-11-16', entries: [{ kind: 'strength' }] }] })),
    ).toMatch(/workouts item 1/);
    expect(bad(file({ ...empty, exercises: [{ name: 'No id' }] }))).toMatch(/exercises item 1/);
  });

  it('reminds after 30 days, counting from the last export or first use', () => {
    const base = { today: '2026-12-20', hasData: true };
    expect(backupDue({ ...base, firstUse: '2026-11-16' })).toBe(true);
    expect(backupDue({ ...base, firstUse: '2026-11-25' })).toBe(false);
    expect(backupDue({ ...base, firstUse: '2026-11-16', lastExport: '2026-12-01' })).toBe(false);
    expect(backupDue({ ...base, firstUse: '2026-11-16', hasData: false })).toBe(false);
    expect(backupDue({ ...base, firstUse: '2026-11-16', snoozedOn: '2026-12-18' })).toBe(false);
    expect(backupDue({ ...base, firstUse: '2026-11-16', snoozedOn: '2026-12-13' })).toBe(true);
  });
});

describe('stats', () => {
  const set = (weightKg: number, reps: number, done = true) => ({ weightKg, reps, done });
  const lift = (id: string, date: string, sets: ReturnType<typeof set>[]): Workout => ({
    id,
    date,
    title: 'x',
    metconNames: [],
    entries: [{ kind: 'strength', exerciseId: 'sq', sets }],
  });
  const metcon = (id: string, date: string, score: string, scoreSeconds?: number): Workout => ({
    id,
    date,
    title: 'x',
    metconNames: ['fran'],
    entries: [{ kind: 'metcon', name: 'Fran', scoreType: 'time', score, scoreSeconds, rx: true }],
  });
  const log = [
    lift('a', '2026-11-02', [set(80, 5), set(80, 5), set(90, 5, false)]),
    lift('b', '2026-11-09', [set(85, 5), set(100, 1)]),
    lift('c', '2026-11-16', [set(90, 3)]),
  ];

  it('estimates 1RM with Epley and leaves singles alone', () => {
    expect(epley(100, 1)).toBe(100);
    expect(epley(90, 5)).toBeCloseTo(105);
  });

  it('builds lift history from completed sets only', () => {
    const h = liftHistory(log, 'sq');
    expect(h.map((s) => s.date)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(h[0].top.weightKg).toBe(80); // the 90 was not completed
    expect(h[0].e1rm).toBe(93.3);
    expect(h[1].top.weightKg).toBe(100);
    expect(liftHistory(log, 'other')).toEqual([]);
  });

  it('finds the previous session and records', () => {
    expect(previousLift(log, 'sq', '2026-11-16', 'c')?.date).toBe('2026-11-09');
    expect(previousLift(log, 'sq', '2026-11-02', 'a')).toBeUndefined();
    expect(bestWeightElsewhere(log, 'sq', 'b')).toBe(90);
    expect(bestWeightElsewhere(log, 'sq', 'c')).toBe(100);
    const [r] = liftRecords(log);
    expect(r.heaviest).toEqual({ weightKg: 100, reps: 1, date: '2026-11-09' });
    expect(r.bestE1rm).toEqual({ value: 100, date: '2026-11-09' });
  });

  it('groups metcons by name in date order', () => {
    const [m] = metconSeries([metcon('y', '2026-11-10', '4:10', 250), metcon('x', '2026-10-01', '4:30', 270)]);
    expect(m.results.map((r) => r.score)).toEqual(['4:30', '4:10']);
  });

  it('counts sessions per week and the streak', () => {
    const weeks = weeklySessions(log, '2026-11-18', 4);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
    expect(weeks.map((w) => w.count)).toEqual([0, 1, 1, 1]);
    expect(weekStreak(log, '2026-11-18')).toBe(3);
    expect(weekStreak(log, '2026-11-25')).toBe(3); // an empty current week does not break it
    expect(weekStreak(log, '2026-12-02')).toBe(0);
  });

  it('picks round axis ticks and formats times', () => {
    expect(niceTicks(0, 3, 3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(93.3, 105, 3)).toEqual([90, 95, 100, 105]);
    expect(niceTicks(50, 50, 3).length).toBeGreaterThan(1);
    expect(formatSeconds(104)).toBe('1:44');
    expect(formatSeconds(59.6)).toBe('1:00');
  });
});
