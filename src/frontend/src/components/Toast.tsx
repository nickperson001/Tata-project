import { Toaster, toast as hotToast } from 'react-hot-toast';

function ToastContainer() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--bg-card)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          fontSize: '0.85rem',
          fontFamily: 'var(--font)',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        },
        success: {
          iconTheme: { primary: 'var(--primary)', secondary: '#fff' },
        },
        error: {
          iconTheme: { primary: 'var(--danger)', secondary: '#fff' },
        },
        duration: 3500,
      }}
      containerStyle={{
        top: '1rem',
        right: '1rem',
      }}
    />
  );
}

const toast = Object.assign(
  (message: string, opts?: any) => hotToast(message, { ...opts }),
  {
    success: (msg: string, opts?: any) => hotToast.success(msg, opts),
    error: (msg: string, opts?: any) => hotToast.error(msg, opts),
    info: (msg: string, opts?: any) => hotToast(msg, { icon: 'ℹ️', ...opts }),
    warning: (msg: string, opts?: any) => hotToast(msg, { icon: '⚠️', ...opts }),
    loading: (msg: string, opts?: any) => hotToast.loading(msg, opts),
    dismiss: (id?: string) => hotToast.dismiss(id),
  }
);

export { ToastContainer, toast };
