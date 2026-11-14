import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  FileText,
  FileUp,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import type { ImportFileResult, ImportResponse } from '../../api/types';
import { useImportFiles } from '../../api/hooks';
import { usePatientDropzone } from '../../hooks/usePatientDropzone';
import { Spinner } from '../Spinner';
import { lookupValue } from '../../lib/lookup';

interface ImportStatusStyle {
  label: string;
  badge: string;
  text: string;
  icon: typeof CheckCircle2;
}

const IMPORT_STATUS_STYLES: Record<string, ImportStatusStyle> = {
  READY: {
    label: 'Listo',
    badge: 'border-ok/20 bg-ok-soft text-ok',
    text: 'text-ok',
    icon: CheckCircle2,
  },
  NEEDS_REVIEW: {
    label: 'Revisar',
    badge: 'border-warn/20 bg-warn-soft text-warn',
    text: 'text-warn',
    icon: AlertTriangle,
  },
  FAILED: {
    label: 'Fallido',
    badge: 'border-crit/20 bg-crit-soft text-crit',
    text: 'text-crit',
    icon: XCircle,
  },
};

function importStatusStyle(status: string): ImportStatusStyle {
  const fallback: ImportStatusStyle = {
    label: status,
    badge: 'border-line-strong bg-white/70 text-caption',
    text: 'text-caption',
    icon: Clock3,
  };
  return lookupValue(IMPORT_STATUS_STYLES, String(status).toUpperCase(), fallback);
}

function ImportResultRow({ file }: { file: ImportFileResult }) {
  const style = importStatusStyle(file.status);
  const Icon = style.icon;
  return (
    <li className="flex items-start gap-2 rounded-xl border border-line bg-white/75 px-3 py-2">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-ink">{file.filename}</p>
        {file.message ? (
          <p className="text-[11px] leading-snug text-caption">{file.message}</p>
        ) : null}
      </div>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-medium leading-4 ${style.badge}`}
      >
        {style.label}
      </span>
    </li>
  );
}

function ImportResult({ result, onSeePatients }: { result: ImportResponse; onSeePatients: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-white/55 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-medium text-ink">Resultado de la importación</p>
        <span className="rounded-full border border-line-strong bg-white/70 px-2 py-0.5 font-mono text-[10px] text-caption">
          job {result.job_id}
        </span>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-indigo-700 transition duration-200 ease-smooth hover:bg-white/80"
          onClick={onSeePatients}
        >
          Ver pacientes
        </button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {(result.files ?? []).map((file, index) => (
          <ImportResultRow key={`${file.filename}-${index}`} file={file} />
        ))}
      </ul>
    </div>
  );
}

function ImportIntro() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
        <UploadCloud className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-[16px] font-medium leading-6 tracking-[-0.01em] text-ink">
          Importar historia clínica
        </h2>
        <p className="text-[12px] leading-[18px] text-caption">
          Arrastra los ficheros o selecciónalos · Word, Excel, JSON y CSV
        </p>
      </div>
    </div>
  );
}

function FormatChip({ icon, label }: { icon: typeof FileText; label: string }) {
  const Icon = icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line-strong/80 bg-white/70 px-2 py-0.5 text-[10.5px] font-medium leading-4 text-caption">
      <Icon className="h-3 w-3" aria-hidden="true" /> {label}
    </span>
  );
}

function ImportControls({ pending, onOpen }: { pending: boolean; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
      <div className="flex flex-wrap items-center gap-1.5">
        <FormatChip icon={FileText} label=".docx" />
        <FormatChip icon={FileSpreadsheet} label=".xlsx" />
        <FormatChip icon={FileUp} label=".json" />
        <FormatChip icon={FileSpreadsheet} label=".csv" />
      </div>
      <button
        type="button"
        className="btn btn-primary btn-sm h-9 gap-1.5 rounded-full px-4 text-[12px] shadow-lift"
        onClick={onOpen}
        disabled={pending}
      >
        {pending ? <Spinner size="xs" /> : <UploadCloud className="h-4 w-4" />}
        {pending ? 'Procesando…' : 'Seleccionar ficheros'}
      </button>
    </div>
  );
}

function ImportNotices({ rejected, error }: { rejected: string[]; error?: Error }) {
  return (
    <>
      {rejected.length > 0 ? (
        <p className="mt-3 rounded-xl border border-crit/20 bg-crit-soft/70 px-3 py-2 text-[12px] text-crit">
          Formato no soportado: {rejected.join(', ')}. Usa .docx, .xlsx, .json o .csv.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl border border-crit/20 bg-crit-soft/70 px-3 py-2 text-[12px] text-crit">
          Error al importar: {error.message}
        </p>
      ) : null}
    </>
  );
}

export function ImportSection() {
  const importFiles = useImportFiles();
  const navigate = useNavigate();
  const dropzone = usePatientDropzone(importFiles.mutate);

  return (
    <section
      {...dropzone.getRootProps()}
      className={`glass rounded-panel p-4 transition duration-300 ease-smooth sm:p-5 ${
        dropzone.isDragActive ? 'ring-2 ring-indigo-300' : ''
      }`}
      aria-label="Importar historias clínicas"
    >
      <input {...dropzone.getInputProps()} aria-label="Seleccionar ficheros de historia clínica" />
      <div
        className={`rounded-[22px] border border-dashed px-3.5 py-3.5 transition-colors sm:px-4 ${
          dropzone.isDragActive
            ? 'border-indigo-300 bg-indigo-50/70'
            : 'border-line-strong/90 bg-white/55'
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ImportIntro />
          <ImportControls pending={importFiles.isPending} onOpen={dropzone.open} />
        </div>
        <ImportNotices rejected={dropzone.rejected} error={importFiles.error ?? undefined} />
      </div>
      {importFiles.data ? (
        <ImportResult result={importFiles.data} onSeePatients={() => navigate('/patients')} />
      ) : null}
    </section>
  );
}
