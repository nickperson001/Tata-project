interface InfoTipProps {
  text: string;
}

export function InfoTip({ text }: InfoTipProps) {
  return (
    <span className="info-tip" role="tooltip">
      i
      <span className="info-tip-content">{text}</span>
    </span>
  );
}
