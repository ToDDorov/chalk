import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatShortDate } from '../lib/dates';
import { summarizeEntry } from '../lib/summary';
import { useExercises } from '../lib/useExercises';
import { SCORE_TYPES } from '../types';

export default function HistoryScreen() {
  const navigate = useNavigate();
  const { list: exercises, map } = useExercises();
  const [exerciseId, setExerciseId] = useState('');
  const [scoreType, setScoreType] = useState('');
  const [blockId, setBlockId] = useState('');

  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), []);
  const blocks = useLiveQuery(() => db.blocks.toArray(), []);

  const used = new Set(
    (workouts ?? []).flatMap((w) => w.entries.flatMap((e) => (e.kind === 'metcon' ? [] : [e.exerciseId]))),
  );
  const shown = (workouts ?? []).filter(
    (w) =>
      (!blockId || w.blockId === blockId) &&
      (!exerciseId || w.entries.some((e) => e.kind !== 'metcon' && e.exerciseId === exerciseId)) &&
      (!scoreType || w.entries.some((e) => e.kind === 'metcon' && e.scoreType === scoreType)),
  );

  return (
    <>
      <h1 className="title">History</h1>

      <div className="card">
        <label className="field">
          Exercise
          <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            <option value="">All exercises</option>
            {exercises
              .filter((e) => used.has(e.id))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </label>
        <div className="row">
          <label className="field grow">
            Metcon score type
            <select value={scoreType} onChange={(e) => setScoreType(e.target.value)}>
              <option value="">Any</option>
              {SCORE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow">
            Block
            <select value={blockId} onChange={(e) => setBlockId(e.target.value)}>
              <option value="">Any</option>
              {blocks?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {workouts && shown.length === 0 && (
        <p className="muted">
          {workouts.length === 0 ? 'No workouts logged yet.' : 'No workouts match these filters.'}
        </p>
      )}

      {shown.map((w) => (
        <button key={w.id} className="card" onClick={() => navigate(`/workout/${w.id}`)}>
          <div className="row between">
            <h3>{w.title}</h3>
            <span className="muted small">{formatShortDate(w.date)}</span>
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
        </button>
      ))}
    </>
  );
}
