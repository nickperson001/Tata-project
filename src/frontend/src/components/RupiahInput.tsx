import { useState, useRef, useCallback } from 'react';

interface RupiahInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  autoFocus?: boolean;
}

function formatRupiah(value: string): string {
  const num = parseFloat(value.replace(/[^0-9]/g, ''));
  if (isNaN(num)) return '';
  return `Rp ${num.toLocaleString('id-ID')}`;
}

export function RupiahInput({ value, onChange, className = 'input', placeholder, required, min, autoFocus }: RupiahInputProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = focused ? value : formatRupiah(value);

  const handleFocus = useCallback(() => {
    setFocused(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const raw = value.replace(/[^0-9]/g, '');
    if (raw) {
      onChange(raw);
    }
  }, [value, onChange]);

  return (
    <input
      ref={inputRef}
      className={className}
      type={focused ? 'text' : 'text'}
      inputMode="numeric"
      value={displayValue}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        onChange(raw);
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder || (focused ? '0' : 'Rp 0')}
      required={required}
      min={min}
      autoFocus={autoFocus}
    />
  );
}
