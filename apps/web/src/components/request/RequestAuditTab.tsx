import { ScrollText } from 'lucide-react';
import { InlineLoading } from '../Loading';
import { useRequestAudit } from '../../api/hooks';
import type { AuditEvent } from '../../api/types';
import { formatDateTime } from '../../lib/format';

function AuditHeading() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[14px] font-medium leading-5 text-ink">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
          <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        Auditoría de acceso
      </h2>
      <span className="text-[11px] leading-4 text-caption">quién vio qué y cuándo</span>
    </div>
  );
}

function entityRef(event: AuditEvent): string {
  return event.entity_id ? `:${String(event.entity_id).slice(0, 12)}` : '';
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  return (
    <li className="relative flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5 pl-4 text-[12px] leading-[18px]">
      <span className="absolute left-0 top-4 h-1.5 w-1.5 rounded-full bg-indigo-300" aria-hidden="true" />
      <span className="font-mono text-[10.5px] text-caption">{formatDateTime(event.created_at)}</span>
      <span className="font-medium text-ink">{event.actor ?? 'sistema'}</span>
      {event.role ? (
        <span className="rounded-full border border-line-strong bg-white/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em] leading-3 text-caption">
          {event.role}
        </span>
      ) : null}
      <span className="text-para">{event.action ?? 'evento'}</span>
      {event.entity_type ? (
        <span className="font-mono text-[10px] text-caption/80">
          {event.entity_type}
          {entityRef(event)}
        </span>
      ) : null}
    </li>
  );
}

function AuditEvents({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="mt-3 text-[13px] leading-5 text-caption">
        Todavía no hay eventos registrados para esta solicitud.
      </p>
    );
  }
  return (
    <ol className="mt-3 divide-y divide-line/70">
      {events.map((event, index) => (
        <AuditEventRow key={event.id ?? index} event={event} />
      ))}
    </ol>
  );
}

export function AuditTab({ query }: { query: ReturnType<typeof useRequestAudit> }) {
  return (
    <section className="rounded-card border border-line bg-white/70 p-5 shadow-soft">
      <AuditHeading />
      {query.isLoading ? <InlineLoading label="Cargando auditoría…" /> : null}
      {query.isError ? (
        <p className="mt-3 rounded-xl border border-crit/20 bg-crit-soft px-3 py-2 text-[12px] text-crit">
          {query.error.message}
        </p>
      ) : null}
      {query.data ? <AuditEvents events={query.data.events ?? []} /> : null}
    </section>
  );
}
