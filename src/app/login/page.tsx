import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <AuthShell title="Log in" subtitle="Welcome back — pick up where you left off.">
      <LoginForm />
    </AuthShell>
  );
}
