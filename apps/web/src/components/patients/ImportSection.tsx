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
  READY: { label: 'Listo', badge: 'badge-success', text: 'text-success', icon: CheckCircle2 },
  NEEDS_REVIEW: {
    label: 'Revisar',
    badge: 'badge-warning',
    text: 'text-warning',
    icon: AlertTriangle,
  },
  FAILED: { label: 'Fallido', badge: 'badge-error', text: 'text-error', icon: XCircle },
};

function importStatusStyle(status: string): ImportStatusStyle {
  const fallback: ImportStatusStyle = {
    label: status,
    badge: 'badge-ghost',
    text: 'text-base-content/40',
    icon: Clock3,
  };
  return lookupValue(IMPORT_STATUS_STYLES, String(status).toUpperCase(), fallback);
}

function ImportResultRow({ file }: { file: ImportFileResult }) {
  const style = importStatusStyle(file.status);
  const Icon = style.icon;
  return (
    <li className="flex items-start gap-2 rounded-xl border border-base-300/70 bg-base-100 px-3 py-2">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{file.filename}</p>
        {file.message ? (
          <p className="text-[11px] leading-snug text-base-content/50">{file.message}</p>
        ) : null}
      </div>
      <span className={`badge badge-sm shrink-0 ${style.badge}`}>{style.label}</span>
    </li>
  );
}

function ImportResult({ result, onSeePatients }: { result: ImportResponse; onSeePatients: () => void }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-semibold text-base-content/70">
          Resultado de la importación
        </p>
        <span className="badge badge-ghost badge-xs">job {result.job_id}</span>
        <button type="button" className="btn btn-ghost btn-xs ml-auto gap-1" onClick={onSeePatients}>
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
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary/10 text-secondary">
        <UploadCloud className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">Importar historia clínica</h2>
        <p className="text-[12px] text-base-content/55">
          Arrastra los ficheros o selecciónalos · Word, Excel y JSON
        </p>
      </div>
    </div>
  );
}

function ImportControls({ pending, onOpen }: { pending: boolean; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
      <span className="badge badge-ghost badge-sm gap-1">
        <FileText className="h-3 w-3" /> .docx
      </span>
      <span className="badge badge-ghost badge-sm gap-1">
        <FileSpreadsheet className="h-3 w-3" /> .xlsx
      </span>
      <span className="badge badge-ghost badge-sm gap-1">
        <FileUp className="h-3 w-3" /> .json
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm gap-1.5"
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
        <p className="mt-3 text-[12px] text-error">
          Formato no soportado: {rejected.join(', ')}. Usa .docx, .xlsx o .json.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-[12px] text-error">
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
      className={`vl-card border-dashed p-5 transition-colors ${
        dropzone.isDragActive ? 'border-secondary bg-secondary/5' : ''
      }`}
      aria-label="Importar historias clínicas"
    >
      <input {...dropzone.getInputProps()} aria-label="Seleccionar ficheros de historia clínica" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ImportIntro />
        <ImportControls pending={importFiles.isPending} onOpen={dropzone.open} />
      </div>
      <ImportNotices rejected={dropzone.rejected} error={importFiles.error ?? undefined} />
      {importFiles.data ? (
        <ImportResult result={importFiles.data} onSeePatients={() => navigate('/patients')} />
      ) : null}
    </section>
  );
}
