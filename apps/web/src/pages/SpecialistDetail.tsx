import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  MapPin,
  Send,
  Stethoscope,
  Tag,
} from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { useSpecialist } from '../api/hooks';
import type { AvailableSlot } from '../api/types';
import {
  formatPrice,
  formatWeekday,
  initials,
  relativeTime,
  slotIso,
  slotLabel,
} from '../lib/format';

function SlotButton({
  slot,
  selected,
  onSelect,
}: {
  slot: AvailableSlot;
  selected: boolean;
  onSelect: () => void;
}) {
  const iso = slotIso(slot);
  const duration = typeof slot === 'object' && slot ? slot.duration_min : undefined;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!iso}
      className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors ${
        selected
          ? 'border-secondary bg-secondary/10 text-secondary'
          : 'border-base-300 bg-base-100 hover:border-secondary/50'
      } disabled:opacity-50`}
      title={iso || 'Franja sin fecha'}
    >
      <span className="text-[11px] uppercase tracking-wide text-base-content/45">
        {iso ? formatWeekday(iso) : 'franja'}
      </span>
      <span className="text-sm font-semibold">{slotLabel(slot)}</span>
      {duration ? (
        <span className="text-[11px] text-base-content/40">{duration} min</span>
      ) : null}
    </button>
  );
}

export function SpecialistDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient_id') ?? '';
  const { data, isLoading, isError, error, refetch } = useSpecialist(id);
  const [selectedSlot, setSelectedSlot] = useState<string>('');

  if (isLoading) return <Loading label="Cargando el perfil del especialista…" />;

  if (isError) {
    return (
      <ErrorState
        error={error}
        title="No se pudo cargar el especialista"
        onRetry={() => refetch()}
        hint="Comprueba que el id existe en /api/specialists"
      />
    );
  }

  const specialist = data?.specialist;
  if (!specialist) {
    return (
      <EmptyState
        title="Especialista no encontrado"
        description="El perfil solicitado no existe o la demo se ha reiniciado."
        action={
          <Link to="/specialists" className="btn btn-primary btn-sm">
            Volver al marketplace
          </Link>
        }
      />
    );
  }

  const slots = data?.available_slots ?? [];
  const requestHref = `/requests/new?specialist_id=${encodeURIComponent(specialist.id)}${
    patientId ? `&patient_id=${encodeURIComponent(patientId)}` : ''
  }${selectedSlot ? `&slot=${encodeURIComponent(selectedSlot)}` : ''}`;

  return (
    <div className="space-y-6">
      <Link
        to={`/specialists${patientId ? `?patient_id=${patientId}` : ''}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-base-content/55 hover:text-secondary"
      >
        <ArrowLeft className="h-4 w-4" />
        Especialistas
      </Link>

      <header className="vl-card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-secondary text-lg font-bold text-secondary-content">
            {initials(specialist.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{specialist.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/60">
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-secondary" />
                {specialist.specialty}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-secondary" />
                {specialist.zone}
              </span>
              {specialist.next_slot ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 text-secondary" />
                  Próximo hueco {relativeTime(specialist.next_slot)}
                </span>
              ) : null}
            </p>
            {specialist.bio ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-base-content/65">
                {specialist.bio}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="rounded-xl bg-base-200 px-3 py-2 text-center">
              <p className="vl-label flex items-center justify-center gap-1">
                <Tag className="h-3 w-3" /> Desde
              </p>
              <p className="text-lg font-bold text-primary">{formatPrice(specialist.price_from)}</p>
            </div>
            <Link to={requestHref} className="btn btn-primary btn-sm gap-1.5">
              <Send className="h-4 w-4" />
              Solicitar derivación
            </Link>
          </div>
        </div>
      </header>

      <section aria-label="Disponibilidad" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-base-content/55">
            <CalendarClock className="h-4 w-4" />
            Disponibilidad ({slots.length})
          </h2>
          <span className="text-[11px] text-base-content/40">
            Elige una franja orientativa; el especialista la confirma al aceptar
          </span>
        </div>

        {slots.length === 0 ? (
          <EmptyState
            title="Sin franjas publicadas"
            description="Puedes enviar la solicitud igualmente indicando tus franjas preferidas."
            action={
              <Link to={requestHref} className="btn btn-primary btn-sm">
                Enviar solicitud
              </Link>
            }
          />
        ) : (
          <div className="vl-card p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {slots.map((slot, index) => {
                const iso = slotIso(slot);
                return (
                  <SlotButton
                    key={iso || index}
                    slot={slot}
                    selected={selectedSlot === iso}
                    onSelect={() => setSelectedSlot(iso === selectedSlot ? '' : iso)}
                  />
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-base-300/60 pt-3">
              <p className="text-[12px] text-base-content/50">
                {selectedSlot
                  ? `Franja seleccionada: ${slotLabel({ slot_iso: selectedSlot })}`
                  : 'Puedes seleccionar una franja preferida (opcional).'}
              </p>
              <Link to={requestHref} className="btn btn-secondary btn-sm gap-1.5">
                <Send className="h-4 w-4" />
                Solicitar derivación
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default SpecialistDetail;
