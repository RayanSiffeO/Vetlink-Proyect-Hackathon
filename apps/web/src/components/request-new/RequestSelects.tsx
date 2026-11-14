import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Stethoscope } from 'lucide-react';
import { usePatients, useSpecialists } from '../../api/hooks';
import { ageFromBirthDate, formatPrice, initials } from '../../lib/format';

interface PatientFieldProps {
  value: string;
  onChange: (patientId: string) => void;
  query: ReturnType<typeof usePatients>;
}

interface SpecialistFieldProps {
  value: string;
  onChange: (specialistId: string) => void;
  query: ReturnType<typeof useSpecialists>;
}

interface SelectOption {
  value: string;
  label: string;
  description: string;
  initials: string;
}

interface SelectMenuProps {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyText?: string;
}

function OptionRow({
  option,
  selected,
  active,
  id,
  onChoose,
  onHover,
}: {
  option: SelectOption;
  selected: boolean;
  active: boolean;
  id: string;
  onChoose: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      id={id}
      aria-selected={selected}
      onClick={onChoose}
      onMouseEnter={onHover}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition duration-150 ease-smooth ${
        selected ? 'bg-indigo-50' : active ? 'bg-mist' : 'bg-transparent'
      }`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/80 bg-white/70 text-[10.5px] font-medium text-indigo-700">
        {option.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-4 text-ink">
          {option.label}
        </span>
        <span className="mt-0.5 block truncate text-[10.5px] leading-3 text-caption">
          {option.description}
        </span>
      </span>
      {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-indigo-700" aria-hidden="true" /> : null}
    </button>
  );
}

function SelectMenu({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
  emptyText = 'Sin opciones',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const labelId = useId();
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const choose = (option: SelectOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!open) {
      setOpen(true);
      setActive(Math.max(0, options.findIndex((option) => option.value === value)));
      return;
    }
    if (event.key === 'Enter' && options[active]) {
      choose(options[active]);
      return;
    }
    const delta = event.key === 'ArrowUp' ? -1 : 1;
    setActive((current) => Math.min(Math.max(current + delta, 0), Math.max(options.length - 1, 0)));
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <span id={labelId} className="vl-label">
        {label}
      </span>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
        className="mt-1 flex h-11 w-full items-center gap-3 rounded-2xl border border-line bg-white/80 px-3 text-left shadow-soft transition duration-200 ease-smooth hover:border-indigo-300 focus-visible:border-indigo-300 disabled:opacity-50"
      >
        {selected ? (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/80 bg-white/70 text-[10px] font-medium text-indigo-700">
            {selected.initials}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[12.5px] leading-4 ${
              selected ? 'font-medium text-ink' : 'text-caption/75'
            }`}
          >
            {selected?.label ?? placeholder}
          </span>
          {selected ? (
            <span className="mt-0.5 block truncate text-[10.5px] leading-3 text-caption">
              {selected.description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-caption transition duration-200 ease-smooth ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-card backdrop-blur-xl"
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-[11.5px] text-caption">{emptyText}</p>
          ) : (
            options.map((option, index) => (
              <OptionRow
                key={option.value}
                id={`${listId}-${index}`}
                option={option}
                selected={option.value === value}
                active={index === active}
                onChoose={() => choose(option)}
                onHover={() => setActive(index)}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PatientField({ value, onChange, query }: PatientFieldProps) {
  const patients = query.data?.patients ?? [];
  const selected = patients.find((patient) => patient.id === value) ?? null;
  const options = patients.map((patient) => ({
    value: patient.id,
    label: patient.name,
    description: [patient.species, ageFromBirthDate(patient.birth_date)].filter(Boolean).join(' · '),
    initials: initials(patient.name),
  }));

  return (
    <div>
      <SelectMenu
        label="Paciente"
        placeholder="Selecciona un paciente…"
        value={value}
        options={options}
        onChange={onChange}
      />
      {selected ? (
        <span className="mt-1 block text-[11px] leading-4 text-caption">
          {[selected.breed, selected.owner_display].filter(Boolean).join(' · ')}
        </span>
      ) : null}
    </div>
  );
}

function SpecialistFieldHint({
  error,
  specialist,
}: {
  error?: Error;
  specialist: { specialty: string; zone: string; price_from?: number | null } | null;
}) {
  return (
    <>
      {error ? (
        <span className="mt-1 block text-[11px] leading-4 text-crit">
          No se pudo cargar el marketplace: {error.message}
        </span>
      ) : null}
      {specialist ? (
        <span className="mt-1 flex items-center gap-1.5 text-[11px] leading-4 text-caption">
          <Stethoscope className="h-3 w-3" aria-hidden="true" />
          {specialist.specialty} · {specialist.zone} · desde {formatPrice(specialist.price_from)}
        </span>
      ) : null}
    </>
  );
}

export function SpecialistField({ value, onChange, query }: SpecialistFieldProps) {
  const specialists = query.data?.specialists ?? [];
  const selected = specialists.find((specialist) => specialist.id === value) ?? null;
  const options = specialists.map((specialist) => ({
    value: specialist.id,
    label: specialist.name,
    description: `${specialist.specialty} · ${specialist.zone}`,
    initials: initials(specialist.name),
  }));

  return (
    <div>
      <SelectMenu
        label="Especialista"
        placeholder={query.isLoading ? 'Cargando especialistas…' : 'Selecciona un especialista…'}
        value={value}
        options={options}
        onChange={onChange}
        disabled={query.isLoading}
        emptyText="No hay especialistas disponibles"
      />
      <SpecialistFieldHint error={query.error ?? undefined} specialist={selected} />
    </div>
  );
}
