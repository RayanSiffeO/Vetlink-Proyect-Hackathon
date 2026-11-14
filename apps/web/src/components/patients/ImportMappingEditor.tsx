import { useEffect, useState } from 'react';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import { useConfirmImportMapping, useImportMapping } from '../../api/hooks';
import { Spinner } from '../Spinner';

interface ImportMappingEditorProps {
  jobId: string;
  filename: string;
  onClose: () => void;
  onConfirmed?: () => void;
}

function confidenceLabel(confidence?: number): string {
  if (!confidence) return 'sin detectar';
  return `${Math.round(confidence * 100)}%`;
}

export function ImportMappingEditor({ jobId, filename, onClose, onConfirmed }: ImportMappingEditorProps) {
  const query = useImportMapping(jobId);
  const confirm = useConfirmImportMapping();
  const [mapping, setMapping] = useState<Record<number, string | null>>({});

  useEffect(() => {
    if (!query.data) return;
    setMapping(
      Object.fromEntries(query.data.columns.map((column) => [column.index, column.target ?? null])),
    );
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-white/60 p-4 text-[12px] text-caption">
        <Spinner size="xs" /> Cargando mapeo propuesto…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mt-3 rounded-2xl border border-warn/20 bg-warn-soft/60 p-4 text-[12px] text-warn">
        No se pudo cargar el mapeo.
        <button type="button" className="ml-2 underline" onClick={onClose}>
          Cerrar
        </button>
      </div>
    );
  }

  const data = query.data;
  const hasPatientName = Object.values(mapping).includes('patient.name');
  const submit = () => {
    confirm.mutate(
      {
        jobId,
        mapping: data.columns.map((column) => ({ index: column.index, target: mapping[column.index] ?? null })),
      },
      { onSuccess: () => onConfirmed?.() },
    );
  };

  return (
    <div className="mt-3 rounded-2xl border border-indigo-100 bg-white/70 p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-[13px] font-medium text-ink">Revisar mapeo de columnas</h3>
            <p className="text-[11px] leading-4 text-caption">
              {filename} · {data.rows_count} filas · {data.format.toUpperCase()}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="rounded-full p-1.5 text-caption transition hover:bg-white hover:text-ink"
          onClick={onClose}
          aria-label="Cerrar editor de mapeo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.columns.map((column) => (
          <label
            key={`${column.index}-${column.source}`}
            className="grid gap-1 rounded-xl border border-line/70 bg-white/55 px-2.5 py-2"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-[10.5px] font-medium text-ink">{column.source}</span>
              <span className="text-[9px] text-caption">{confidenceLabel(column.confidence)}</span>
            </span>
            <select
              value={mapping[column.index] ?? ''}
              onChange={(event) =>
                setMapping((current) => ({ ...current, [column.index]: event.target.value || null }))
              }
              className="select select-bordered select-xs h-8 w-full rounded-lg border-line bg-white/80 text-[11px]"
            >
              <option
                value=""
                disabled={column.target === 'patient.name' || column.target === 'patient.microchip'}
              >
                Ignorar columna
              </option>
              {data.targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
        <p className="text-[10.5px] leading-4 text-caption">
          {hasPatientName
            ? 'Revisa las columnas críticas antes de confirmar.'
            : 'Falta asignar una columna a «Paciente · nombre».'}
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[11px] font-medium text-cream shadow-lift transition hover:bg-[#3A2E26] disabled:opacity-50"
          disabled={!hasPatientName || confirm.isPending}
          onClick={submit}
        >
          {confirm.isPending ? <Spinner size="xs" /> : <Check className="h-3.5 w-3.5" />}
          Confirmar mapeo
        </button>
      </div>

      {confirm.isSuccess ? (
        <p className="mt-2 rounded-xl bg-ok-soft px-3 py-2 text-[11px] text-ok">
          Mapeo confirmado. La ficha se ha actualizado con las columnas elegidas.
        </p>
      ) : null}
      {confirm.isError ? (
        <p className="mt-2 rounded-xl bg-crit-soft px-3 py-2 text-[11px] text-crit">
          {confirm.error.message}
        </p>
      ) : null}
    </div>
  );
}

export default ImportMappingEditor;
