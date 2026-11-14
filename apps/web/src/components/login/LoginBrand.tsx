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
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-[13px] border border-ink/15 bg-white/50 text-[12.5px] font-medium tracking-[0.02em] text-ink backdrop-blur">
        VL
      </span>
      <span className="text-[16.5px] font-medium tracking-[-0.01em] text-ink">VetLink</span>
      <span className="hidden h-4 border-l border-ink/15 sm:block" aria-hidden="true" />
      <span className="hidden text-[10.5px] leading-4 text-caption sm:block">
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
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ink/10 bg-white/55 text-indigo-700">
        <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium leading-4 text-ink">{pillar.title}</span>
        <span className="mt-1 block text-[11.5px] leading-4 text-para">{pillar.text}</span>
      </span>
    </li>
  );
}

function PillarList() {
  return (
    <ul className="stagger grid gap-2.5">
      {PILLARS.map((pillar) => (
        <PillarCard key={pillar.title} pillar={pillar} />
      ))}
    </ul>
  );
}

function HeroCopy() {
  return (
    <div className="mt-10 max-w-[560px] lg:mt-[clamp(40px,9vh,104px)]">
      <p className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-indigo-700">
        <span className="h-px w-6 bg-indigo-700/40" aria-hidden="true" />
        Historia clínica · antes de la visita
      </p>
      <h1 className="mt-4 text-[clamp(34px,4.6vw,64px)] font-medium leading-[1.06] tracking-[-0.03em] text-ink">
        <span className="block">La historia clínica{' '}</span>
        <span className="block">
          llega <span className="text-indigo-700">completa</span>{' '}
        </span>
        <span className="block">antes de la visita.</span>
      </h1>
      <p className="mt-5 max-w-[440px] text-[13.5px] leading-6 text-para">
        Word, Excel, JSON y CSV se convierten en una ficha canónica: cada alerta con su fuente y un
        briefing listo antes de que el especialista entre en la consulta.
      </p>
    </div>
  );
}

function HeroFootnote() {
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-caption">
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
    <section className="relative isolate order-2 flex flex-col overflow-hidden bg-[linear-gradient(158deg,#FBF6EC_0%,#F5E2CF_46%,#E9B48A_100%)] px-6 py-9 text-ink sm:px-10 lg:order-1 lg:min-h-screen lg:px-12 lg:py-12 xl:px-16">
      <HeroGlow />
      <div className="relative z-10">
        <BrandLockup />
      </div>
      <div className="relative z-10">
        <HeroCopy />
      </div>
      <div className="relative z-10 mt-10 lg:mt-auto lg:pt-10">
        <PillarList />
        <HeroFootnote />
      </div>
    </section>
  );
}

export default LoginBrand;
