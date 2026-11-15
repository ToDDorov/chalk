import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, LineChart } from '../components/Charts';
import { db } from '../db';
import { formatShortDate, parseISODate, todayISO } from '../lib/dates';
import { isTimeScore } from '../lib/score';
import {
  formatSeconds,
  liftHistory,
  liftRecords,
  metconSeries,
  skillSeries,
  weekStreak,
  weeklySessions,
} from '../lib/stats';
import { exerciseName, formatKg, metricLabel, scoreTypeLabel } from '../lib/summary';
import { useExercises } from '../lib/useExercises';
import type { ScoreType } from '../types';

const kg = (n: number) => `${Number(n.toFixed(1))} kg`;
const plain = (n: number) => String(Number(n.toFixed(1)));

export default function ProgressScreen() {
  const today = todayISO();
  const { map } = useExercises();
  const workouts = useLiveQuery(() => db.workouts.toArray(), []);
  const [liftId, setLiftId] = useState('');
  const [liftMetric, setLiftMetric] = useState<'e1rm' | 'top'>('e1rm');
  const [openMetcon, setOpenMetcon] = useState('');
  const [openSkill, setOpenSkill] = useState('');

  const stats = useMemo(() => {
    const all = workouts ?? [];
    const weeks = weeklySessions(all, today, 8);
    return {
      weeks,
      streak: weekStreak(all, today),
      records: liftRecords(all).sort((a, b) => b.lastDate.localeCompare(a.lastDate)),
      metcons: metconSeries(all),
      skills: skillSeries(all),
    };
  }, [workouts, today]);

  if (!workouts) return null;

  const { weeks, streak, records, metcons, skills } = stats;
  const last4 = weeks.slice(-4).reduce((sum, w) => sum + w.count, 0);
  const activeLift = records.find((r) => r.exerciseId === liftId) ?? records[0];
  const history = activeLift ? liftHistory(workouts, activeLift.exerciseId) : [];

  return (
    <>
      <h1 className="title">Progress</h1>

      <div className="tiles">
        <div className="tile">
          <div className="value">{weeks[weeks.length - 1].count}</div>
          <div className="label">Sessions this week</div>
        </div>
        <div className="tile">
          <div className="value">{last4}</div>
          <div className="label">Last 4 weeks</div>
        </div>
        <div className="tile">
          <div className="value">{streak}</div>
          <div className="label">Week streak</div>
        </div>
      </div>

      <div className="card">
        <h3>Sessions per week</h3>
        <BarChart
          label="Sessions per week"
          unit={(n) => `${n} session${n === 1 ? '' : 's'}`}
          data={weeks.map((w, i) => ({
            key: w.weekStart,
            // Label every other week so the dates never crowd each other.
            tick:
              (weeks.length - 1 - i) % 2 === 0
                ? parseISODate(w.weekStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
                : '',
            name: i === weeks.length - 1 ? 'this week' : `week of ${formatShortDate(w.weekStart)}`,
            value: w.count,
          }))}
        />
      </div>

      <div className="card">
        <h3>Lifts</h3>
        {!activeLift ? (
          <p className="muted">Complete a set in a strength entry and your lifts show up here.</p>
        ) : (
          <>
            <label className="field">
              Lift
              <select value={activeLift.exerciseId} onChange={(e) => setLiftId(e.target.value)}>
                {records.map((r) => (
                  <option key={r.exerciseId} value={r.exerciseId}>
                    {exerciseName(map, r.exerciseId)}
                  </option>
                ))}
              </select>
            </label>
            <div className="seg" role="group" aria-label="Chart measure">
              <button className={liftMetric === 'e1rm' ? 'on' : ''} aria-pressed={liftMetric === 'e1rm'} onClick={() => setLiftMetric('e1rm')}>
                Estimated 1RM
              </button>
              <button className={liftMetric === 'top' ? 'on' : ''} aria-pressed={liftMetric === 'top'} onClick={() => setLiftMetric('top')}>
                Top set
              </button>
            </div>
            <LineChart
              label={`${exerciseName(map, activeLift.exerciseId)} ${liftMetric === 'e1rm' ? 'estimated 1RM' : 'top set'}`}
              format={kg}
              points={history.map((h) => ({ date: h.date, value: liftMetric === 'e1rm' ? h.e1rm : h.top.weightKg }))}
            />
            <div className="list-line">
              <span>Heaviest set</span>
              <span className="detail">
                {formatKg(activeLift.heaviest.weightKg)} × {activeLift.heaviest.reps} ·{' '}
                {formatShortDate(activeLift.heaviest.date)}
              </span>
            </div>
            <div className="list-line">
              <span>Best est. 1RM</span>
              <span className="detail">
                {kg(activeLift.bestE1rm.value)} · {formatShortDate(activeLift.bestE1rm.date)}
              </span>
            </div>
            {map.get(activeLift.exerciseId)?.oneRepMax && (
              <div className="list-line">
                <span>Your set 1RM</span>
                <span className="detail">{formatKg(map.get(activeLift.exerciseId)!.oneRepMax!)}</span>
              </div>
            )}
            <p className="muted small">
              Estimated 1RM uses the Epley formula on your best completed set of each session.
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h3>Benchmarks</h3>
        {metcons.length === 0 && <p className="muted">Scored metcons show up here, grouped by name.</p>}
        {metcons.map((m) => {
          const latest = m.results[m.results.length - 1];
          const prev = m.results[m.results.length - 2];
          const timed =
            isTimeScore(m.scoreType as ScoreType) && m.results.every((r) => r.scoreSeconds !== undefined);
          const delta =
            timed && prev ? (latest.scoreSeconds as number) - (prev.scoreSeconds as number) : undefined;
          const isOpen = openMetcon === m.key;
          return (
            <div key={m.key}>
              <button className="record" aria-expanded={isOpen} onClick={() => setOpenMetcon(isOpen ? '' : m.key)}>
                <span>{m.name}</span>
                <span className="big">{latest.score}</span>
                <span className="sub">
                  {scoreTypeLabel(m.scoreType)} · {m.results.length} result{m.results.length === 1 ? '' : 's'} ·{' '}
                  {formatShortDate(latest.date)}
                  {delta !== undefined && delta !== 0 && (
                    <span className={delta < 0 ? 'delta-good' : 'delta-bad'}>
                      {' '}
                      · {delta < 0 ? '▼' : '▲'} {formatSeconds(Math.abs(delta))} {delta < 0 ? 'faster' : 'slower'}
                    </span>
                  )}
                </span>
              </button>
              {isOpen && (
                <>
                  {timed && m.results.length > 1 && (
                    <LineChart
                      label={`${m.name} time`}
                      format={formatSeconds}
                      points={m.results.map((r) => ({ date: r.date, value: r.scoreSeconds as number }))}
                    />
                  )}
                  {[...m.results].reverse().map((r, i) => (
                    <div key={i} className="list-line">
                      <span className="muted">{formatShortDate(r.date)}</span>
                      <span className="detail">
                        {r.score} · {r.rx ? 'Rx' : 'scaled'}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>Skills</h3>
        {skills.length === 0 && <p className="muted">Logged skill work shows up here.</p>}
        {skills.map((s) => {
          const key = `${s.exerciseId}|${s.metric}`;
          const latest = s.results[s.results.length - 1];
          const isOpen = openSkill === key;
          return (
            <div key={key}>
              <button className="record" aria-expanded={isOpen} onClick={() => setOpenSkill(isOpen ? '' : key)}>
                <span>{exerciseName(map, s.exerciseId)}</span>
                <span className="big">{plain(latest.value)}</span>
                <span className="sub">
                  {metricLabel(s.metric)} · best {plain(s.best)} · {formatShortDate(latest.date)}
                </span>
              </button>
              {isOpen && (
                <>
                  {s.results.length > 1 && (
                    <LineChart
                      label={`${exerciseName(map, s.exerciseId)} ${metricLabel(s.metric)}`}
                      format={plain}
                      points={s.results}
                    />
                  )}
                  {[...s.results].reverse().map((r, i) => (
                    <div key={i} className="list-line">
                      <span className="muted">{formatShortDate(r.date)}</span>
                      <span className="detail">{plain(r.value)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
