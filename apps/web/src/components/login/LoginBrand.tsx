import { ShieldCheck } from 'lucide-react';

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
    <div className="mt-10 max-w-[560px] lg:mt-[clamp(28px,7vh,84px)]">
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

function PatientPreview() {
  return (
    <article className="glass mt-8 max-w-[460px] rounded-[26px] p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#C46B4D_0%,#9E4C36_100%)] text-[13px] font-medium tracking-tight text-white">
          K
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-medium uppercase tracking-[0.13em] text-caption">Ficha canónica</p>
          <p className="truncate text-[13.5px] font-medium leading-5 text-ink">Kira · Border Collie</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full border border-crit/20 bg-crit-soft px-2 py-0.5 text-[10px] font-medium text-crit">
          7 alertas
        </span>
      </div>
      <div className="mt-3 rounded-xl border border-crit/20 bg-crit-soft/60 px-3 py-2">
        <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-crit">Prioridad</p>
        <p className="mt-0.5 text-[12px] font-medium leading-5 text-ink">No administrar carprofeno</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-caption">
        {['DOCX', 'XLSX', 'JSON', 'CSV'].map((format) => (
          <span key={format} className="rounded-full border border-line bg-white/50 px-2 py-0.5">
            {format}
          </span>
        ))}
        <span className="ml-auto">53 entidades</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line/70 pt-2.5">
        <span className="text-[10.5px] text-caption">Briefing pre-visita</span>
        <span className="text-[10.5px] font-medium text-indigo-700">Listo</span>
      </div>
    </article>
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
    <section className="login-brand relative isolate order-2 flex flex-col overflow-hidden bg-[linear-gradient(158deg,#FDF6EC_0%,#F6DDC4_44%,#E59B73_100%)] px-6 py-9 text-ink sm:px-10 lg:order-1 lg:min-h-screen lg:px-12 lg:py-12 xl:px-16">
      <HeroGlow />
      <div className="relative z-10 hidden lg:block">
        <BrandLockup />
      </div>
      <div className="relative z-10">
        <HeroCopy />
        <PatientPreview />
      </div>
      <div className="relative z-10 mt-8 lg:mt-auto lg:pt-8">
        <HeroFootnote />
      </div>
    </section>
  );
}

export default LoginBrand;
