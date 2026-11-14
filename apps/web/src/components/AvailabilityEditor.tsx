import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Save, Trash2 } from 'lucide-react';
import { useMe, useSpecialist, useUpdateAvailability } from '../api/hooks';
import type { AvailableSlot } from '../api/types';
import { formatDateTime } from '../lib/format';
import { Spinner } from './Spinner';

function isoSlot(slot: AvailableSlot): string {
  if (typeof slot === 'string') return slot;
  return slot.slot_iso ?? '';
}

function normalizeDraft(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

export function AvailabilityEditor() {
  const me = useMe();
  const specialistId = me.data ? `spc_${me.data.username}` : '';
  const query = useSpecialist(specialistId);
  const update = useUpdateAvailability();
  const [slots, setSlots] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!query.data) return;
    setSlots(query.data.available_slots.map(isoSlot).filter(Boolean));
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="glass flex items-center gap-2 rounded-panel p-4 text-[12px] text-caption">
        <Spinner size="xs" /> Cargando tu disponibilidad…
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="glass rounded-panel p-4 text-[12px] text-crit">
        No se pudo cargar tu disponibilidad.
      </div>
    );
  }

  const addSlot = () => {
    const value = normalizeDraft(draft);
    if (!value) return;
    setSlots((current) => Array.from(new Set([...current, value])).sort());
    setDraft('');
  };

  const removeSlot = (slot: string) => {
    setSlots((current) => current.filter((item) => item !== slot));
  };

  const save = () => {
    update.mutate({ specialistId, slots });
  };

  return (
    <section className="glass rounded-panel p-4 sm:p-5" aria-label="Mi disponibilidad">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-medium text-ink">Mi disponibilidad</h2>
            <p className="mt-0.5 text-[11.5px] leading-4 text-caption">
              Estas son las franjas que verán las clínicas al solicitar una derivación.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-line bg-white/60 px-2.5 py-1 text-[10.5px] font-medium text-caption">
          {slots.length} {slots.length === 1 ? 'franja' : 'franjas'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="input input-bordered input-sm h-9 rounded-xl border-line bg-white/80 text-[11.5px]"
          aria-label="Nueva franja de disponibilidad"
        />
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white/70 px-3 text-[11px] font-medium text-para transition hover:border-indigo-300 hover:text-indigo-700"
          onClick={addSlot}
          disabled={!draft}
        >
          <Plus className="h-3.5 w-3.5" /> Añadir franja
        </button>
      </div>

      {slots.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line bg-white/40 px-3 py-2 text-[11.5px] text-caption">
          No tienes franjas publicadas. Añade una para que las clínicas puedan solicitarte.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {slots.map((slot) => (
            <li
              key={slot}
              className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white/60 px-3 py-2"
            >
              <span className="min-w-0 truncate text-[11.5px] font-medium text-ink">
                {formatDateTime(slot)}
              </span>
              <button
                type="button"
                className="rounded-full p-1 text-caption transition hover:bg-white hover:text-crit"
                onClick={() => removeSlot(slot)}
                aria-label={`Quitar ${formatDateTime(slot)}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
        <p className="text-[10.5px] leading-4 text-caption">
          Los cambios se aplican a las nuevas solicitudes.
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[11px] font-medium text-cream shadow-lift transition hover:bg-[#3A2E26] disabled:opacity-50"
          onClick={save}
          disabled={update.isPending}
        >
          {update.isPending ? <Spinner size="xs" /> : <Save className="h-3.5 w-3.5" />}
          Guardar disponibilidad
        </button>
      </div>

      {update.isSuccess ? (
        <p className="mt-2 rounded-xl bg-ok-soft px-3 py-2 text-[11px] text-ok">
          Disponibilidad actualizada.
        </p>
      ) : null}
      {update.isError ? (
        <p className="mt-2 rounded-xl bg-crit-soft px-3 py-2 text-[11px] text-crit">
          {update.error.message}
        </p>
      ) : null}
    </section>
  );
}

export default AvailabilityEditor;
