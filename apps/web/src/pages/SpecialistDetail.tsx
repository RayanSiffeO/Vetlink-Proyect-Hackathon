import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarClock, Clock3, MapPin, Send, Stethoscope, Tag } from 'lucide-react';
import { BackLink } from '../components/BackLink';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { useSpecialist } from '../api/hooks';
import type { AvailableSlot, Specialist } from '../api/types';
import { formatPrice, formatWeekday, initials, relativeTime, slotIso, slotLabel } from '../lib/format';
import { newRequestForSpecialistHref, specialistListHref } from '../lib/links';

interface SlotSelection {
  selectedSlot: string;
  onSelect: (iso: string) => void;
}

function slotDuration(slot: AvailableSlot): number | undefined {
  if (!slot || typeof slot !== 'object') return undefined;
  return slot.duration_min;
}

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
  const duration = slotDuration(slot);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!iso}
      aria-pressed={selected}
      className={`flex flex-col items-start rounded-2xl border px-3.5 py-3 text-left transition duration-200 ease-smooth hover:-translate-y-px ${
        selected
          ? 'border-ink bg-ink text-cream shadow-lift'
          : 'border-line bg-white/70 text-ink hover:border-indigo-300 hover:bg-white'
      } disabled:opacity-50`}
      title={iso || 'Franja sin fecha'}
    >
      <span
        className={`text-[9.5px] font-medium uppercase tracking-[0.08em] leading-3 ${
          selected ? 'text-cream/55' : 'text-caption'
        }`}
      >
        {iso ? formatWeekday(iso) : 'franja'}
      </span>
      <span className="mt-1 text-[12.5px] font-medium leading-4">{slotLabel(slot)}</span>
      {duration ? (
        <span
          className={`mt-0.5 text-[10.5px] leading-3 ${selected ? 'text-cream/55' : 'text-caption'}`}
        >
          {duration} min
        </span>
      ) : null}
    </button>
  );
}

function SpecialistProfileFacts({ specialist }: { specialist: Specialist }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="vl-section-title text-indigo-700">VetNetwork · perfil</p>
      <h1 className="mt-1.5 text-[30px] font-medium leading-9 tracking-[-0.03em] text-ink sm:text-[36px] sm:leading-[42px]">
        {specialist.name}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-caption">
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-indigo-700">
          <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
          {specialist.specialty}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white/60 px-2.5 py-1">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {specialist.zone}
        </span>
        {specialist.next_slot ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white/60 px-2.5 py-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Próximo hueco {relativeTime(specialist.next_slot)}
          </span>
        ) : null}
      </div>
      {specialist.bio ? (
        <p className="mt-3 max-w-2xl text-[13px] leading-[19px] text-para">{specialist.bio}</p>
      ) : null}
    </div>
  );
}

function SpecialistPriceBox({ priceFrom }: { priceFrom?: number | null }) {
  return (
    <div className="rounded-2xl border border-line bg-white/65 px-4 py-2.5 text-center">
      <p className="vl-label flex items-center justify-center gap-1">
        <Tag className="h-3 w-3" aria-hidden="true" /> Desde
      </p>
      <p className="mt-0.5 text-[22px] font-medium leading-6 tracking-[-0.02em] text-indigo-700">
        {formatPrice(priceFrom)}
      </p>
    </div>
  );
}

function SpecialistProfileHeader({ specialist }: { specialist: Specialist }) {
  return (
    <header className="glass rounded-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4 sm:gap-5">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(246,221,196,0.72))] text-xl font-medium tracking-tight text-indigo-700 shadow-soft">
          {initials(specialist.name)}
        </span>
        <SpecialistProfileFacts specialist={specialist} />
        <div className="ml-auto shrink-0">
          <SpecialistPriceBox priceFrom={specialist.price_from} />
        </div>
      </div>
    </header>
  );
}

function SelectedSlotHint({ selectedSlot }: { selectedSlot: string }) {
  return (
    <p className="text-[11.5px] leading-4 text-caption">
      {selectedSlot
        ? `Franja seleccionada: ${slotLabel({ slot_iso: selectedSlot })}`
        : 'Puedes seleccionar una franja preferida (opcional).'}
    </p>
  );
}

function SlotsEmpty({ requestHref }: { requestHref: string }) {
  return (
    <EmptyState
      title="Sin franjas publicadas"
      description="Puedes enviar la solicitud igualmente indicando tus franjas preferidas."
      action={
        <Link to={requestHref} className="btn border-0 bg-ink text-cream hover:bg-\[\#3A2E26\] btn-sm">
          Enviar solicitud
        </Link>
      }
    />
  );
}

function SlotsCard({
  slots,
  selection,
  requestHref,
}: {
  slots: AvailableSlot[];
  selection: SlotSelection;
  requestHref: string;
}) {
  return (
    <div className="glass rounded-panel p-4 sm:p-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {slots.map((slot, index) => {
          const iso = slotIso(slot);
          const isSelected = selection.selectedSlot === iso;
          return (
            <SlotButton
              key={iso || index}
              slot={slot}
              selected={isSelected}
              onSelect={() => selection.onSelect(isSelected ? '' : iso)}
            />
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/80 pt-3">
        <SelectedSlotHint selectedSlot={selection.selectedSlot} />
        <Link
          to={requestHref}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[12px] font-medium text-cream shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-[#3A2E26] sm:w-auto"
        >
          <Send className="h-3.5 w-3.5" />
          Solicitar derivación
        </Link>
      </div>
    </div>
  );
}

function AvailabilitySection({
  slots,
  selection,
  requestHref,
}: {
  slots: AvailableSlot[];
  selection: SlotSelection;
  requestHref: string;
}) {
  return (
    <section aria-label="Disponibilidad" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-medium leading-6 text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Disponibilidad ({slots.length})
        </h2>
        <span className="text-[11px] leading-4 text-caption">
          Elige una franja orientativa; el especialista la confirma al aceptar
        </span>
      </div>
      {slots.length === 0 ? (
        <SlotsEmpty requestHref={requestHref} />
      ) : (
        <SlotsCard slots={slots} selection={selection} requestHref={requestHref} />
      )}
    </section>
  );
}

function SpecialistNotFound() {
  return (
    <EmptyState
      title="Especialista no encontrado"
      description="El perfil solicitado no existe o la demo se ha reiniciado."
      action={
        <Link to="/specialists" className="btn border-0 bg-ink text-cream hover:bg-\[\#3A2E26\] btn-sm">
          Volver al marketplace
        </Link>
      }
    />
  );
}

export function SpecialistDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient_id') ?? '';
  const query = useSpecialist(id);
  const [selectedSlot, setSelectedSlot] = useState('');

  if (query.isLoading) return <Loading label="Cargando el perfil del especialista…" />;
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="No se pudo cargar el especialista"
        onRetry={() => query.refetch()}
        hint="Comprueba que el id existe en /api/specialists"
      />
    );
  }

  const specialist = query.data?.specialist;
  if (!specialist) return <SpecialistNotFound />;

  const slots = query.data?.available_slots ?? [];
  const requestHref = newRequestForSpecialistHref(specialist.id, patientId, selectedSlot);
  const selection = { selectedSlot, onSelect: setSelectedSlot };

  return (
    <div className="space-y-6">
      <BackLink to={specialistListHref(patientId)}>Especialistas</BackLink>
      <SpecialistProfileHeader specialist={specialist} />
      <AvailabilitySection slots={slots} selection={selection} requestHref={requestHref} />
    </div>
  );
}

export default SpecialistDetail;
