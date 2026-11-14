import { useMe } from '../api/hooks';
import { LoginBrand } from '../components/login/LoginBrand';
import { LoginRolePanel } from '../components/login/LoginRolePanel';

export function Login() {
  const { data: user } = useMe();
  return (
    <div className="min-h-screen bg-cream">
      <div className="grid min-h-screen w-full lg:grid-cols-[55fr_45fr]">
        <LoginBrand />
        <LoginRolePanel user={user} />
      </div>
    </div>
  );
}

export default Login;
