import { useState } from "react";
import { supabase } from "@/lib/supabase"; // adjust path
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate()


  const handleResetPassword = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      if (loading) return; // Prevent double submissions


      setMessage("");
      setError("");

      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }
      navigate('/login')
    }
    catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

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
            Reset your password and get back to tracking your Amul adventures!
          </p>
        </div>

        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-card-lg">
          <h1 className="mb-6 font-display text-xl font-semibold text-[hsl(var(--foreground))]">
            Reset your password
          </h1>
          <form onSubmit={handleResetPassword} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="newpassword"
                className="block text-sm font-medium text-[hsl(var(--foreground))]"
              >
                New Password
              </label>
              <input
                id="newpassword"
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "w-full rounded-xl border bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors",
                  "focus:border-amul-red focus:ring-2 focus:ring-amul-red/20",
                  error ? "border-red-400" : "border-[hsl(var(--border))]",
                )}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmnewpassword"
                className="block text-sm font-medium text-[hsl(var(--foreground))]"
              >
                Confirm New Password
              </label>
              <input
                id="confirmnewpassword"
                type="password"
                placeholder="Confirm New password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={cn(
                  "w-full rounded-xl border bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors",
                  "focus:border-amul-red focus:ring-2 focus:ring-amul-red/20",
                  error ? "border-red-400" : "border-[hsl(var(--border))]",
                )}
                required
              />
            </div>

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amul-red px-4 py-2.5 text-sm font-semibold text-white shadow-amul transition-all hover:bg-amul-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>

        {message && <p className="text-sm text-green-600">{message}</p>}
      </div>
    </div>
  );
}
