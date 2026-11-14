import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  MapPin,
  Search,
  Stethoscope,
  Tag,
  UserRound,
} from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { LoadingCards } from '../components/Loading';
import { useSpecialists } from '../api/hooks';
import type { Specialist } from '../api/types';
import { formatDateTime, formatPrice, initials, relativeTime } from '../lib/format';

const SUGGESTIONS = ['Dermatología', 'Cardiología', 'Traumatología', 'Oftalmología', 'Oncología'];

function SpecialistCard({ specialist, patientId }: { specialist: Specialist; patientId: string }) {
  const detailHref = `/specialists/${specialist.id}${patientId ? `?patient_id=${patientId}` : ''}`;
  return (
    <article className="vl-card flex flex-col gap-3 p-4 transition-shadow hover:shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/10 text-sm font-bold text-secondary">
          {initials(specialist.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{specialist.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-base-content/55">
            <span className="badge badge-sm badge-secondary badge-outline gap-1">
              <Stethoscope className="h-3 w-3" />
              {specialist.specialty}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {specialist.zone}
            </span>
          </p>
        </div>
      </div>

      {specialist.bio ? (
        <p className="line-clamp-2 text-[13px] leading-snug text-base-content/60">
          {specialist.bio}
        </p>
      ) : null}

      <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-base-300/60 pt-3 text-[12px]">
        <div>
          <dt className="vl-label flex items-center gap-1">
            <Tag className="h-3 w-3" /> Desde
          </dt>
          <dd className="vl-value">{formatPrice(specialist.price_from)}</dd>
        </div>
        <div>
          <dt className="vl-label flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> Próximo hueco
          </dt>
          <dd className="vl-value truncate">
            {specialist.next_slot ? relativeTime(specialist.next_slot) : 'Sin hueco'}
          </dd>
        </div>
      </dl>

      <Link to={detailHref} className="btn btn-primary btn-sm w-full gap-1.5">
        Ver perfil y disponibilidad
      </Link>
    </article>
  );
}

export function Specialists() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient_id') ?? '';

  const [specialtyDraft, setSpecialtyDraft] = useState('');
  const [zoneDraft, setZoneDraft] = useState('');
  const [filters, setFilters] = useState({ specialty: '', zone: '' });

  const { data, isLoading, isError, error, isFetching, refetch } = useSpecialists(
    filters.specialty,
    filters.zone,
  );

  const specialists = data?.specialists ?? [];
  const hasFilters = Boolean(filters.specialty || filters.zone);

  const apply = (specialty: string, zone: string) => {
    setSpecialtyDraft(specialty);
    setZoneDraft(zone);
    setFilters({ specialty, zone });
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="vl-section-title">VetNetwork · marketplace</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Stethoscope className="h-6 w-6 text-secondary" aria-hidden="true" />
          Especialistas
        </h1>
        <p className="mt-1 text-sm text-base-content/55">
          Encuentra el especialista que necesita el caso: especialidad, zona, tarifa y próximo hueco.
        </p>
      </header>

      <form
        className="vl-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          apply(specialtyDraft, zoneDraft);
        }}
      >
        <label className="flex-1">
          <span className="vl-label">Especialidad</span>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/35" />
            <input
              type="text"
              className="input input-bordered input-sm h-10 w-full pl-9"
              placeholder="Dermatología, cardiología…"
              value={specialtyDraft}
              onChange={(event) => setSpecialtyDraft(event.target.value)}
            />
          </div>
        </label>
        <label className="flex-1">
          <span className="vl-label">Zona</span>
          <div className="relative mt-1">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/35" />
            <input
              type="text"
              className="input input-bordered input-sm h-10 w-full pl-9"
              placeholder="Barcelona, Vallès…"
              value={zoneDraft}
              onChange={(event) => setZoneDraft(event.target.value)}
            />
          </div>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary btn-sm h-10 gap-1.5" disabled={isFetching}>
            {isFetching ? <span className="loading loading-spinner loading-xs" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
          {hasFilters ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm h-10"
              onClick={() => apply('', '')}
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-base-content/40">
          Sugerencias
        </span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className={`btn btn-xs ${filters.specialty === suggestion ? 'btn-secondary' : 'btn-ghost border border-base-300'}`}
            onClick={() => apply(suggestion, filters.zone)}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/55">
          {specialists.length} {specialists.length === 1 ? 'resultado' : 'resultados'}
          {hasFilters ? ' con los filtros actuales' : ''}
        </h2>
        {patientId ? (
          <Link to={`/patients/${patientId}`} className="btn btn-ghost btn-xs gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a la ficha del paciente
          </Link>
        ) : null}
      </div>

      {isLoading ? (
        <LoadingCards count={3} />
      ) : isError ? (
        <ErrorState
          error={error}
          title="No se pudo cargar el marketplace"
          onRetry={() => refetch()}
          hint="La API de especialistas vive en /api/specialists"
        />
      ) : specialists.length === 0 ? (
        <EmptyState
          title="Sin especialistas para estos filtros"
          description="Prueba con otra especialidad o amplía la zona. Los datos de demo se recuperan con «Cargar demo»."
          icon={<UserRound className="h-6 w-6" />}
          action={
            hasFilters ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => apply('', '')}>
                Ver todos los especialistas
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {specialists.map((specialist) => (
            <SpecialistCard key={specialist.id} specialist={specialist} patientId={patientId} />
          ))}
        </div>
      )}

      {specialists.length > 0 && data ? (
        <p className="text-center text-[11px] text-base-content/35">
          {specialists.map((item) => item.zone).filter(Boolean).length > 0
            ? 'Tarifas orientativas «desde» · disponibilidad actualizada en tiempo real'
            : formatDateTime(new Date().toISOString())}
        </p>
      ) : null}
    </div>
  );
}

export default Specialists;
