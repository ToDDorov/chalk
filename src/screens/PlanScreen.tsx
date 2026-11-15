import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importPlan } from '../db';
import { formatShortDate, todayISO } from '../lib/dates';
import { buildPlanPrompt, parsePlanText, planExerciseNames } from '../lib/plan';
import { useExercises } from '../lib/useExercises';

export default function PlanScreen() {
  const navigate = useNavigate();
  const { list: exercises } = useExercises();
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState('');

  const prompt = useMemo(
    () => buildPlanPrompt(exercises.map((e) => e.name), todayISO()),
    [exercises],
  );
  const result = useMemo(() => (text.trim() ? parsePlanText(text) : null), [text]);
  const sessions = result?.ok ? [...result.sessions].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const known = new Set(exercises.map((e) => e.name.toLowerCase()));
  const newNames = planExerciseNames(sessions).filter((n) => !known.has(n.toLowerCase()));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; show the text so it can be copied by hand.
      setShowPrompt(true);
    }
  };

  const doImport = async () => {
    setBusy(true);
    setImportError('');
    try {
      await importPlan(sessions);
      // Land on the next session to train, not on one already in the past.
      const next = sessions.find((s) => s.date >= todayISO()) ?? sessions[0];
      navigate(`/?d=${next.date}`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed.');
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="title">Paste a plan</h1>

      <div className="card">
        <h3>1. Get your plan as text</h3>
        <p className="muted small">
          Copy the prompt, paste it into an AI chat, and add your plan after it: typed out, or a photo
          of the whiteboard. The reply is a block of text the app can read.
        </p>
        <div className="row">
          <button className="btn primary grow" onClick={copy}>
            {copied ? 'Copied' : 'Copy prompt'}
          </button>
          <button className="btn" onClick={() => setShowPrompt(!showPrompt)}>
            {showPrompt ? 'Hide' : 'Show'}
          </button>
        </div>
        {showPrompt && (
          <label className="field">
            Prompt
            <textarea readOnly rows={10} value={prompt} onFocus={(e) => e.target.select()} />
          </label>
        )}
      </div>

      <div className="card">
        <h3>2. Paste the reply here</h3>
        <label className="field">
          Plan text
          <textarea
            rows={8}
            value={text}
            placeholder='{ "sessions": [ ... ] }'
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {result && !result.ok && <p className="error">{result.error}</p>}
      </div>

      {sessions.length > 0 && (
        <div className="card">
          <h3>
            3. Check and import · {sessions.length} session{sessions.length === 1 ? '' : 's'}
          </h3>
          {sessions.map((s, i) => (
            <div key={i}>
              <div>
                {formatShortDate(s.date)} · {s.title}
              </div>
              <div className="muted small">
                {s.items
                  .map((it) =>
                    it.kind === 'strength'
                      ? `${it.exercise} ${it.sets}×${it.reps}${it.weightKg !== undefined ? ` @ ${it.weightKg} kg` : ''}`
                      : it.kind === 'metcon'
                        ? it.name
                        : it.exercise,
                  )
                  .join(' · ')}
              </div>
            </div>
          ))}
          {newNames.length > 0 && (
            <p className="small">New exercises that will be added to your library: {newNames.join(', ')}.</p>
          )}
          <p className="muted small">
            Planned sessions already on these dates are replaced. Sessions you have logged are kept.
          </p>
          {importError && <p className="error">{importError}</p>}
          <button className="btn primary block" disabled={busy} onClick={doImport}>
            Add to calendar
          </button>
        </div>
      )}
    </>
  );
}
