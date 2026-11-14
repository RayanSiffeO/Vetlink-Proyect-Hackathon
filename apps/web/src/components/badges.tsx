import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { lookupValue } from '../lib/lookup';
import { requestStatusStyle, urgencyLabel } from '../lib/format';

export type StatusBadgeVariant = 'list' | 'plain' | 'header';

const STATUS_TONES: Record<string, string> = {
  REQUESTED: 'border-warn/20 bg-warn-soft text-warn',
  ACCEPTED: 'border-ok/20 bg-ok-soft text-ok',
  SCHEDULED: 'border-ok/20 bg-ok-soft text-ok',
  DECLINED: 'border-crit/20 bg-crit-soft text-crit',
  CANCELLED: 'border-line-strong bg-white/70 text-caption',
  COMPLETED: 'border-indigo-100 bg-indigo-50 text-indigo-700',
  EXPIRED: 'border-line-strong bg-white/70 text-caption',
};

const FALLBACK_STATUS_TONE = 'border-line-strong bg-white/70 text-caption';

const STATUS_BADGE_SIZE: Record<StatusBadgeVariant, string> = {
  list: 'px-2.5 py-1 text-[11px]',
  plain: 'px-2.5 py-1 text-[11px]',
  header: 'px-3 py-1.5 text-[12px]',
};

const STATUS_BADGE_BASE =
  'inline-flex items-center gap-1 rounded-full border font-medium leading-4 whitespace-nowrap';

export function StatusBadge({
  status,
  variant = 'list',
}: {
  status: string;
  variant?: StatusBadgeVariant;
}) {
  const style = requestStatusStyle(status);
  const tone = lookupValue(STATUS_TONES, String(status ?? '').toUpperCase(), FALLBACK_STATUS_TONE);
  return (
    <span className={`${STATUS_BADGE_BASE} ${STATUS_BADGE_SIZE[variant]} ${tone}`}>
      {style.label}
    </span>
  );
}

const URGENCY_TONES: Record<string, string> = {
  ALTA: 'border-crit/20 bg-crit-soft text-crit',
  MEDIA: 'border-warn/20 bg-warn-soft text-warn',
  BAJA: 'border-line-strong bg-white/70 text-caption',
};

const FALLBACK_URGENCY_TONE = 'border-line-strong bg-white/70 text-caption';

export function UrgencyBadge({ urgency, icon }: { urgency?: string | null; icon?: ReactNode }) {
  const tone = lookupValue(URGENCY_TONES, String(urgency ?? '').toUpperCase(), FALLBACK_URGENCY_TONE);
  return (
    <span className={`${STATUS_BADGE_BASE} px-2.5 py-1 text-[11px] ${tone}`}>
      {icon}
      {urgencyLabel(urgency)}
    </span>
  );
}

export function ShareBadge({ level }: { level?: string | null }) {
  return (
    <span className={`${STATUS_BADGE_BASE} border-line-strong bg-white/70 px-2.5 py-1 text-[11px] text-caption`}>
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      {String(level ?? 'CLINICAL').toUpperCase()}
    </span>
  );
}
