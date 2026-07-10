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
  const scrollYRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      wasOpen.current = true;
      previousFocusRef.current = document.activeElement as HTMLElement;
      scrollYRef.current = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.width = '100%';

      requestAnimationFrame(() => {
        modalRef.current?.focus();
      });
    }

    if (!open && wasOpen.current) {
      wasOpen.current = false;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollYRef.current);
      previousFocusRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
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
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  const modal = (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}
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
          <button className="btn btn-ghost btn-sm" onClick={() => onCloseRef.current()} aria-label={`Tutup ${title}`}>
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
