import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Undo2, Undo2 as Undo2Icon, ClipboardCheck, ArrowUpDown } from 'lucide-react';
import { Portal } from '../lib/Portal';
import { Z } from '../lib/zIndex';
import { MovementModal } from './MovementModal';
import { ReturnModal } from './ReturnModal';
import { PurchaseReturnModal } from './PurchaseReturnModal';
import { OpnameModal } from './OpnameModal';

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Package;
  route?: string;
  modal?: 'movement' | 'return' | 'purchaseReturn' | 'opname';
  modalType?: 'in' | 'out' | 'adjustment';
  color: string;
}

const actions: QuickAction[] = [
  { id: 'masuk', label: 'Stok Masuk', icon: Package, modal: 'movement', modalType: 'in', color: 'var(--primary)' },
  { id: 'keluar', label: 'Stok Keluar', icon: ArrowUpDown, modal: 'movement', modalType: 'out', color: 'var(--danger)' },
  { id: 'opname', label: 'Opname', icon: ClipboardCheck, modal: 'opname', color: 'var(--warning)' },
  { id: 'retur', label: 'Retur Jual', icon: Undo2, modal: 'return', color: '#8b5cf6' },
  { id: 'retur-beli', label: 'Retur Beli', icon: Undo2Icon, modal: 'purchaseReturn', color: '#f59e0b' },
];

export function QuickActions() {
  const [open, setOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [returnOpen, setReturnOpen] = useState(false);
  const [purchaseReturnOpen, setPurchaseReturnOpen] = useState(false);
  const [opnameOpen, setOpnameOpen] = useState(false);
  const navigate = useNavigate();
  const fabRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  function handleAction(a: QuickAction) {
    setOpen(false);
    if (a.modal === 'movement') {
      setMovementType(a.modalType || 'in');
      setMovementOpen(true);
    } else if (a.modal === 'return') {
      setReturnOpen(true);
    } else if (a.modal === 'purchaseReturn') {
      setPurchaseReturnOpen(true);
    } else if (a.modal === 'opname') {
      setOpnameOpen(true);
    } else if (a.route) {
      navigate(a.route);
    }
  }

  return (
    <>
      <button
        ref={fabRef}
        className="fab"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Tutup aksi cepat' : 'Aksi cepat'}
        style={{
          position: 'fixed',
          bottom: '5.5rem',
          right: '1.25rem',
          zIndex: Z.DROPDOWN,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, var(--primary), #059669)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <div style={{ transition: 'transform 0.25s', transform: open ? 'rotate(45deg)' : 'rotate(0)' }}>
          <Plus size={24} />
        </div>
      </button>

      {open && (
        <Portal>
          <div
            className="fab-backdrop"
            style={{
              position: 'fixed', inset: 0, zIndex: Z.DROPDOWN_BACKDROP,
              background: 'rgba(0,0,0,0.3)', animation: 'fadeIn 0.15s ease-out',
            }}
            onClick={() => setOpen(false)}
          />
          <div
            ref={sheetRef}
            className="fab-sheet"
            style={{
              position: 'fixed',
              bottom: 'calc(5.5rem + 64px)',
              right: '1.25rem',
              zIndex: Z.DROPDOWN,
              minWidth: 200,
              background: 'var(--bg-card)',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            <div style={{ padding: '0.5rem' }}>
              {actions.map(a => (
                <button
                  key={a.id}
                  className="fab-action"
                  onClick={() => handleAction(a)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    width: '100%', padding: '0.65rem 0.75rem', border: 'none',
                    background: 'transparent', cursor: 'pointer',
                    borderRadius: 10, fontSize: '0.85rem', fontWeight: 600,
                    color: 'var(--text)', fontFamily: 'var(--font)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: `${a.color}15`, color: a.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <a.icon size={16} />
                  </div>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Portal>
      )}

      <MovementModal
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        initialType={movementType}
      />
      <ReturnModal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
      />
      <PurchaseReturnModal
        open={purchaseReturnOpen}
        onClose={() => setPurchaseReturnOpen(false)}
      />
      <OpnameModal
        open={opnameOpen}
        onClose={() => setOpnameOpen(false)}
      />
    </>
  );
}
