import { useEffect, useState } from 'react';
import { useMe } from '../api/hooks';
import { LoginBrand } from '../components/login/LoginBrand';
import { LoginIntro } from '../components/login/LoginIntro';
import { LoginRolePanel } from '../components/login/LoginRolePanel';

const REVEAL_MS = 900;
const INTRO_MS = 1700;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Login() {
  const { data: user } = useMe();
  const reduced = prefersReducedMotion();
  const [intro, setIntro] = useState(() => !reduced);
  const [revealed, setRevealed] = useState(() => reduced);

  useEffect(() => {
    if (!intro) return undefined;
    const revealTimer = window.setTimeout(() => setRevealed(true), REVEAL_MS);
    const removeTimer = window.setTimeout(() => setIntro(false), INTRO_MS);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(removeTimer);
    };
  }, [intro]);

  const skipIntro = () => {
    setRevealed(true);
    setIntro(false);
  };

  return (
    <div className={`relative min-h-screen bg-cream ${intro ? 'overflow-hidden' : ''}`}>
      {intro ? <LoginIntro onSkip={skipIntro} /> : null}
      <div className={`grid min-h-screen w-full lg:grid-cols-[55fr_45fr] ${revealed ? 'login-revealed' : ''}`}>
        <LoginBrand />
        <LoginRolePanel user={user} />
      </div>
    </div>
  );
}

export default Login;
