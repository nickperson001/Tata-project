import { useEffect, useRef, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Portal } from '../lib/Portal';
import { Z } from '../lib/zIndex';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  large?: boolean;
}

export function Modal({ open, onClose, title, children, footer, large }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    requestAnimationFrame(() => {
      modalRef.current?.focus();
    });

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ zIndex: Z.MODAL_OVERLAY }}
    >
      <div
        ref={modalRef}
        className={`modal ${large ? 'modal-lg' : ''}`}
        tabIndex={-1}
        style={{ zIndex: Z.MODAL_CONTENT }}
      >
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={`Tutup ${title}`}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );

  return <Portal>{modal}</Portal>;
}
