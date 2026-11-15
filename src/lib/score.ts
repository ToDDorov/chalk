import type { ScoreType } from '../types';

/** Metcons are matched across history by this normalised name. */
export const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** "9:45" -> 585, "1:02:03" -> 3723. Returns undefined for anything else. */
export const parseTimeToSeconds = (s: string): number | undefined => {
  const m = s.trim().match(/^(?:(\d+):)?(\d{1,3}):([0-5]\d)$/);
  if (!m) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
};

export const isTimeScore = (t: ScoreType) => t === 'time' || t === 'worst-round-time';

export const scorePlaceholder = (t: ScoreType) => {
  switch (t) {
    case 'time':
    case 'worst-round-time':
      return '9:45';
    case 'rounds+reps':
      return '5+12';
    case 'max-reps':
      return '120 reps';
    case 'load':
      return '80 kg';
  }
};
