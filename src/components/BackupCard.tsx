import { useRef, useState } from 'react';
import { buildBackup, restoreBackup } from '../db';
import { parseBackup, readDate, writeDate, type BackupFile } from '../lib/backup';
import { formatShortDate, todayISO, toISODate } from '../lib/dates';

export default function BackupCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [lastExport, setLastExport] = useState(() => readDate('lastExport'));
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const exportAll = async () => {
    setError('');
    try {
      const backup = await buildBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `chalk-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      writeDate('lastExport', todayISO());
      setLastExport(todayISO());
      setMessage('Backup saved to your downloads. Keep a copy somewhere off this phone.');
    } catch {
      setError('Could not create the backup.');
    }
  };

  const pick = async (file: File | undefined) => {
    setMessage('');
    setError('');
    setPending(null);
    if (!file) return;
    const result = parseBackup(await file.text());
    if (result.ok) setPending(result.file);
    else setError(result.error);
  };

  const restore = async () => {
    if (!pending) return;
    if (!confirm('Replace everything in the app with this backup? What is here now will be erased.')) return;
    try {
      await restoreBackup(pending.data);
      setPending(null);
      setMessage('Backup restored.');
    } catch {
      setError('Restore failed. Nothing was changed.');
    }
  };

  const d = pending?.data;
  const exportedOn = pending?.exportedAt ? new Date(pending.exportedAt) : null;

  return (
    <div className="card">
      <h3>Backup</h3>
      <p className="muted small">
        Your log is stored only on this device. Export it now and then so a lost phone or cleared
        browser does not erase it.{' '}
        {lastExport ? `Last export: ${formatShortDate(lastExport)}.` : 'You have not exported yet.'}
      </p>
      <button className="btn primary block" onClick={exportAll}>
        Export all data
      </button>
      <button className="btn block" onClick={() => fileInput.current?.click()}>
        Import a backup
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {d && (
        <>
          <p className="small">
            This backup{exportedOn && !Number.isNaN(exportedOn.getTime()) ? ` from ${formatShortDate(toISODate(exportedOn))}` : ''}{' '}
            holds {d.workouts.length} workouts, {d.plans.length} planned sessions, {d.exercises.length}{' '}
            exercises, {d.blocks.length} blocks and {d.bodyweight.length} bodyweight entries.
          </p>
          <div className="row">
            <button className="btn grow" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className="btn danger grow" onClick={restore}>
              Replace all data
            </button>
          </div>
        </>
      )}
      {message && <p className="small">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
