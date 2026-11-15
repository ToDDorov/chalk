import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: number;
  integer?: boolean;
  onChange: (v: number) => void;
}

const parse = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** A compact number field for table rows. Opens the numeric keypad and selects on focus. */
export default function NumCell({ label, value, integer, onChange }: Props) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((t) => (parse(t) === value ? t : String(value)));
  }, [value]);

  return (
    <input
      className="num-cell"
      inputMode={integer ? 'numeric' : 'decimal'}
      aria-label={label}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setText(e.target.value);
        const n = parse(e.target.value);
        if (n !== undefined) onChange(integer ? Math.round(n) : n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}
