import { ClipboardList, FileSearch, ShieldCheck, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CatMascot } from './CatMascot';

interface Pillar {
  icon: LucideIcon;
  title: string;
  text: string;
}

const PILLARS: Pillar[] = [
  {
    icon: FileSearch,
    title: 'Word, Excel, JSON y CSV → una ficha única',
    text: 'La historia del paciente en un registro canónico, sin copiar y pegar.',
  },
  {
    icon: ClipboardList,
    title: 'Alertas y procedencia',
    text: 'Cada alerta ordenada por lo que no puede esperar, con su fuente a la vista.',
  },
  {
    icon: StickyNote,
    title: 'Briefing antes de la visita',
    text: 'El especialista lee el caso antes de entrar; la consulta empieza informada.',
  },
];

function BrandLockup() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="vl-wordmark text-[clamp(28px,3vw,34px)] font-medium leading-none tracking-[-0.03em]">
        VetLink
      </span>
      <span className="text-[10.5px] leading-4 tracking-[0.02em] text-caption">
        Salud animal, a un clic
      </span>
    </div>
  );
}

function HeroGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <span className="login-orb login-orb-cream" />
      <span className="login-orb login-orb-indigo" />
      <span className="login-orb login-orb-haze" />
      <span className="login-ring login-ring-lg" />
      <span className="login-ring login-ring-sm" />
    </div>
  );
}

function PillarCard({ pillar }: { pillar: Pillar }) {
  const Icon = pillar.icon;
  return (
    <li className="glass flex items-start gap-3 rounded-[20px] px-4 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/45 bg-white/40 text-indigo-700">
        <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium leading-4 text-ink">{pillar.title}</span>
        <span className="mt-1 block text-[11.5px] leading-4 text-para">{pillar.text}</span>
      </span>
    </li>
  );
}

function HeroContent() {
  return (
    <div className="flex w-full flex-col items-center gap-12">
      <CatMascot />
      <ul className="stagger grid w-full max-w-[540px] gap-2.5">
        {PILLARS.map((pillar) => (
          <PillarCard key={pillar.title} pillar={pillar} />
        ))}
      </ul>
    </div>
  );
}

function HeroFootnote() {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[10.5px] text-caption">
      <span>Clínica Vall del Sol · Sant Cugat del Vallès</span>
      <span aria-hidden="true">·</span>
      <span>Caso guía Kira</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        Datos ficticios
      </span>
    </p>
  );
}

export function LoginBrand() {
  return (
    <section className="login-brand relative isolate flex flex-col overflow-hidden bg-transparent px-6 py-9 text-ink sm:px-10 lg:min-h-screen lg:px-12 lg:py-12 xl:px-16">
      <HeroGlow />
      <div className="relative z-10 flex justify-center">
        <BrandLockup />
      </div>
      <div className="relative z-10 flex flex-1 items-center py-8">
        <HeroContent />
      </div>
      <div className="relative z-10">
        <HeroFootnote />
      </div>
    </section>
  );
}

export default LoginBrand;
