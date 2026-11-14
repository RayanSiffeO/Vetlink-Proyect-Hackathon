import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react';

type EmptyVariant = 'empty' | 'error';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: EmptyVariant;
}

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  hint?: string;
}

const VARIANT_STYLES: Record<EmptyVariant, { card: string; icon: string }> = {
  empty: { card: '', icon: 'bg-base-200 text-base-content/50' },
  error: { card: 'border-error/40 bg-error/5', icon: 'bg-error/10 text-error' },
};

const DEFAULT_ERROR_TITLE = 'No se pudo cargar la información';

function EmptyStateIcon({ variant, icon }: { variant: EmptyVariant; icon?: ReactNode }) {
  const styles = VARIANT_STYLES[variant];
  const fallback = variant === 'error' ? <AlertTriangle className="h-6 w-6" /> : <Inbox className="h-6 w-6" />;
  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles.icon}`}>
      {icon ?? fallback}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = 'empty',
}: EmptyStateProps) {
  const styles = VARIANT_STYLES[variant];
  const isError = variant === 'error';
  return (
    <div
      className={`vl-card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${styles.card}`}
      role={isError ? 'alert' : undefined}
    >
      <EmptyStateIcon variant={variant} icon={icon} />
      <h3 className="text-base font-semibold text-base-content">{title}</h3>
      {description ? (
        <p className="max-w-md text-sm text-base-content/60">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Error inesperado';
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-sm btn-outline gap-2" onClick={onClick}>
      <RefreshCw className="h-4 w-4" />
      Reintentar
    </button>
  );
}

export function ErrorState({ error, title = DEFAULT_ERROR_TITLE, onRetry, hint }: ErrorStateProps) {
  const message = errorText(error);
  const offline = (error as { status?: number } | null)?.status === 0;
  return (
    <EmptyState
      variant="error"
      title={title}
      icon={offline ? <WifiOff className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
      description={hint ? `${hint} · ${message}` : message}
      action={onRetry ? <RetryButton onClick={onRetry} /> : undefined}
    />
  );
}

export default EmptyState;
