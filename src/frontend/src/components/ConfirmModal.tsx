import { useEffect, useRef } from 'react';
import { Modal } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  onClose?: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmModal({
  open, onClose, onConfirm, onCancel,
  title = 'Konfirmasi',
  message = 'Apakah Anda yakin ingin melanjutkan?',
  confirmLabel = 'Ya',
  cancelLabel = 'Batal',
  danger, loading,
}: ConfirmModalProps) {
  const handleClose = onCancel || onClose || (() => {});
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Enter' && !loading) {
        onConfirm();
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onConfirm, loading]);

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : handleClose}
      title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={handleClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {message}
      </p>
    </Modal>
  );
}
