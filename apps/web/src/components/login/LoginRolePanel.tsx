import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useResetDemo } from '../../api/hooks';
import type { User } from '../../api/types';
import { isSpecialist } from '../../lib/format';
import { homeFor } from '../../lib/routes';
import { useDemoLogin } from '../../hooks/useDemoLogin';
import { Spinner } from '../Spinner';
import { ROLE_CARDS, type RoleCard } from './roles';

interface RoleCardState {
  busy: boolean;
  disabled: boolean;
}

function RoleCardIcon({ card }: { card: RoleCard }) {
  const Icon = card.icon;
  return (
    <span
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${card.accent} text-white shadow-soft`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function RoleCardText({ card }: { card: RoleCard }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold">{card.title}</span>
        <span className="badge badge-xs badge-ghost">{card.subtitle}</span>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-base-content/60">{card.description}</p>
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
  );
}

function RoleCardArrow({ busy }: { busy: boolean }) {
  return (
    <span className="mt-1 shrink-0 text-base-content/30 transition-transform group-hover:translate-x-0.5 group-hover:text-secondary">
      {busy ? <Spinner size="sm" /> : <ArrowRight className="h-5 w-5" />}
    </span>
  );
}

function RoleCardButton({
  card,
  state,
  onSelect,
}: {
  card: RoleCard;
  state: RoleCardState;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={state.disabled}
      className="group relative overflow-hidden rounded-2xl border border-base-300 bg-base-100 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-secondary/60 hover:shadow-card disabled:opacity-60"
      data-demo-user={card.id}
    >
      <div className="flex items-start gap-3">
        <RoleCardIcon card={card} />
        <RoleCardText card={card} />
        <RoleCardArrow busy={state.busy} />
      </div>
    </button>
  );
}

function ActiveSessionCard({ user }: { user: User }) {
  const navigate = useNavigate();
  return (
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
  );
}

function LoginErrorAlert({ error }: { error: Error }) {
  const isOffline = error instanceof ApiError && error.status === 0;
  return (
    <div className="alert alert-error mt-4 items-start text-sm" role="alert">
      <ShieldCheck className="h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">No se pudo iniciar la demo</p>
        <p className="mt-0.5 text-[13px] leading-snug">{error.message}</p>
        {isOffline ? (
          <p className="mt-2 rounded-lg bg-black/10 px-2 py-1 font-mono text-[11px]">
            cd services/api; uv run uvicorn app.main:app --reload --port 8000
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ResetDemoButton({ reset }: { reset: ReturnType<typeof useResetDemo> }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs gap-1.5 text-base-content/45"
      onClick={() => reset.mutate()}
      disabled={reset.isPending}
      title="POST /api/demo/reset (requiere sesión)"
    >
      {reset.isPending ? <Spinner size="xs" /> : <ShieldCheck className="h-3.5 w-3.5" />}
      Reiniciar datos de demo
    </button>
  );
}

function ResetFooter({
  user,
  reset,
}: {
  user: User | null | undefined;
  reset: ReturnType<typeof useResetDemo>;
}) {
  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-base-300/70 pt-3">
        {user ? (
          <ResetDemoButton reset={reset} />
        ) : (
          <span className="text-[11px] text-base-content/35">
            El reset de la demo está en la cabecera, ya con sesión
          </span>
        )}
        <span className="text-[11px] text-base-content/35">v0.1 · H+0</span>
      </div>
      {reset.isError ? (
        <p className="mt-2 text-[11px] text-error">{reset.error.message}</p>
      ) : null}
    </>
  );
}

export function LoginRolePanel({ user }: { user: User | null | undefined }) {
  const { login, pending, start } = useDemoLogin();
  const reset = useResetDemo();

  return (
    <section className="order-1 lg:order-2">
      <div className="vl-card p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Entra en la demo</h2>
          <span className="badge badge-ghost badge-sm">sin contraseña</span>
        </div>
        <p className="mt-1 text-sm text-base-content/55">
          Elige el lado que quieres ver. Puedes cambiar cuando quieras.
        </p>

        {user ? <ActiveSessionCard user={user} /> : null}

        <div className="mt-4 grid gap-3">
          {ROLE_CARDS.map((card) => (
            <RoleCardButton
              key={card.id}
              card={card}
              state={{ busy: pending === card.id, disabled: login.isPending }}
              onSelect={() => start(card.id)}
            />
          ))}
        </div>

        {login.error ? <LoginErrorAlert error={login.error} /> : null}
        <ResetFooter user={user} reset={reset} />
      </div>
    </section>
  );
}
