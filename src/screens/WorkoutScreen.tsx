import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Stepper from '../components/Stepper';
import { db, previousMetcon, saveWorkout } from '../db';
import { formatShortDate, isISODate } from '../lib/dates';
import { scorePlaceholder } from '../lib/score';
import { formatKg } from '../lib/summary';
import { useExercises } from '../lib/useExercises';
import {
  SCORE_TYPES,
  SKILL_METRICS,
  type Exercise,
  type MetconEntry,
  type SkillEntry,
  type StrengthEntry,
  type Workout,
  type WorkoutEntry,
} from '../types';

type Patch<T> = (next: T) => void;

export default function WorkoutScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { list: exercises } = useExercises();
  // The editor owns the state and writes every change straight through to
  // IndexedDB, so nothing is lost if the phone locks mid-session.
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    db.workouts.get(id).then((w) => live && setWorkout(w ?? null));
    return () => {
      live = false;
    };
  }, [id]);

  if (workout === undefined) return null;
  if (workout === null)
    return (
      <>
        <p className="muted">This workout no longer exists.</p>
        <button className="btn" onClick={() => navigate('/')}>
          Back to week
        </button>
      </>
    );

  const update = (patch: Partial<Workout>) => {
    const next = { ...workout, ...patch };
    setWorkout(next);
    void saveWorkout(next);
  };
  const setEntry = (i: number, e: WorkoutEntry) =>
    update({ entries: workout.entries.map((old, j) => (j === i ? e : old)) });
  const removeEntry = (i: number) => update({ entries: workout.entries.filter((_, j) => j !== i) });
  const addEntry = (e: WorkoutEntry) => update({ entries: [...workout.entries, e] });

  const firstOf = (pred: (e: Exercise) => boolean) => (exercises.find(pred) ?? exercises[0])?.id ?? '';
  const back = () => navigate(`/?d=${workout.date}`);

  const remove = async () => {
    if (!confirm('Delete this workout? This cannot be undone.')) return;
    await db.workouts.delete(workout.id);
    back();
  };

  return (
    <>
      <div className="row between">
        <button className="btn ghost" onClick={back}>
          ‹ Week
        </button>
        <span className="muted small">Saved automatically</span>
      </div>

      <div className="card">
        <label className="field">
          Title
          <input value={workout.title} onChange={(e) => update({ title: e.target.value })} />
        </label>
        <label className="field">
          Date · {formatShortDate(workout.date)}
          <input
            type="date"
            value={workout.date}
            onChange={(e) => isISODate(e.target.value) && update({ date: e.target.value })}
          />
        </label>
      </div>

      {workout.entries.map((entry, i) => (
        <div key={i} className="card">
          {entry.kind === 'strength' && (
            <StrengthEditor entry={entry} exercises={exercises} onChange={(e) => setEntry(i, e)} />
          )}
          {entry.kind === 'metcon' && (
            <MetconEditor entry={entry} workout={workout} onChange={(e) => setEntry(i, e)} />
          )}
          {entry.kind === 'skill' && (
            <SkillEditor entry={entry} exercises={exercises} onChange={(e) => setEntry(i, e)} />
          )}
          <button className="btn ghost danger" onClick={() => removeEntry(i)}>
            Remove entry
          </button>
        </div>
      ))}

      <div className="add-row">
        <button
          className="btn"
          onClick={() =>
            addEntry({
              kind: 'strength',
              exerciseId: firstOf((e) => e.category === 'barbell'),
              sets: [{ reps: 5, weightKg: 20, done: true }],
            })
          }
        >
          + Strength
        </button>
        <button
          className="btn"
          onClick={() => addEntry({ kind: 'metcon', name: '', scoreType: 'time', score: '', rx: true })}
        >
          + Metcon
        </button>
        <button
          className="btn"
          onClick={() =>
            addEntry({
              kind: 'skill',
              exerciseId: firstOf((e) => e.category === 'skill' || e.category === 'gymnastics'),
              metric: 'total',
              value: 0,
            })
          }
        >
          + Skill
        </button>
      </div>

      <div className="card">
        <span className="muted small">How did the body feel? (1 flat, 5 great)</span>
        <div className="feel">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              className={workout.bodyFeel === n ? 'on' : ''}
              aria-pressed={workout.bodyFeel === n}
              onClick={() => update({ bodyFeel: workout.bodyFeel === n ? undefined : n })}
            >
              {n}
            </button>
          ))}
        </div>
        <label className="field">
          Notes
          <textarea
            rows={3}
            value={workout.notes ?? ''}
            onChange={(e) => update({ notes: e.target.value || undefined })}
          />
        </label>
      </div>

      <button className="btn primary block" onClick={back}>
        Done
      </button>
      <button className="btn ghost danger block" onClick={remove}>
        Delete workout
      </button>
    </>
  );
}

