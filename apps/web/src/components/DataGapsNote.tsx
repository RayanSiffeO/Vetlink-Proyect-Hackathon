import { AlertTriangle } from 'lucide-react';

export function DataGapsNote({ gaps, className }: { gaps: string[]; className: string }) {
  return (
    <p className={`flex items-start gap-2 break-words ${className}`}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold">Datos que faltan: </span>
        {gaps.join(' · ')}
      </span>
    </p>
  );
}
