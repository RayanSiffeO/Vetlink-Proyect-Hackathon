import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bone, CalendarClock, Eye, HeartPulse, MapPin, Ribbon, Search, Sparkles, Stethoscope, Tag, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState, ErrorState } from '../components/EmptyState';
import { LoadingCards } from '../components/Loading';
import { CardGrid } from '../components/CardGrid';
import { PageHeader } from '../components/PageHeader';
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
    <label className="block min-w-0 flex-1">
      <span className="vl-label">{field.label}</span>
      <div className="relative mt-1.5">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-300" />
        <input
          type="text"
          className="h-10 w-full rounded-btn border border-line bg-white/80 pl-9 pr-3 text-[12.5px] text-ink transition duration-200 ease-smooth placeholder:text-caption/60 focus:border-indigo-300"
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
      <button
        type="submit"
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[12px] font-medium text-cream shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-[#3A2E26] disabled:opacity-60"
        disabled={isFetching}
      >
        {isFetching ? <Spinner size="xs" /> : <Search className="h-3.5 w-3.5" />}
        Buscar
      </button>
      {hasFilters ? (
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-full border border-line bg-white/70 px-3 text-[12px] font-medium text-para transition duration-200 ease-smooth hover:-translate-y-px hover:border-indigo-300 hover:text-indigo-700"
          onClick={onClear}
        >
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
    <form
      className="glass flex flex-col gap-3 rounded-panel p-4 sm:flex-row sm:items-end"
      onSubmit={submit}
    >
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
      <span className="vl-section-title">Sugerencias</span>
      {SUGGESTIONS.map((suggestion) => {
        const active = selected === suggestion;
        return (
          <button
            key={suggestion}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium leading-4 transition duration-200 ease-smooth hover:-translate-y-px ${
              active
                ? 'border-indigo bg-ink text-cream shadow-lift'
                : 'border-line bg-white/70 text-para hover:border-indigo-300 hover:text-indigo-700'
            }`}
            onClick={() => onSelect(suggestion)}
          >
            {suggestion}
          </button>
        );
      })}
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
      <h2 className="text-[14px] font-medium leading-5 text-ink">
        {count} {count === 1 ? 'resultado' : 'resultados'}
        {hasFilters ? (
          <span className="font-normal text-caption"> con los filtros actuales</span>
        ) : null}
      </h2>
      {patientId ? (
        <Link
          to={`/patients/${patientId}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-3 py-1.5 text-[11px] font-medium text-para transition duration-200 ease-smooth hover:-translate-y-px hover:border-indigo-300 hover:text-indigo-700"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a la ficha del paciente
        </Link>
      ) : null}
    </div>
  );
}

const SPECIALTY_ICONS: Record<string, LucideIcon> = {
  Cardiología: HeartPulse,
  Dermatología: Sparkles,
  Traumatología: Bone,
  Oftalmología: Eye,
  Oncología: Ribbon,
};

function SpecialtyIcon({ specialty, className }: { specialty: string; className: string }) {
  const Icon = SPECIALTY_ICONS[specialty] ?? Stethoscope;
  return <Icon className={className} aria-hidden="true" />;
}

function SpecialistIdentity({ specialist }: { specialist: Specialist }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(246,221,196,0.72))] text-[16px] font-medium tracking-tight text-indigo-700 shadow-soft">
        {initials(specialist.name)}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[17px] font-medium leading-6 tracking-[-0.02em] text-ink">
          {specialist.name}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/55 px-2 py-0.5 text-[10.5px] font-medium leading-4 text-indigo-700">
            <SpecialtyIcon specialty={specialist.specialty} className="h-3 w-3" />
            {specialist.specialty}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] leading-4 text-caption">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {specialist.zone}
          </span>
        </div>
      </div>
    </div>
  );
}

function SpecialistBio({ bio }: { bio?: string | null }) {
  if (!bio) return null;
  return <p className="line-clamp-2 text-[12.5px] leading-[18px] text-para">{bio}</p>;
}

function SpecialistMetrics({ specialist }: { specialist: Specialist }) {
  return (
    <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-line/60 pt-3">
      <div className="min-w-0">
        <dt className="vl-label flex items-center gap-1">
          <Tag className="h-3 w-3" aria-hidden="true" /> Desde
        </dt>
        <dd className="mt-0.5 truncate text-[15px] font-medium text-ink">
          {formatPrice(specialist.price_from)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="vl-label flex items-center gap-1">
          <CalendarClock className="h-3 w-3" aria-hidden="true" /> Próximo hueco
        </dt>
        <dd className="mt-0.5 truncate text-[12.5px] font-medium text-ink">
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
    <article className="group flex flex-col gap-3.5 rounded-[24px] border border-white/60 bg-white/65 p-5 shadow-soft backdrop-blur-xl transition duration-300 ease-smooth hover:-translate-y-0.5 hover:bg-white hover:shadow-card">
      <SpecialistIdentity specialist={specialist} />
      <SpecialistBio bio={specialist.bio} />
      <SpecialistMetrics specialist={specialist} />
      <div className="flex justify-end">
        <Link
          to={specialistProfileHref(specialist.id, patientId)}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[11px] font-medium text-cream shadow-lift transition duration-200 ease-smooth hover:-translate-y-0.5 hover:bg-[#3A2E26]"
          aria-label={`Ver perfil y disponibilidad de ${specialist.name}`}
        >
          Ver perfil
          <ArrowRight className="h-3 w-3 transition duration-200 ease-smooth group-hover:translate-x-0.5" />
        </Link>
      </div>
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
    <p className="text-center text-[11px] text-caption/80">
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
  const count = query.data?.specialists?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        heading={{
          eyebrow: 'VetNetwork · marketplace',
          title: 'Especialistas',
          description:
            'Encuentra el especialista que necesita el caso: especialidad, zona, tarifa y próximo hueco.',
          icon: Stethoscope,
        }}
      >
        <div className="min-w-[92px] rounded-2xl border border-line bg-mist/75 px-3 py-1.5 text-center">
          <p className="text-[20px] font-medium leading-6 tracking-[-0.02em] text-indigo-700">
            {count}
          </p>
          <p className="vl-label mt-0.5">{count === 1 ? 'especialista' : 'especialistas'}</p>
        </div>
      </PageHeader>
      <div className="space-y-4">
        <SpecialistsToolbar filters={filters} query={query} patientId={patientId} />
      </div>
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
