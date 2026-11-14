import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, MapPin, Search, Stethoscope, Tag, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { LoadingCards } from '../components/Loading';
import { CardGrid } from '../components/CardGrid';
import { PageTitle } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { useSpecialists } from '../api/hooks';
import type { Specialist } from '../api/types';
import { formatDateTime, formatPrice, initials, relativeTime } from '../lib/format';
import { specialistProfileHref } from '../lib/links';

const SUGGESTIONS = ['Dermatología', 'Cardiología', 'Traumatología', 'Oftalmología', 'Oncología'];

interface FilterDraft {
  specialty: string;
  zone: string;
}

interface SpecialistFilters {
  draft: FilterDraft;
  applied: FilterDraft;
  updateDraft: (patch: Partial<FilterDraft>) => void;
  apply: (next: FilterDraft) => void;
}

interface SearchFieldModel {
  label: string;
  placeholder: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
}

interface SearchActions {
  apply: (next: FilterDraft) => void;
  isFetching: boolean;
  hasFilters: boolean;
}

function useSpecialistFilters(): SpecialistFilters {
  const [draft, setDraft] = useState<FilterDraft>({ specialty: '', zone: '' });
  const [applied, setApplied] = useState<FilterDraft>({ specialty: '', zone: '' });
  const updateDraft = (patch: Partial<FilterDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };
  const apply = (next: FilterDraft) => {
    setDraft(next);
    setApplied(next);
  };
  return { draft, applied, updateDraft, apply };
}

