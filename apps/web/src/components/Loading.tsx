import { Loader2 } from 'lucide-react';
import { CardGrid } from './CardGrid';
import { Spinner } from './Spinner';

interface LoadingProps {
  label?: string;
}

export function Loading({ label = 'Cargando…' }: LoadingProps) {
  return (
    <div className="vl-card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <Spinner size="lg" className="text-secondary" />
      <p className="text-sm text-base-content/60">{label}</p>
    </div>
  );
}

export function InlineLoading({ label = 'Cargando…' }: LoadingProps) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-base-content/60">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </span>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <CardGrid>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="vl-card animate-pulse p-5">
          <div className="h-4 w-2/3 rounded bg-base-300" />
          <div className="mt-3 h-3 w-1/2 rounded bg-base-200" />
          <div className="mt-6 h-3 w-full rounded bg-base-200" />
          <div className="mt-2 h-3 w-4/5 rounded bg-base-200" />
        </div>
      ))}
    </CardGrid>
  );
}

export default Loading;
