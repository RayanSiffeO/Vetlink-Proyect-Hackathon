import { ScrollText } from 'lucide-react';
import { InlineLoading } from '../Loading';
import { useRequestAudit } from '../../api/hooks';
import type { AuditEvent } from '../../api/types';
import { formatDateTime } from '../../lib/format';

function AuditHeading() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ScrollText className="h-4 w-4 text-secondary" />
        Auditoría de acceso
      </h2>
      <span className="text-[11px] text-base-content/40">quién vio qué y cuándo</span>
    </div>
  );
}

function entityRef(event: AuditEvent): string {
  return event.entity_id ? `:${String(event.entity_id).slice(0, 12)}` : '';
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2 text-[12px]">
      <span className="font-mono text-[11px] text-base-content/40">
        {formatDateTime(event.created_at)}
      </span>
      <span className="font-semibold text-base-content/80">{event.actor ?? 'sistema'}</span>
      {event.role ? (
        <span className="badge badge-xs badge-ghost uppercase">{event.role}</span>
      ) : null}
      <span className="text-base-content/60">{event.action ?? 'evento'}</span>
      {event.entity_type ? (
        <span className="font-mono text-[10px] text-base-content/35">
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
      <p className="mt-3 text-[13px] text-base-content/50">
        Todavía no hay eventos registrados para esta solicitud.
      </p>
    );
  }
  return (
    <ol className="mt-3 divide-y divide-base-300/60">
      {events.map((event, index) => (
        <AuditEventRow key={event.id ?? index} event={event} />
      ))}
    </ol>
  );
}

export function AuditTab({ query }: { query: ReturnType<typeof useRequestAudit> }) {
  return (
    <section className="vl-card p-5">
      <AuditHeading />
      {query.isLoading ? <InlineLoading label="Cargando auditoría…" /> : null}
      {query.isError ? (
        <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-[12px] text-error">
          {query.error.message}
        </p>
      ) : null}
      {query.data ? <AuditEvents events={query.data.events ?? []} /> : null}
    </section>
  );
}