function SearchField({ field }: { field: SearchFieldModel }) {
  const Icon = field.icon;
  return (
    <label className="flex-1">
      <span className="vl-label">{field.label}</span>
      <div className="relative mt-1">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/35" />
        <input
          type="text"
          className="input input-bordered input-sm h-10 w-full pl-9"
          placeholder={field.placeholder}
          value={field.value}
          onChange={(event) => field.onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

function specialtyField(
  draft: FilterDraft,
  onChange: (patch: Partial<FilterDraft>) => void,
): SearchFieldModel {
  return {
    label: 'Especialidad',
    placeholder: 'Dermatología, cardiología…',
    icon: Search,
    value: draft.specialty,
    onChange: (specialty) => onChange({ specialty }),
  };
}

function zoneField(
  draft: FilterDraft,
  onChange: (patch: Partial<FilterDraft>) => void,
): SearchFieldModel {
  return {
    label: 'Zona',
    placeholder: 'Barcelona, Vallès…',
    icon: MapPin,
    value: draft.zone,
    onChange: (zone) => onChange({ zone }),
  };
}

function SearchButtons({
  isFetching,
  hasFilters,
  onClear,
}: {
  isFetching: boolean;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button type="submit" className="btn btn-primary btn-sm h-10 gap-1.5" disabled={isFetching}>
        {isFetching ? <Spinner size="xs" /> : <Search className="h-4 w-4" />}
        Buscar
      </button>
      {hasFilters ? (
        <button type="button" className="btn btn-ghost btn-sm h-10" onClick={onClear}>
          Limpiar
        </button>
      ) : null}
    </div>
  );
}

function SpecialistSearchForm({
  draft,
  onChange,
  actions,
}: {
  draft: FilterDraft;
  onChange: (patch: Partial<FilterDraft>) => void;
  actions: SearchActions;
}) {
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    actions.apply(draft);
  };
  return (
    <form className="vl-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end" onSubmit={submit}>
      <SearchField field={specialtyField(draft, onChange)} />
      <SearchField field={zoneField(draft, onChange)} />
      <SearchButtons
        isFetching={actions.isFetching}
        hasFilters={actions.hasFilters}
        onClear={() => actions.apply({ specialty: '', zone: '' })}
      />
    </form>
  );
}

function SpecialistSuggestions({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (specialty: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-base-content/40">
        Sugerencias
      </span>
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className={`btn btn-xs ${
            selected === suggestion ? 'btn-secondary' : 'btn-ghost border border-base-300'
          }`}
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

function SpecialistsResultsHeader({
  count,
  hasFilters,
  patientId,
}: {
  count: number;
  hasFilters: boolean;
  patientId: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/55">
        {count} {count === 1 ? 'resultado' : 'resultados'}
        {hasFilters ? ' con los filtros actuales' : ''}
      </h2>
      {patientId ? (
        <Link to={`/patients/${patientId}`} className="btn btn-ghost btn-xs gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a la ficha del paciente
        </Link>
      ) : null}
    </div>
  );
}

function SpecialistIdentity({ specialist }: { specialist: Specialist }) {
  return (
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
  );
}

function SpecialistBio({ bio }: { bio?: string | null }) {
  if (!bio) return null;
  return <p className="line-clamp-2 text-[13px] leading-snug text-base-content/60">{bio}</p>;
}

function SpecialistMetrics({ specialist }: { specialist: Specialist }) {
  return (
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
  );
}

function SpecialistCard({ specialist }: { specialist: Specialist }) {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient_id') ?? '';
  return (
    <article className="vl-card flex flex-col gap-3 p-4 transition-shadow hover:shadow-card">
      <SpecialistIdentity specialist={specialist} />
      <SpecialistBio bio={specialist.bio} />
      <SpecialistMetrics specialist={specialist} />
      <Link
        to={specialistProfileHref(specialist.id, patientId)}
        className="btn btn-primary btn-sm w-full gap-1.5"
      >
        Ver perfil y disponibilidad
      </Link>
    </article>
  );
}

function SpecialistsEmpty({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <EmptyState
      title="Sin especialistas para estos filtros"
      description="Prueba con otra especialidad o amplía la zona. Los datos de demo se recuperan con «Cargar demo»."
      icon={<UserRound className="h-6 w-6" />}
      action={
        hasFilters ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={onClear}>
            Ver todos los especialistas
          </button>
        ) : undefined
      }
    />
  );
}

function SpecialistsBody({
  query,
  hasFilters,
  onClear,
}: {
  query: ReturnType<typeof useSpecialists>;
  hasFilters: boolean;
  onClear: () => void;
}) {
  if (query.isLoading) return <LoadingCards count={3} />;
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title="No se pudo cargar el marketplace"
        onRetry={() => query.refetch()}
        hint="La API de especialistas vive en /api/specialists"
      />
    );
  }
  const specialists = query.data?.specialists ?? [];
  if (specialists.length === 0) {
    return <SpecialistsEmpty hasFilters={hasFilters} onClear={onClear} />;
  }
  return (
    <CardGrid>
      {specialists.map((specialist) => (
        <SpecialistCard key={specialist.id} specialist={specialist} />
      ))}
    </CardGrid>
  );
}

function SpecialistsToolbar({
  filters,
  query,
  patientId,
}: {
  filters: SpecialistFilters;
  query: ReturnType<typeof useSpecialists>;
  patientId: string;
}) {
  const count = (query.data?.specialists ?? []).length;
  const hasFilters = Boolean(filters.applied.specialty || filters.applied.zone);
  return (
    <>
      <SpecialistSearchForm
        draft={filters.draft}
        onChange={filters.updateDraft}
        actions={{ apply: filters.apply, isFetching: query.isFetching, hasFilters }}
      />
      <SpecialistSuggestions
        selected={filters.applied.specialty}
        onSelect={(specialty) => filters.apply({ specialty, zone: filters.applied.zone })}
      />
      <SpecialistsResultsHeader count={count} hasFilters={hasFilters} patientId={patientId} />
    </>
  );
}

function SpecialistsFooter({ query }: { query: ReturnType<typeof useSpecialists> }) {
  const specialists = query.data?.specialists ?? [];
  if (!query.data || specialists.length === 0) return null;
  const withZone = specialists.map((item) => item.zone).filter(Boolean).length;
  return (
    <p className="text-center text-[11px] text-base-content/35">
      {withZone > 0
        ? 'Tarifas orientativas «desde» · disponibilidad actualizada en tiempo real'
        : formatDateTime(new Date().toISOString())}
    </p>
  );
}

export function Specialists() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient_id') ?? '';
  const filters = useSpecialistFilters();
  const query = useSpecialists(filters.applied.specialty, filters.applied.zone);
  const hasFilters = Boolean(filters.applied.specialty || filters.applied.zone);

  return (
    <div className="space-y-6">
      <header>
        <PageTitle
          heading={{
            eyebrow: 'VetNetwork · marketplace',
            title: 'Especialistas',
            description:
              'Encuentra el especialista que necesita el caso: especialidad, zona, tarifa y próximo hueco.',
            icon: Stethoscope,
          }}
        />
      </header>
      <SpecialistsToolbar filters={filters} query={query} patientId={patientId} />
      <SpecialistsBody
        query={query}
        hasFilters={hasFilters}
        onClear={() => filters.apply({ specialty: '', zone: '' })}
      />
      <SpecialistsFooter query={query} />
    </div>
  );
}

export default Specialists;
