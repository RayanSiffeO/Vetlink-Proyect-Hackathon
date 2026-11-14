import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles, XCircle } from 'lucide-react';
import type { AvailableSlot, RequestRecord } from '../../api/types';
import { useAcceptRequest, useDeclineRequest, useSpecialist } from '../../api/hooks';
import { formatDateTime, shareLevelLabel, slotIso, slotLabel } from '../../lib/format';
import { toIsoFromLocal } from '../../lib/requests';
import { Spinner } from '../Spinner';

interface AcceptActions {
  accept: ReturnType<typeof useAcceptRequest>;
  decline: ReturnType<typeof useDeclineRequest>;
}

function AcceptHeading({ shareLevel }: { shareLevel?: string | null }) {
  return (
    <>
      <h2 className="flex items-center gap-2 text-[15px] font-medium leading-6 text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        Aceptar la derivación y confirmar franja
      </h2>
      <p className="mt-2 text-[12px] leading-[18px] text-caption">
        Al aceptar se desbloquean la historia completa y el briefing según el nivel
        {` ${shareLevelLabel(shareLevel)}`} y queda registrado en la auditoría.
      </p>
    </>
  );
}

function SlotOption({
  slot,
  selected,
  onSelect,
}: {
  slot: AvailableSlot;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border px-3 py-2 text-left text-[12.5px] font-medium leading-4 transition duration-200 ease-smooth ${
        selected
          ? 'border-indigo bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100'
          : 'border-line bg-white/70 text-para hover:-translate-y-px hover:border-indigo-300'
      }`}
    >
      {slotLabel(slot)}
    </button>
  );
}

function AvailabilityEmpty({ query }: { query: ReturnType<typeof useSpecialist> }) {
  return (
    <p className="mt-3 text-[12px] leading-[18px] text-caption">
      {query.isError
        ? `No se pudo cargar la disponibilidad (${query.error.message}). Indica una fecha concreta.`
        : 'Sin franjas publicadas: indica una fecha concreta.'}
    </p>
  );
}

function AvailabilityBlock({
  query,
  selection,
}: {
  query: ReturnType<typeof useSpecialist>;
  selection: { selectedSlot: string; onPick: (iso: string) => void };
}) {
  const slots = query.data?.available_slots ?? [];
  if (query.isLoading) {
    return <p className="mt-3 text-[12px] leading-[18px] text-caption">Cargando disponibilidad…</p>;
  }
  if (slots.length === 0) return <AvailabilityEmpty query={query} />;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {slots.map((slot, index) => {
        const iso = slotIso(slot);
        return (
          <SlotOption
            key={iso || index}
            slot={slot}
            selected={selection.selectedSlot === iso}
            onSelect={() => selection.onPick(iso)}
          />
        );
      })}
    </div>
  );
}

function ManualSlotField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="vl-label">Otra franja</span>
      <input
        type="datetime-local"
        className="input input-bordered input-sm mt-1 h-9 rounded-btn border-line bg-white/80 text-[12px]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function AcceptButton({
  accept,
  slot,
}: {
  accept: ReturnType<typeof useAcceptRequest>;
  slot: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-primary btn-sm h-9 gap-1.5 rounded-full px-4 text-[12px] shadow-lift"
      disabled={!slot || accept.isPending}
      onClick={() => accept.mutate({ slot_iso: slot })}
    >
      {accept.isPending ? <Spinner size="xs" /> : <CheckCircle2 className="h-4 w-4" />}
      Aceptar
    </button>
  );
}

function DeclineButton({ decline }: { decline: ReturnType<typeof useDeclineRequest> }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[12px] font-medium text-crit transition duration-200 ease-smooth hover:border-crit/20 hover:bg-crit-soft disabled:opacity-60"
      onClick={() => decline.mutate()}
      disabled={decline.isPending}
    >
      <XCircle className="h-4 w-4" />
      Rechazar
    </button>
  );
}

function SlotSummary({ slot }: { slot: string }) {
  return (
    <span className="text-[11px] leading-4 text-caption">
      {slot ? `Franja: ${formatDateTime(slot)}` : 'Selecciona una franja'}
    </span>
  );
}

function AcceptControls({
  selection,
  actions,
}: {
  selection: { manual: string; effectiveSlot: string; onManual: (value: string) => void };
  actions: AcceptActions;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <ManualSlotField value={selection.manual} onChange={selection.onManual} />
      <AcceptButton accept={actions.accept} slot={selection.effectiveSlot} />
      <DeclineButton decline={actions.decline} />
      <SlotSummary slot={selection.effectiveSlot} />
    </div>
  );
}

function useAutoSelectSlot(
  slots: AvailableSlot[],
  selectedSlot: string,
  setSelectedSlot: (iso: string) => void,
) {
  useEffect(() => {
    if (selectedSlot || slots.length === 0) return;
    const first = slotIso(slots[0]);
    if (first) setSelectedSlot(first);
  }, [slots, selectedSlot, setSelectedSlot]);
}

export function AcceptPanel({
  request,
  actions,
}: {
  request: RequestRecord;
  actions: AcceptActions;
}) {
  const slotsQuery = useSpecialist(request.specialist_id ?? undefined);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [manualSlot, setManualSlot] = useState('');
  const slots = slotsQuery.data?.available_slots ?? [];
  const effectiveSlot = selectedSlot || toIsoFromLocal(manualSlot);

  useAutoSelectSlot(slots, selectedSlot, setSelectedSlot);

  const pickSlot = (iso: string) => {
    setSelectedSlot(iso);
    setManualSlot('');
  };
  const setManual = (value: string) => {
    setManualSlot(value);
    setSelectedSlot('');
  };

  return (
    <section className="glass rounded-panel border-l-4 border-l-indigo p-5">
      <AcceptHeading shareLevel={request.share_level} />
      <AvailabilityBlock query={slotsQuery} selection={{ selectedSlot, onPick: pickSlot }} />
      <AcceptControls
        selection={{ manual: manualSlot, effectiveSlot, onManual: setManual }}
        actions={actions}
      />
    </section>
  );
}
