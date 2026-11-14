import { Loader2 } from 'lucide-react';

interface LoadingProps {
  /** Texto visible bajo el spinner. */
  label?: string;
  /** Compacto = spinner en línea, sin bloque alto. */
  compact?: boolean;
}

/** Estado de carga estándar de VetLink. */
export function Loading({ label = 'Cargando…', compact = false }: LoadingProps) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-base-content/60">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <div className="vl-card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="loading loading-spinner loading-lg text-secondary" />
      <p className="text-sm text-base-content/60">{label}</p>
    </div>
  );
}

/** Esqueleto de tarjetas para tablas/listas. */
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="vl-card animate-pulse p-5">
          <div className="h-4 w-2/3 rounded bg-base-300" />
          <div className="mt-3 h-3 w-1/2 rounded bg-base-200" />
          <div className="mt-6 h-3 w-full rounded bg-base-200" />
          <div className="mt-2 h-3 w-4/5 rounded bg-base-200" />
        </div>
      ))}
    </div>
  );
}

export default Loading;
