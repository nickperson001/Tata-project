import { useState } from 'react';

interface InfoTipProps {
  text: string;
}

export function InfoTip({ text }: InfoTipProps) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="info-tip"
      role="tooltip"
      tabIndex={0}
      onClick={() => setShow(!show)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      i
      {show && <span className="info-tip-content" style={{ display: 'block' }}>{text}</span>}
    </span>
  );
}
