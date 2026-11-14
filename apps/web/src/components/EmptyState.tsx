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
  empty: { card: '', icon: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100' },
  error: {
    card: 'border-crit/25 bg-crit-soft/70',
    icon: 'bg-crit-soft text-crit ring-1 ring-inset ring-crit/20',
  },
};

const DEFAULT_ERROR_TITLE = 'No se pudo cargar la información';

function EmptyStateIcon({ variant, icon }: { variant: EmptyVariant; icon?: ReactNode }) {
  const styles = VARIANT_STYLES[variant];
  const fallback = variant === 'error' ? <AlertTriangle className="h-5 w-5" /> : <Inbox className="h-5 w-5" />;
  return (
    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${styles.icon}`}>
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
      className={`glass-strong rise flex flex-col items-center justify-center gap-3 rounded-panel px-6 py-12 text-center ${styles.card}`}
      role={isError ? 'alert' : undefined}
    >
      <EmptyStateIcon variant={variant} icon={icon} />
      <h3 className="text-[15px] font-medium text-ink">{title}</h3>
      {description ? (
        <p className="max-w-md text-[13px] leading-5 text-caption">{description}</p>
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
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-btn border border-line-strong bg-white px-3.5 py-2 text-[12.5px] font-medium text-para transition duration-200 ease-smooth hover:-translate-y-px hover:border-indigo-300 hover:text-indigo-700 hover:shadow-soft"
      onClick={onClick}
    >
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
      icon={offline ? <WifiOff className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      description={hint ? `${hint} · ${message}` : message}
      action={onRetry ? <RetryButton onClick={onRetry} /> : undefined}
    />
  );
}

export default EmptyState;
