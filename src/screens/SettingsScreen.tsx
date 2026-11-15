import { useState } from 'react';
import { db } from '../db';
import { todayISO } from '../lib/dates';
import { formatKg } from '../lib/summary';
import { useExercises } from '../lib/useExercises';
import { CATEGORIES, UNITS, type Exercise } from '../types';

const blank = (): Exercise => ({ id: '', name: '', category: 'barbell', unit: 'kg' });

export default function SettingsScreen() {
  const { list: exercises } = useExercises();
  const [draft, setDraft] = useState<Exercise | null>(null);
  const [maxText, setMaxText] = useState('');
  const [error, setError] = useState('');

  const edit = (e: Exercise) => {
    setDraft(e);
    setMaxText(e.oneRepMax ? String(e.oneRepMax) : '');
    setError('');
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setError('Give the exercise a name.');
    if (exercises.some((e) => e.id !== draft.id && e.name.toLowerCase() === name.toLowerCase()))
      return setError('An exercise with this name already exists.');
    const max = maxText.trim() ? Number(maxText.replace(',', '.')) : undefined;
    if (max !== undefined && (!Number.isFinite(max) || max <= 0)) return setError('1RM must be a number in kg.');

    const { oneRepMax: _m, oneRepMaxUpdatedAt: _u, ...rest } = draft;
    const previous = exercises.find((e) => e.id === draft.id);
    await db.exercises.put({
      ...rest,
      id: draft.id || crypto.randomUUID(),
      name,
      notes: draft.notes?.trim() || undefined,
      ...(max !== undefined
        ? {
            oneRepMax: max,
            oneRepMaxUpdatedAt:
              previous?.oneRepMax === max ? (previous.oneRepMaxUpdatedAt ?? todayISO()) : todayISO(),
          }
        : {}),
    });
    setDraft(null);
  };

  if (draft)
    return (
      <>
        <h1 className="title">{draft.id ? 'Edit exercise' : 'New exercise'}</h1>
        <div className="card">
          <label className="field">
            Name
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <div className="row">
            <label className="field grow">
              Category
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as Exercise['category'] })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field grow">
              Unit
              <select
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value as Exercise['unit'] })}
              >
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            1RM in kg (leave empty if unknown)
            <input inputMode="decimal" value={maxText} onChange={(e) => setMaxText(e.target.value)} />
          </label>
          <label className="field">
            Notes
            <input
              value={draft.notes ?? ''}
              placeholder="scaled: banded"
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="btn grow" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="btn primary grow" onClick={save}>
              Save
            </button>
          </div>
        </div>
      </>
    );

  return (
    <>
      <h1 className="title">Settings</h1>
      <div className="row between">
        <h2>Exercise library</h2>
        <button className="btn primary" onClick={() => edit(blank())}>
          + Exercise
        </button>
      </div>
      <p className="muted small">Tap an exercise to edit it or set its 1RM. Weights are in kg.</p>
      {CATEGORIES.map((cat) => {
        const items = exercises.filter((e) => e.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat} className="card">
            <span className="muted small">{cat.toUpperCase()}</span>
            {items.map((e) => (
              <button key={e.id} className="btn ghost list-line" onClick={() => edit(e)}>
                <span>{e.name}</span>
                <span className="detail">{e.oneRepMax ? `1RM ${formatKg(e.oneRepMax)}` : e.unit}</span>
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}