function ExerciseSelect(props: { value: string; exercises: Exercise[]; onChange: (id: string) => void }) {
  return (
    <label className="field">
      Exercise
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.exercises.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function StrengthEditor(props: { entry: StrengthEntry; exercises: Exercise[]; onChange: Patch<StrengthEntry> }) {
  const { entry, exercises, onChange } = props;
  const [open, setOpen] = useState<number | null>(null);
  const exercise = exercises.find((e) => e.id === entry.exerciseId);
  const weightStep = exercise?.category === 'barbell' ? 2.5 : 1;

  const setSet = (i: number, patch: Partial<StrengthEntry['sets'][number]>) =>
    onChange({ ...entry, sets: entry.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <>
      <ExerciseSelect
        value={entry.exerciseId}
        exercises={exercises}
        onChange={(exerciseId) => onChange({ ...entry, exerciseId })}
      />
      {exercise?.oneRepMax && <span className="muted small">1RM {formatKg(exercise.oneRepMax)}</span>}
      <div>
        {entry.sets.map((s, i) => (
          <div key={i} className={`set-row ${s.done ? 'done' : ''}`}>
            <span className="set-num">{i + 1}</span>
            <button
              className="set-main"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              aria-label={`Edit set ${i + 1}`}
            >
              {formatKg(s.weightKg)} × {s.reps}
              {s.rir !== undefined && <span className="muted small"> · RIR {s.rir}</span>}
            </button>
            <button
              className={`check ${s.done ? 'on' : ''}`}
              onClick={() => setSet(i, { done: !s.done })}
              aria-pressed={s.done}
              aria-label={`Set ${i + 1} done`}
            >
              ✓
            </button>
            {open === i && (
              <div className="set-edit">
                <Stepper label="Weight kg" value={s.weightKg} step={weightStep} onChange={(weightKg) => setSet(i, { weightKg })} />
                <Stepper label="Reps" value={s.reps} step={1} onChange={(reps) => setSet(i, { reps: Math.round(reps) })} />
                <Stepper
                  label="RIR"
                  value={s.rir ?? 0}
                  step={1}
                  onChange={(rir) => setSet(i, { rir: Math.round(rir) })}
                />
                <div className="row">
                  {s.rir !== undefined && (
                    <button className="btn ghost grow" onClick={() => setSet(i, { rir: undefined })}>
                      Clear RIR
                    </button>
                  )}
                  <button
                    className="btn ghost danger grow"
                    onClick={() => {
                      setOpen(null);
                      onChange({ ...entry, sets: entry.sets.filter((_, j) => j !== i) });
                    }}
                  >
                    Remove set
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        className="btn"
        onClick={() => {
          const last = entry.sets[entry.sets.length - 1];
          onChange({
            ...entry,
            sets: [...entry.sets, { reps: last?.reps ?? 5, weightKg: last?.weightKg ?? 20, done: true }],
          });
        }}
      >
        + Set
      </button>
    </>
  );
}

function MetconEditor(props: { entry: MetconEntry; workout: Workout; onChange: Patch<MetconEntry> }) {
  const { entry, workout, onChange } = props;
  const names = useLiveQuery(async () => {
    const seen = new Map<string, string>();
    await db.workouts.each((w) =>
      w.entries.forEach((e) => {
        if (e.kind === 'metcon' && e.name.trim()) seen.set(e.name.trim().toLowerCase(), e.name.trim());
      }),
    );
    return [...seen.values()].sort();
  }, []);
  const last = useLiveQuery(
    () => previousMetcon(entry.name, workout.date, workout.id),
    [entry.name, workout.date, workout.id],
  );
  const listId = `metcons-${workout.id}`;

  return (
    <>
      <label className="field">
        Metcon name
        <input
          value={entry.name}
          list={listId}
          placeholder="Metcon B"
          onChange={(e) => onChange({ ...entry, name: e.target.value })}
        />
        <datalist id={listId}>{names?.map((n) => <option key={n} value={n} />)}</datalist>
      </label>
      {entry.description && <p className="pre">{entry.description}</p>}
      {last && (
        <p className="last-time">
          Last time: {last.score}
          {last.rx ? ' Rx' : ' scaled'} · {formatShortDate(last.date)}
        </p>
      )}
      <div className="row">
        <label className="field grow">
          Score type
          <select
            value={entry.scoreType}
            onChange={(e) => onChange({ ...entry, scoreType: e.target.value as MetconEntry['scoreType'] })}
          >
            {SCORE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field grow">
          Score
          <input
            value={entry.score}
            placeholder={scorePlaceholder(entry.scoreType)}
            onChange={(e) => onChange({ ...entry, score: e.target.value })}
          />
        </label>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={entry.rx} onChange={(e) => onChange({ ...entry, rx: e.target.checked })} />
        Done as prescribed (Rx)
      </label>
      <label className="field">
        Scaling notes
        <input
          value={entry.scalingNotes ?? ''}
          placeholder="singles instead of DU"
          onChange={(e) => onChange({ ...entry, scalingNotes: e.target.value || undefined })}
        />
      </label>
    </>
  );
}

function SkillEditor(props: { entry: SkillEntry; exercises: Exercise[]; onChange: Patch<SkillEntry> }) {
  const { entry, exercises, onChange } = props;
  return (
    <>
      <ExerciseSelect
        value={entry.exerciseId}
        exercises={exercises}
        onChange={(exerciseId) => onChange({ ...entry, exerciseId })}
      />
      <label className="field">
        Measured as
        <select
          value={entry.metric}
          onChange={(e) => onChange({ ...entry, metric: e.target.value as SkillEntry['metric'] })}
        >
          {SKILL_METRICS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {entry.target !== undefined && <span className="muted small">Target {entry.target}</span>}
      <Stepper label="Result" value={entry.value} step={1} onChange={(value) => onChange({ ...entry, value })} />
    </>
  );
}
