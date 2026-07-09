import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { ForgotPassword } from "@/components/ui/ForgotPassword";
import logo from "@/assets/logo.png";

export default function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Already logged in → redirect
  if (session) return <Navigate to={from} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setLoading(false);

    if (authError) {
      setError(friendlyError(authError.message));
    } else {
      navigate(from, { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-display font-bold text-amul-red text-2xl"
          >
            <img src={logo} alt="Amul Paglu Logo" className="h-12 w-12 object-contain" />
            <span>Amul Paglu</span>
          </Link>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Sign in to track your Amul adventures
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-card-lg">
          <h1 className="mb-6 font-display text-xl font-semibold text-[hsl(var(--foreground))]">
            {showForgotPassword ? "Reset your password" : "Welcome back"}
          </h1>

          {showForgotPassword ? (
            <>
              <ForgotPassword />
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-[hsl(var(--foreground))]"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={cn(
                    "w-full rounded-xl border bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors",
                    "focus:border-amul-red focus:ring-2 focus:ring-amul-red/20",
                    error ? "border-red-400" : "border-[hsl(var(--border))]",
                  )}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-[hsl(var(--foreground))]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs text-amul-red hover:underline"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={cn(
                      "w-full rounded-xl border bg-[hsl(var(--background))] px-3.5 py-2.5 pr-10 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors",
                      "focus:border-amul-red focus:ring-2 focus:ring-amul-red/20",
                      error ? "border-red-400" : "border-[hsl(var(--border))]",
                    )}
                  />
                  <button
                    type="button"
                    aria-label={showPass ? "Hide password" : "Show password"}
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amul-red px-4 py-2.5 text-sm font-semibold text-white shadow-amul transition-all hover:bg-amul-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <LogIn size={16} />
                )}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="font-medium text-amul-red hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
