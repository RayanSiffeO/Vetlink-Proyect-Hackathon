import { ClipboardList, FileSearch, ShieldCheck, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Pillar {
  icon: LucideIcon;
  label: string;
}

const PILLARS: Pillar[] = [
  { icon: FileSearch, label: 'Word · Excel · JSON · CSV' },
  { icon: ClipboardList, label: 'Alertas con procedencia' },
  { icon: StickyNote, label: 'Briefing pre-visita' },
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

function PillarChips() {
  return (
    <ul className="flex flex-wrap gap-2">
      {PILLARS.map((pillar) => {
        const Icon = pillar.icon;
        return (
          <li
            key={pillar.label}
            className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11.5px] font-medium text-ink"
          >
            <Icon className="h-3.5 w-3.5 text-indigo-700" aria-hidden="true" />
            {pillar.label}
          </li>
        );
      })}
    </ul>
  );
}

function HeroCopy() {
  return (
    <div className="mt-10 max-w-[560px] lg:mt-[clamp(40px,9vh,104px)]">
      <h1 className="text-[clamp(34px,4.6vw,64px)] font-medium leading-[1.06] tracking-[-0.03em] text-ink">
        <span className="block">La historia clínica</span>
        <span className="block">
          llega <span className="text-indigo-700">completa</span>
        </span>
        <span className="block">antes de la visita.</span>
      </h1>
      <p className="mt-5 max-w-[420px] text-[13.5px] leading-6 text-para">
        Una ficha única, con alertas y briefing listo antes de la consulta.
      </p>
    </div>
  );
}

function HeroFootnote() {
  return (
    <p className="mt-6 flex items-center gap-1.5 text-[10.5px] text-caption">
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      Demo con datos ficticios
    </p>
  );
}

export function LoginBrand() {
  return (
    <section className="relative isolate order-2 flex flex-col overflow-hidden bg-[linear-gradient(158deg,#FDF6EC_0%,#F6DDC4_44%,#E59B73_100%)] px-6 py-9 text-ink sm:px-10 lg:order-1 lg:min-h-screen lg:px-12 lg:py-12 xl:px-16">
      <HeroGlow />
      <div className="relative z-10 hidden lg:block">
        <BrandLockup />
      </div>
      <div className="relative z-10">
        <HeroCopy />
      </div>
      <div className="relative z-10 mt-10 lg:mt-auto lg:pt-10">
        <PillarChips />
        <HeroFootnote />
      </div>
    </section>
  );
}

export default LoginBrand;
