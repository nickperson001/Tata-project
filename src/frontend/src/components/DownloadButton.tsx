import { Download } from 'lucide-react';

interface DownloadButtonProps {
  onClick?: () => void;
  label?: string;
  disabled?: boolean;
  url?: string;
  filename?: string;
}

export function DownloadButton({ onClick, label = 'Unduh', disabled, url, filename }: DownloadButtonProps) {
  const handleClick = url
    ? () => {
        const a = document.createElement('a');
        a.href = url;
        if (filename) a.download = filename;
        a.click();
      }
    : onClick || (() => {});

  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
    >
      <Download size={15} />
      {label}
    </button>
  );
}
