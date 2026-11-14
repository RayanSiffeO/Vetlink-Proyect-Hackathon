interface LoginIntroProps {
  onSkip: () => void;
}

export function LoginIntro({ onSkip }: LoginIntroProps) {
  return (
    <div className="login-intro" aria-hidden="true" onClick={onSkip}>
      <span className="login-intro-glow" />
      <div className="login-intro-content">
        <p className="login-intro-word">VetLink</p>
        <p className="login-intro-caption">Salud animal, a un clic</p>
      </div>
    </div>
  );
}

export default LoginIntro;
