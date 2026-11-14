import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ClipboardList,
  FileSearch,
  ShieldCheck,
  Stethoscope,
  StickyNote,
  Building2,
} from 'lucide-react';
import { ApiError } from '../api/client';
import { useLogin, useMe, useResetDemo } from '../api/hooks';
import { isSpecialist } from '../lib/format';
import { homeFor } from '../lib/routes';

type DemoUser = 'laura' | 'marc';

interface RoleCard {
  id: DemoUser;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  icon: typeof Building2;
  accent: string;
}

const CARDS: RoleCard[] = [
  {
    id: 'laura',
    title: 'Soy clínica (Laura)',
    subtitle: 'Veterinaria generalista',
    description: 'Importa historias, revisa alertas y deriva al especialista que toca.',
    bullets: ['Subir Word / Excel / JSON', 'Ficha canónica con alertas', 'Buscar y derivar'],
    icon: Building2,
    accent: 'from-primary to-[#2B3F6E]',
  },
  {
    id: 'marc',
    title: 'Soy especialista (Marc)',
    subtitle: 'Especialista ambulante',
    description: 'Recibe solicitudes, acepta franjas y llega con el caso leído.',
    bullets: ['Solicitudes con resumen anónimo', 'Briefing pre-visita', 'Agenda unificada'],
    icon: Stethoscope,
    accent: 'from-secondary to-[#2AA79B]',
  },
];

const PILLARS = [
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

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useMe();
  const login = useLogin();
  const resetDemo = useResetDemo();
  const [pending, setPending] = useState<DemoUser | null>(null);

  const from = (location.state as { from?: string } | null)?.from;

  const handleLogin = (role: DemoUser) => {
    setPending(role);
    login.mutate(role, {
      onSuccess: (data) => {
        const target = from && from !== '/login' ? from : homeFor(data.user);
        navigate(target, { replace: true });
      },
      onSettled: () => setPending(null),
    });
  };

  const loginError = login.error;
  const isOffline = loginError instanceof ApiError && loginError.status === 0;

  return (
    <div className="min-h-screen bg-base-200">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-0 px-4 py-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-10 lg:py-10">
        {/* Panel de marca */}
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
            La historia clínica del paciente, en un solo registro canónico que la clínica
            generalista y el especialista comparten en tiempo real.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <li key={pillar.title} className="vl-card p-4">
                  <Icon className="h-5 w-5 text-secondary" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold">{pillar.title}</p>
                  <p className="mt-1 text-[12px] leading-snug text-base-content/55">
                    {pillar.text}
                  </p>
                </li>
              );
            })}
          </ul>

          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-base-100 px-3 py-1.5 text-[11px] font-medium text-base-content/55">
            <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
            Datos ficticios y anonimizados · niveles de acceso CLINICAL / FULL · auditoría
          </p>
        </section>

        {/* Selector de rol demo */}
        <section className="order-1 lg:order-2">
          <div className="vl-card p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Entra en la demo</h2>
              <span className="badge badge-ghost badge-sm">sin contraseña</span>
            </div>
            <p className="mt-1 text-sm text-base-content/55">
              Elige el lado que quieres ver. Puedes cambiar cuando quieras.
            </p>

            {user ? (
              <div className="mt-4 rounded-xl border border-secondary/30 bg-secondary/5 p-3 text-sm">
                <p className="font-medium">
                  Sesión activa como {user.display_name} ({isSpecialist(user) ? 'especialista' : 'clínica'})
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-2 gap-1.5"
                  onClick={() => navigate(homeFor(user), { replace: true })}
                >
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3">
              {CARDS.map((card) => {
                const Icon = card.icon;
                const busy = pending === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleLogin(card.id)}
                    disabled={login.isPending}
                    className="group relative overflow-hidden rounded-2xl border border-base-300 bg-base-100 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-secondary/60 hover:shadow-card disabled:opacity-60"
                    data-demo-user={card.id}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${card.accent} text-white shadow-soft`}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold">{card.title}</span>
                          <span className="badge badge-xs badge-ghost">{card.subtitle}</span>
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-base-content/60">
                          {card.description}
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {card.bullets.map((bullet) => (
                            <li
                              key={bullet}
                              className="inline-flex items-center gap-1 text-[11px] text-base-content/45"
                            >
                              <span className="h-1 w-1 rounded-full bg-secondary/70" />
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <span className="mt-1 shrink-0 text-base-content/30 transition-transform group-hover:translate-x-0.5 group-hover:text-secondary">
                        {busy ? (
                          <span className="loading loading-spinner loading-sm" />
                        ) : (
                          <ArrowRight className="h-5 w-5" />
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {loginError ? (
              <div className="alert alert-error mt-4 items-start text-sm" role="alert">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">No se pudo iniciar la demo</p>
                  <p className="mt-0.5 text-[13px] leading-snug">{loginError.message}</p>
                  {isOffline ? (
                    <p className="mt-2 rounded-lg bg-black/10 px-2 py-1 font-mono text-[11px]">
                      cd services/api; uv run uvicorn app.main:app --reload --port 8000
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-base-300/70 pt-3">
              {user ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs gap-1.5 text-base-content/45"
                  onClick={() => resetDemo.mutate()}
                  disabled={resetDemo.isPending}
                  title="POST /api/demo/reset (requiere sesión)"
                >
                  {resetDemo.isPending ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
                  Reiniciar datos de demo
                </button>
              ) : (
                <span className="text-[11px] text-base-content/35">
                  El reset de la demo está en la cabecera, ya con sesión
                </span>
              )}
              <span className="text-[11px] text-base-content/35">v0.1 · H+0</span>
            </div>
            {resetDemo.isError ? (
              <p className="mt-2 text-[11px] text-error">{resetDemo.error.message}</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
