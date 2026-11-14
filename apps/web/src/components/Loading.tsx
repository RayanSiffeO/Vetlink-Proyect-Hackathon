import { CardGrid } from './CardGrid';
import { Spinner } from './Spinner';

interface LoadingProps {
  label?: string;
}

function SkeletonLine({ className }: { className: string }) {
  return <span className={`shimmer block rounded-full bg-line ${className}`} aria-hidden="true" />;
}

export function Loading({ label = 'Cargando…' }: LoadingProps) {
  return (
    <div className="glass-strong rise rounded-panel px-6 py-12">
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
        <Spinner size="lg" className="text-indigo" />
        <p className="text-[13px] text-caption">{label}</p>
        <div className="mt-1 w-full space-y-2.5">
          <SkeletonLine className="mx-auto h-2.5 w-3/4" />
          <SkeletonLine className="mx-auto h-2.5 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function InlineLoading({ label = 'Cargando…' }: LoadingProps) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-caption">
      <Spinner size="xs" className="text-indigo" />
      {label}
    </span>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <CardGrid>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="vl-card rise p-5">
          <SkeletonLine className="h-3 w-2/3" />
          <SkeletonLine className="mt-3 h-2.5 w-1/2" />
          <SkeletonLine className="mt-6 h-2.5 w-full" />
          <SkeletonLine className="mt-2 h-2.5 w-4/5" />
        </div>
      ))}
    </CardGrid>
  );
}

export default Loading;
