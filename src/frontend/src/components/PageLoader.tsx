import { Loader2 } from 'lucide-react';

export function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100%',
      backgroundColor: '#f8fafc' // a light background
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        color: '#64748b'
      }}>
        <style>
          {`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>
        <Loader2 size={40} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Memuat...</p>
      </div>
    </div>
  );
}
