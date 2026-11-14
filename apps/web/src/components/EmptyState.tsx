import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** `empty` = sin datos; `error` = fallo de la API (rojo suave). */
  variant?: 'empty' | 'error';
}

/** Estado vacío y estado de error compartidos por todas las pantallas. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = 'empty',
}: EmptyStateProps) {
  const isError = variant === 'error';
  return (
    <div
      className={`vl-card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${
        isError ? 'border-error/40 bg-error/5' : ''
      }`}
      role={isError ? 'alert' : undefined}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          isError ? 'bg-error/10 text-error' : 'bg-base-200 text-base-content/50'
        }`}
      >
        {icon ?? (isError ? <AlertTriangle className="h-6 w-6" /> : <Inbox className="h-6 w-6" />)}
      </div>
      <h3 className="text-base font-semibold text-base-content">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-base-content/60">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  hint?: string;
}

/** Error de API con mensaje visible y botón de reintento. */
export function ErrorState({ error, title = 'No se pudo cargar la información', onRetry, hint }: ErrorStateProps) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Error inesperado';
  const offline = (error as { status?: number } | null)?.status === 0;

  return (
    <EmptyState
      variant="error"
      title={title}
      icon={offline ? <WifiOff className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
      description={hint ? `${hint} · ${message}` : message}
      action={
        onRetry ? (
          <button type="button" className="btn btn-sm btn-outline gap-2" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        ) : undefined
      }
    />
  );
}

export default EmptyState;
