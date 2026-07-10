import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

interface PromptModalProps {
  open: boolean;
  title: string;
  message: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  inputType?: string;
}

export function PromptModal({
  open, title, message, defaultValue = '',
  confirmLabel = 'Simpan', cancelLabel = 'Batal',
  onConfirm, onCancel, inputType = 'number',
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const initialDefault = useRef(defaultValue);

  useEffect(() => {
    if (initialDefault.current !== defaultValue) {
      initialDefault.current = defaultValue;
      setValue(defaultValue);
    }
  }, [defaultValue]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn btn-primary" onClick={() => onConfirm(value)} disabled={!value}>{confirmLabel}</button>
        </>
      }
    >
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '0.75rem' }}>{message}</p>
      {inputType === 'rupiah' ? (
        <input
          className="input"
          type="text"
          inputMode="numeric"
          value={value ? `Rp ${parseFloat(value).toLocaleString('id-ID')}` : ''}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            setValue(raw);
          }}
          autoFocus
          style={{ width: '100%' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && value) onConfirm(value); }}
        />
      ) : (
        <input
          className="input"
          type={inputType}
          min="0"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          style={{ width: '100%' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && value) onConfirm(value); }}
        />
      )}
    </Modal>
  );
}
