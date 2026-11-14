import { ClipboardList, FileSearch, ShieldCheck, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Pillar {
  icon: LucideIcon;
  title: string;
  text: string;
}

const PILLARS: Pillar[] = [
  {
    icon: FileSearch,
    title: 'VetRecord',
    text: 'Word, Excel, JSON y texto libre → un registro canónico con provenance.',
  },
  {
    icon: ClipboardList,
    title: 'VetNetwork',
    text: 'Especialistas por especialidad y zona, con tarifa y próximo hueco.',
  },
  {
    icon: StickyNote,
    title: 'VetBriefing',
    text: 'El especialista lee el caso antes de ver al paciente.',
  },
];

function PillarList() {
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-3">
      {PILLARS.map((pillar) => {
        const Icon = pillar.icon;
        return (
          <li key={pillar.title} className="vl-card p-4">
            <Icon className="h-5 w-5 text-secondary" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold">{pillar.title}</p>
            <p className="mt-1 text-[12px] leading-snug text-base-content/55">{pillar.text}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function LoginBrand() {
  return (
    <section className="order-2 lg:order-1">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-sm font-black tracking-tight text-primary-content shadow-card">
          VL
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
            Equipo Joniha
          </p>
          <p className="text-sm text-base-content/50">VIII Hackathon Boehringer Ingelheim</p>
        </div>
      </div>

      <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-primary sm:text-4xl">
        Menos papeleo,
        <br />
        <span className="text-secondary">más cuidado.</span>
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-base-content/65 sm:text-base">
        La historia clínica del paciente, en un solo registro canónico que la clínica generalista y
        el especialista comparten en tiempo real.
      </p>

      <PillarList />

      <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-base-100 px-3 py-1.5 text-[11px] font-medium text-base-content/55">
        <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
        Datos ficticios y anonimizados · niveles de acceso CLINICAL / FULL · auditoría
      </p>
    </section>
  );
}
