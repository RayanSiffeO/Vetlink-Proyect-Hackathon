import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { requestStatusStyle, urgencyBadge, urgencyLabel } from '../lib/format';

export type StatusBadgeVariant = 'list' | 'plain' | 'header';

const STATUS_BADGE_CLASS: Record<StatusBadgeVariant, string> = {
  list: 'badge badge-sm font-semibold',
  plain: 'badge badge-sm',
  header: 'badge font-semibold',
};

export function StatusBadge({
  status,
  variant = 'list',
}: {
  status: string;
  variant?: StatusBadgeVariant;
}) {
  const style = requestStatusStyle(status);
  return <span className={`${STATUS_BADGE_CLASS[variant]} ${style.badge}`}>{style.label}</span>;
}

export function UrgencyBadge({ urgency, icon }: { urgency?: string | null; icon?: ReactNode }) {
  return (
    <span className={`badge badge-sm ${urgencyBadge(urgency)}`}>
      {icon}
      {urgencyLabel(urgency)}
    </span>
  );
}

export function ShareBadge({ level }: { level?: string | null }) {
  return (
    <span className="badge badge-sm badge-outline gap-1">
      <ShieldCheck className="h-3 w-3" />
      {String(level ?? 'CLINICAL').toUpperCase()}
    </span>
  );
}
