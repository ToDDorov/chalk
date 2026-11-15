import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Calendar, { type DayMark } from '../components/Calendar';
import { db, startBlankWorkout, startPlannedWorkout } from '../db';
import {
  addDays,
  addMonths,
  blockWeek,
  formatLongDay,
  formatMonth,
  isISODate,
  monthGrid,
  todayISO,
  weekDays,
} from '../lib/dates';
import { backupDue, readDate, writeDate } from '../lib/backup';
import { summarizeEntry, summarizePlanned } from '../lib/summary';
import { useExercises } from '../lib/useExercises';
import type { PlannedSession } from '../types';

export default function WeekScreen() {
  const navigate = useNavigate();
  const today = todayISO();
  const [params, setParams] = useSearchParams();
  const paramDay = params.get('d');
  const selected = isISODate(paramDay) ? paramDay : today;
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const { map } = useExercises();

  const select = (iso: string) => setParams(iso === today ? {} : { d: iso }, { replace: true });

  const days = mode === 'week' ? weekDays(selected) : monthGrid(selected);
  const from = days[0];
  const to = days[days.length - 1];

  const plans = useLiveQuery(() => db.plans.where('date').between(from, to, true, true).toArray(), [from, to]);
  const workouts = useLiveQuery(
    () => db.workouts.where('date').between(from, to, true, true).toArray(),
    [from, to],
  );
  const blocks = useLiveQuery(() => db.blocks.toArray(), []);
  const workoutCount = useLiveQuery(() => db.workouts.count(), []);
  const [snoozedOn, setSnoozedOn] = useState(() => readDate('snoozedOn'));
  const remindBackup = backupDue({
    today,
    firstUse: readDate('firstUse'),
    lastExport: readDate('lastExport'),
    snoozedOn,
    hasData: (workoutCount ?? 0) > 0,
  });

  const { marks, plannedCount, doneCount } = useMemo(() => {
    const marks = new Map<string, DayMark>();
    const donePlanIds = new Set((workouts ?? []).map((w) => w.planId).filter(Boolean));
    for (const p of plans ?? []) {
      if (donePlanIds.has(p.id)) continue;
      // A missed session outranks a still-planned one on the same day.
      if (p.date < today) marks.set(p.date, 'missed');
      else if (!marks.has(p.date)) marks.set(p.date, 'planned');
    }
    for (const w of workouts ?? []) if (!marks.has(w.date)) marks.set(w.date, 'done');

    const week = new Set(weekDays(selected));
    const weekPlans = (plans ?? []).filter((p) => week.has(p.date));
    return {
      marks,
      plannedCount: weekPlans.length,
      doneCount: weekPlans.filter((p) => donePlanIds.has(p.id)).length,
    };
  }, [plans, workouts, today, selected]);

  const block = blocks?.find((b) => blockWeek(b.startDate, b.weeks, selected) !== null);
  const dayPlans = (plans ?? []).filter((p) => p.date === selected);
  const dayWorkouts = (workouts ?? []).filter((w) => w.date === selected);
  const openPlans = dayPlans.filter((p) => !dayWorkouts.some((w) => w.planId === p.id));
  const extraThisWeek = (workouts ?? []).filter(
    (w) => !w.planId && weekDays(selected).includes(w.date),
  ).length;

  const start = async (plan: PlannedSession) => navigate(`/workout/${await startPlannedWorkout(plan)}`);
  const logBlank = async () => navigate(`/workout/${await startBlankWorkout(selected)}`);
  const step = (dir: 1 | -1) => select(mode === 'week' ? addDays(selected, 7 * dir) : addMonths(selected, dir));

  return (
    <>
      {remindBackup && (
        <div className="card">
          <p>It has been a while since your last backup. Your log exists only on this device.</p>
          <div className="row">
            <button
              className="btn grow"
              onClick={() => {
                writeDate('snoozedOn', today);
                setSnoozedOn(today);
              }}
            >
              Later
            </button>
            <button className="btn primary grow" onClick={() => navigate('/settings')}>
              Back up now
            </button>
          </div>
        </div>
      )}

      <div className="cal-head">
        <button
          className="cal-month"
          onClick={() => setMode(mode === 'week' ? 'month' : 'week')}
          aria-expanded={mode === 'month'}
        >
          {formatMonth(selected)}
          <span>{mode === 'week' ? '▾ month' : '▴ week'}</span>
        </button>
        {selected !== today && (
          <button className="btn" onClick={() => select(today)}>
            Today
          </button>
        )}
        <button className="icon-btn" onClick={() => step(-1)} aria-label={`Previous ${mode}`}>
          ‹
        </button>
        <button className="icon-btn" onClick={() => step(1)} aria-label={`Next ${mode}`}>
          ›
        </button>
      </div>

      <Calendar
        mode={mode}
        anchor={selected}
        selected={selected}
        today={today}
        marks={marks}
        onSelect={(iso) => {
          select(iso);
          setMode('week');
        }}
        onStep={step}
      />

      <p className="muted small">
        {block && `${block.name} · week ${blockWeek(block.startDate, block.weeks, selected)} of ${block.weeks} · `}
        {plannedCount > 0
          ? `${doneCount} of ${plannedCount} planned sessions done this week`
          : 'Nothing planned this week'}
        {extraThisWeek > 0 && ` · ${extraThisWeek} extra logged`}
      </p>

      <h2 className="title">{selected === today ? 'Today' : formatLongDay(selected)}</h2>

      {dayWorkouts.map((w) => (
        <button key={w.id} className="card" onClick={() => navigate(`/workout/${w.id}`)}>
          <div className="row between">
            <h3>{w.title}</h3>
            <span className="pill done">Logged</span>
          </div>
          {w.entries.map((e, i) => {
            const s = summarizeEntry(e, map);
            return (
              <div key={i} className="list-line">
                <span>{s.title}</span>
                <span className="detail">{s.detail}</span>
              </div>
            );
          })}
          {w.entries.length === 0 && <p className="muted small">Empty. Tap to add entries.</p>}
        </button>
      ))}

      {openPlans.map((p) => (
        <div key={p.id} className="card">
          <div className="row between">
            <h3>{p.title}</h3>
            <span className={`pill ${p.date < today ? 'missed' : 'planned'}`}>
              {p.date < today ? 'Missed' : 'Planned'}
            </span>
          </div>
          {p.items.map((it, i) => {
            const s = summarizePlanned(it, map);
            return (
              <div key={i}>
                <div>{s.title}</div>
                <div className="muted small pre">{s.detail}</div>
              </div>
            );
          })}
          {p.notes && <p className="muted small pre">{p.notes}</p>}
          <button className="btn primary block" onClick={() => start(p)}>
            {p.date < today ? 'Log this session' : 'Start session'}
          </button>
        </div>
      ))}

      {dayPlans.length === 0 && dayWorkouts.length === 0 && (
        <p className="muted">
          {selected > today ? 'Nothing planned for this day.' : 'Rest day. Nothing planned or logged.'}
        </p>
      )}

      <button className={`btn block ${openPlans.length ? 'ghost' : 'primary'}`} onClick={logBlank}>
        {openPlans.length || dayWorkouts.length ? 'Log another workout' : 'Log workout'}
      </button>
      {dayPlans.length === 0 && selected >= today && (
        <button className="btn ghost block" onClick={() => navigate('/plan')}>
          Paste a plan
        </button>
      )}
    </>
  );
}
