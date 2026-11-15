import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: number;
  step: number;
  min?: number;
  onChange: (v: number) => void;
}

const parse = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

/** Big − / + buttons around a numeric field that opens the decimal keypad. */
export default function Stepper({ label, value, step, min = 0, onChange }: Props) {
  const [text, setText] = useState(String(value));

  // Follow outside changes without clobbering a half-typed number like "92.".
  useEffect(() => {
    setText((t) => (parse(t) === value ? t : String(value)));
  }, [value]);

  const bump = (dir: 1 | -1) => onChange(Math.max(min, Number((value + dir * step).toFixed(2))));

  return (
    <div className="stepper">
      <label>{label}</label>
      <button type="button" onClick={() => bump(-1)} aria-label={`Decrease ${label}`}>
        −
      </button>
      <input
        inputMode="decimal"
        value={text}
        aria-label={label}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setText(e.target.value);
          const n = parse(e.target.value);
          if (n !== undefined && n >= min) onChange(n);
        }}
        onBlur={() => setText(String(value))}
      />
      <button type="button" onClick={() => bump(1)} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}
