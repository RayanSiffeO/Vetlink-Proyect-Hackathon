import { useMe } from '../api/hooks';
import { LoginBrand } from '../components/login/LoginBrand';
import { LoginRolePanel } from '../components/login/LoginRolePanel';

export function Login() {
  const { data: user } = useMe();
  return (
    <div className="min-h-screen bg-base-200">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-0 px-4 py-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-10 lg:py-10">
        <LoginBrand />
        <LoginRolePanel user={user} />
      </div>
    </div>
  );
}

export default Login;
