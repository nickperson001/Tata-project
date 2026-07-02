import { useState } from 'react';
import { Download } from 'lucide-react';

interface DownloadButtonProps {
  url: string;
  filename: string;
  label?: string;
}

export function DownloadButton({ url, filename, label = 'Download Excel' }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const token = localStorage.getItem('tbs_token');
      const res = await fetch(url, {
        headers: { 'x-stock-token': token || '' },
      });
      if (!res.ok) throw new Error('Gagal download');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      alert('Gagal download file');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={handleDownload} disabled={loading} style={{ border: '1px solid var(--border)' }}>
      <Download size={14} />
      {loading ? 'Mengunduh...' : label}
    </button>
  );
}
