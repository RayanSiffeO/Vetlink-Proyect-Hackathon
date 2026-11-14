import { ShieldCheck } from 'lucide-react';
import { CatMascot } from './CatMascot';

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <span className="vl-wordmark text-[17px] font-medium tracking-[-0.02em]">VetLink</span>
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

function HeroCopy() {
  return (
    <div className="mt-10 max-w-[560px] lg:mt-[clamp(24px,6vh,72px)]">
      <h1 className="text-[clamp(34px,4.6vw,64px)] font-medium leading-[1.06] tracking-[-0.03em] text-ink">
        <span className="block">Menos papeleo.</span>
        <span className="block">Más tiempo</span>
        <span className="block">
          para <span className="text-indigo-700">cuidar</span>.
        </span>
      </h1>
      <p className="mt-5 max-w-[420px] text-[13.5px] leading-6 text-para">
        La historia completa de tu paciente, con alertas y briefing, antes de la consulta.
      </p>
    </div>
  );
}

function CatShowcase() {
  return (
    <div className="glass-login mt-7 flex max-w-[460px] items-center gap-4 rounded-[30px] p-4 sm:gap-5 sm:p-5">
      <CatMascot />
      <div className="min-w-0">
        <p className="vl-section-title text-indigo-700">Kira · Border Collie</p>
        <p className="mt-1 text-[13px] font-medium leading-5 text-ink">La ficha ya está lista.</p>
        <p className="mt-1 text-[11.5px] leading-4 text-caption">
          7 alertas · briefing pre-visita
        </p>
      </div>
    </div>
  );
}

function HeroFootnote() {
  return (
    <p className="mt-5 flex items-center gap-1.5 text-[10.5px] text-caption">
      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      Demo con datos ficticios
    </p>
  );
}

export function LoginBrand() {
  return (
    <section className="login-brand relative isolate order-2 flex flex-col overflow-hidden bg-transparent px-6 py-9 text-ink sm:px-10 lg:order-1 lg:min-h-screen lg:px-12 lg:py-12 xl:px-16">
      <HeroGlow />
      <div className="relative z-10 hidden lg:block">
        <BrandLockup />
      </div>
      <div className="relative z-10">
        <HeroCopy />
        <CatShowcase />
        <HeroFootnote />
      </div>
    </section>
  );
}

export default LoginBrand;
