import { useRef } from 'react';
import { WEEKDAY_LETTERS, monthGrid, parseISODate, weekDays } from '../lib/dates';

export type DayMark = 'planned' | 'done' | 'missed';

interface Props {
  mode: 'week' | 'month';
  /** Any day inside the week or month being shown. */
  anchor: string;
  selected: string;
  today: string;
  marks: Map<string, DayMark>;
  onSelect: (iso: string) => void;
  onStep: (direction: 1 | -1) => void;
}

const MARK_LABEL: Record<DayMark, string> = {
  planned: 'planned',
  done: 'done',
  missed: 'missed',
};

export default function Calendar({ mode, anchor, selected, today, marks, onSelect, onStep }: Props) {
  const touchX = useRef<number | null>(null);
  const days = mode === 'week' ? weekDays(anchor) : monthGrid(anchor);
  const month = anchor.slice(0, 7);

  return (
    <div
      className="days"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 60) onStep(dx < 0 ? 1 : -1);
      }}
    >
      {WEEKDAY_LETTERS.map((l, i) => (
        <div key={i} className="dow">
          {l}
        </div>
      ))}
      {days.map((iso) => {
        const mark = marks.get(iso);
        const cls = [
          'day',
          iso === selected && 'selected',
          iso === today && 'today',
          mode === 'month' && iso.slice(0, 7) !== month && 'other',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={iso}
            className={cls}
            onClick={() => onSelect(iso)}
            aria-pressed={iso === selected}
            aria-label={`${parseISODate(iso).toDateString()}${mark ? `, ${MARK_LABEL[mark]}` : ''}`}
          >
            {parseISODate(iso).getDate()}
            <span className={`mark ${mark ?? ''}`} />
          </button>
        );
      })}
    </div>
  );
}
